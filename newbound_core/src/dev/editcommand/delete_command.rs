use ndata::dataobject::DataObject;
use crate::app::app::read::read as app_read;
use crate::app::app::write::write as app_write;
use crate::app::app::delete::delete as app_delete;
use ndata::dataarray::DataArray;
use ndata::Data::DString;
use ndata::Data::DNull;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "control_id", "cmd_id", "nn_sessionid"] {
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
        let arg_1: String = o.get_string("control_id");
        let arg_2: String = o.get_string("cmd_id");
        let arg_3: String = o.get_string("nn_sessionid");
        delete_command(arg_0, arg_1, arg_2, arg_3)
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

pub fn delete_command(lib: String, control_id: String, cmd_id: String, nn_sessionid: String) -> String {
// 1. Fetch the command metadata to find the source code ID
let cmd_meta = app_read(lib.clone(), cmd_id.clone(), nn_sessionid.clone()).get_object("data");

// Determine the current language to find the source code reference
if cmd_meta.has("type") {
  let lang = cmd_meta.get_string("type");
  if cmd_meta.has(&lang) {
    let source_id = cmd_meta.get_string(&lang);
    // DELETE 1: Clean up the actual source code object!
    app_delete(lib.clone(), source_id.clone(), nn_sessionid.clone());
  }
}

// DELETE 2: Clean up the command metadata
app_delete(lib.clone(), cmd_id.clone(), nn_sessionid.clone());

// 3. Unlink from the Parent Control
let mut parent = app_read(lib.clone(), control_id.clone(), nn_sessionid.clone()).get_object("data");
if parent.has("cmd") {
  let cmd_list = parent.get_array("cmd");
  let mut new_cmd_list = DataArray::new();

  // Rebuild the array, skipping the deleted command
  for i in 0..cmd_list.len() {
    let item = cmd_list.get_object(i);
    if item.get_string("id") != cmd_id {
      new_cmd_list.push_object(item);
    }
  }

  // Replace the old array with the newly filtered one
  parent.put_array("cmd", new_cmd_list);

  // Save the parent
  app_write(lib.clone(), DString(control_id), parent, DNull, DNull, nn_sessionid);
}

"Command deleted successfully".to_string()
}
