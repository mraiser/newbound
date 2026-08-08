use ndata::dataobject::DataObject;
use crate::dev::editcontrol::lookup_id::lookup_id;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;

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
        lookup_cmd_id(arg_0, arg_1, arg_2)
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

pub fn lookup_cmd_id(lib: String, ctl: String, cmd: String) -> String {
let store = DataStore::new();
let real_id = lookup_id(lib.clone(), ctl.clone());
let control_data = store.get_data(&lib, &real_id).get_object("data");
if control_data.has("cmd") {
  let list: DataArray = control_data.get_array("cmd");
  for i in 0..list.len() {
    let item: DataObject = list.get_object(i);

    if item.has("name") && item.get_string("name") == cmd {
      // Return the corresponding ID if a match is found
      if item.has("id") {
        return item.get_string("id");
      }
    }
  }
}

// Fallback: If not found, return the original input string
cmd.to_string()

}
