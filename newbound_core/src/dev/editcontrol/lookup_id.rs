use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::datastore::DataStore;

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
        lookup_id(arg_0, arg_1)
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

pub fn lookup_id(lib: String, name: String) -> String {
let store = DataStore::new();

// Read the master 'controls' list for the library
let controls_data = store.get_data(&lib, "controls").get_object("data");

// Check if the 'list' array exists
if controls_data.has("list") {
  let list: DataArray = controls_data.get_array("list");

  // Iterate through the array to find a matching name
  for i in 0..list.len() {
    let item: DataObject = list.get_object(i);

    if item.has("name") && item.get_string("name") == name {
      // Return the corresponding ID if a match is found
      if item.has("id") {
        return item.get_string("id");
      }
    }
  }
}

// Fallback: If not found, return the original input string
name.to_string()
}
