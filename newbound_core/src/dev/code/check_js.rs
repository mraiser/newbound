use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use flowlang::buildrust::build;
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
        check_js(arg_0, arg_1, arg_2)
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

pub fn check_js(lib: String, ctl: String, cmd: String) -> DataObject {
// Resolve the command and confirm it is a JavaScript command.
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
if lang != "javascript" && lang != "js" {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("{}:{}:{} is a {} command, not a JavaScript command", lib, ctl, cmd, lang));
    return o;
}

// Regenerate its editor files from the store - <lib>/<ctl>/<cmd>.js with
// JSDoc types from the declared params, and flowlang.d.ts - as dev.compile
// does on every edit.
let _ = std::panic::catch_unwind(|| build(&lib, &ctl, &cmd, Path::new("")));

// Compile it in V8 and (if TypeScript's tsc is found) type-check it against
// flowlang.d.ts - never running the command.
#[cfg(feature = "javascript_runtime")]
{
    return flowlang::jscmd::check(&lib, &id);
}
#[cfg(not(feature = "javascript_runtime"))]
{
    let _ = id;
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "check_js needs a build with the JavaScript runtime: --features=serde_support,javascript_runtime");
    o
}
}
