use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "name"] {
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
        let arg_1: String = o.get_string("name");
        delete_asset(arg_0, arg_1)
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

pub fn delete_asset(lib: String, name: String) -> DataObject {
fn bad_name(name: &str) -> bool {
    name.is_empty()
        || name.starts_with('/')
        || name.contains('\\')
        || name.split('/').any(|seg| seg.is_empty() || seg == "." || seg == "..")
}

if bad_name(&name) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Invalid asset name: use a relative path inside _ASSETS ('style.css', 'vendor/lib.js'); no leading '/', no '..'.");
    return o;
}

let store = DataStore::new();
let libdir = store.root.join(&lib);
if !libdir.exists() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' not found", lib));
    return o;
}

let target = libdir.join("_ASSETS").join(&name);
if !target.is_file() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("No such asset: {}", name));
    return o;
}
if let Err(e) = std::fs::remove_file(&target) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Unable to delete asset: {}", e));
    return o;
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("name", &name);
o.put_boolean("removed", true);
o
}
