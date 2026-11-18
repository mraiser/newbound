use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use flowlang::flowlang::http::hex_decode::hex_decode;
use crate::app::service::init::path_is_safe;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["nn_path"] {
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
        let arg_0: String = o.get_string("nn_path");
        asset(arg_0)
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

pub fn asset(nn_path: String) -> String {
// Path traversal guard: the library name and asset path come straight from
// the URL. Refuse any ".." component (raw or percent-encoded) and any
// malformed path with an empty file path (an empty answer), so nothing
// outside data/<lib>/_ASSETS/ can be named.
if nn_path.len() < 12 || !nn_path.is_char_boundary(11) { return "".to_string(); }
let p = &nn_path[11..];
if !path_is_safe(p) || !path_is_safe(&hex_decode(p.to_string())) { return "".to_string(); }
let x = match p.find("/") { Some(x) => x, None => return "".to_string() };
let app = &p[..x];
if app.is_empty() { return "".to_string(); }
let p = &p[x..];
let root = DataStore::new().root;
let root = root.join(app);
let root = root.join("_ASSETS");
let root = root.into_os_string().into_string().unwrap();
let p = root + p;
p.to_string()
}
