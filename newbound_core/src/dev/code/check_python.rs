use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use flowlang::buildrust::build;
use flowlang::pycmd::check;
use std::path::Path;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "cmd"] {
        if !o.has(p) {
            let mut e = DataObject::new();
            e.put_string("status", "err");
            e.put_string("msg", &format!("missing required parameter: {}", p));
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", e);
            return result_obj;
        }
    }
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        let arg_0: String = o.get_string("lib");
        let arg_1: String = o.get_string("ctl");
        let arg_2: String = o.get_string("cmd");
        check_python(arg_0, arg_1, arg_2)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
            result_obj
        }
        Err(err) => {
            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");

            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic occurred".to_string()
            };

            err_obj.put_string("msg", &msg);
            // Wrapped in the same `a` envelope a successful return uses.
            // Unwrapped, callers that unpack the envelope (newbound's
            // format_result, for one) report an opaque 500 — "Not an object:
            // DString(\"err\")" — instead of this message.
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", err_obj);
            result_obj
        }
    }
}

pub fn check_python(lib: String, ctl: String, cmd: String) -> DataObject {
// Resolve the command and confirm it is a Python command.
let store = DataStore::new();
let id = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| store.lookup_cmd_id(&lib, &ctl, &cmd))) {
    Ok(id) => id,
    Err(_) => {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Command {}:{}:{} not found", lib, ctl, cmd));
        return o;
    }
};
let lang = store.get_data(&lib, &id).get_object("data").get_string("type");
if lang != "python" {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("{}:{}:{} is a {} command, not a Python command", lib, ctl, cmd, lang));
    return o;
}

// Regenerate the source (and the ndata_py/flowlang stubs) from the store, as
// dev.compile does on every edit, so the check sees the current code.
let _ = std::panic::catch_unwind(|| build(&lib, &ctl, &cmd, Path::new("")));

// Compile, import and (if mypy is installed) type-check it - in a separate
// Python process, never running the command.
check(&lib, &id)

}
