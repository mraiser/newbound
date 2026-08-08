use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use std::fs;
use flowlang::datastore::*;
use flowlang::appserver::load_library;
use flowlang::flowlang::*;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "readers", "writers"] {
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
        let arg_1: DataArray = o.get_array("readers");
        let arg_2: DataArray = o.get_array("writers");
        newlib(arg_0, arg_1, arg_2)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
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

pub fn newlib(lib: String, readers: DataArray, writers: DataArray) -> String {
let store = DataStore::new();
let path = store.root.join(&lib);
if !path.exists() { let _ = fs::create_dir_all(&path).unwrap(); }

let mut meta = DataObject::new();
meta.put_string("username", "system");
meta.put_array("readers", readers);
meta.put_array("writers", writers);
meta.put_object("cargo", DataObject::from_string(r#"{"crate_types":["dylib"],"dependencies":{},"ffi":true}"#));
meta.put_string("root", &lib);

let path2 = path.join("meta.json");
fs::write(path2, meta.to_string()).expect("Unable to write file");

load_library(&lib);
data::write::write(lib.to_owned(), "tasklists".to_string(), DataObject::new(), DataArray::new(), DataArray::new());

let mut controls = DataObject::new();
controls.put_array("list", DataArray::new());
data::write::write(lib.to_owned(), "controls".to_string(), controls, DataArray::new(), DataArray::new());

let path2 = path.join("_ASSETS");
let _ = fs::create_dir_all(&path2).unwrap();

"OK".to_string()
}
