use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
use flowlang::appserver::init_globals;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "author"] {
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
        let arg_1: String = o.get_string("author");
        delete_library(arg_0, arg_1)
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

pub fn delete_library(lib: String, author: String) -> DataObject {

let _author = author;
let store = DataStore::new();
let path = store.root.join(&lib);
if !path.exists() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' not found", lib));
    return o;
}

let mut n = 0;
if store.exists(&lib, "controls") {
    let d = store.get_data(&lib, "controls").get_object("data");
    if d.has("list") { n = d.get_array("list").len(); }
}
if n > 0 {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' has {} control(s) - delete them first (rmdir semantics)", lib, n));
    return o;
}

let _x = std::fs::remove_dir_all(&path);
init_globals();

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("Library '{}' deleted", lib));
o

}
