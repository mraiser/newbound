use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use crate::security::security::init::check_auth;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "id", "nn_sessionid"] {
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
        let arg_1: String = o.get_string("id");
        let arg_2: String = o.get_string("nn_sessionid");
        read(arg_0, arg_1, arg_2)
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

pub fn read(lib: String, id: String, nn_sessionid: String) -> DataObject {
if !DataStore::globals().get_object("system").get_object("libraries").has(&lib) {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("msg", &format!("NO SUCH LIBRARY: {}", lib));
  return o;
}
if check_auth(&lib, &id, &nn_sessionid, false) {
  let store = DataStore::new();
  if store.exists(&lib, &id) { return store.get_data(&lib, &id); }
  else { return DataObject::from_string("{\"status\":\"err\",\"msg\":\"NOT FOUND\"}"); }
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")
}
