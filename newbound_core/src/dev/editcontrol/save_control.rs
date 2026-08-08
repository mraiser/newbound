use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::datastore::DataStore;
use crate::app::app::unique_session_id::unique_session_id;
use crate::app::app::read::read as app_read;
use crate::app::app::write::write as app_write;
use ndata::Data::DString;
use ndata::Data::DArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "id", "html", "css", "js", "groups", "desc", "readers", "inline_data", "nn_sessionid"] {
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
        let arg_2: String = o.get_string("html");
        let arg_3: String = o.get_string("css");
        let arg_4: String = o.get_string("js");
        let arg_5: String = o.get_string("groups");
        let arg_6: String = o.get_string("desc");
        let arg_7: DataArray = o.get_array("readers");
        let arg_8: DataObject = o.get_object("inline_data");
        let arg_9: String = o.get_string("nn_sessionid");
        save_control(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6, arg_7, arg_8, arg_9)
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

pub fn save_control(lib: String, id: String, html: String, css: String, js: String, groups: String, desc: String, readers: DataArray, inline_data: DataObject, nn_sessionid: String) -> String {
let mut ctl_data = app_read(lib.clone(), id.clone(), nn_sessionid.clone()).get_object("data");

// Update primitive string fields
ctl_data.put_string("html", &html);
ctl_data.put_string("css", &css);
ctl_data.put_string("js", &js);
ctl_data.put_string("groups", &groups);
ctl_data.put_string("desc", &desc);

let mut attachment_keys = DataArray::new();
attachment_keys.push_string("html");
attachment_keys.push_string("css");
attachment_keys.push_string("js");
ctl_data.put_array("attachmentkeynames", attachment_keys);

// Extract existing inline data mapping or create new
let existing_data_list = if ctl_data.has("data") {
  ctl_data.get_array("data")
} else {
  DataArray::new()
};

let mut new_data_list = DataArray::new();
let mut nowriters = DataArray::new();

// Iterate over the nested ndata object containing the inline test data
for key in inline_data.clone().keys() {
  let d = inline_data.get_object(&key);

  // Find existing id if present
  let mut data_id = "".to_string();
  for i in 0..existing_data_list.len() {
    let existing_item = existing_data_list.get_object(i);
    if existing_item.get_string("name") == key {
      data_id = existing_item.get_string("id");
      break;
    }
  }

  // If no ID exists, generate one
  if data_id.is_empty() {
    data_id = unique_session_id(); 
  }

  // Write the deeply nested inline data to the store using the same readers
  app_write(lib.clone(), DString(data_id.clone()), d, DArray(readers.data_ref), DArray(nowriters.data_ref), nn_sessionid.clone());

  // Push the reference to the parent map
  let mut data_ref = DataObject::new();
  data_ref.put_string("name", &key);
  data_ref.put_string("id", &data_id);
  new_data_list.push_object(data_ref);
}

// Move the newly constructed list into the main control data
ctl_data.put_array("data", new_data_list);

// Save the main control
app_write(lib, DString(id), ctl_data, DArray(readers.data_ref), DArray(nowriters.data_ref), nn_sessionid);

// Returning a string maps to the "msg" field in the standard OK response
"Control saved successfully".to_string()
}
