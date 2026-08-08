use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use crate::app::app::read::read as app_read;
use crate::app::app::write::write as app_write;
use ndata::Data::DString;
use ndata::Data::DArray;
use ndata::Data::DNull;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "control_id", "component_type", "name", "nn_sessionid"] {
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
        let arg_2: String = o.get_string("component_type");
        let arg_3: String = o.get_string("name");
        let arg_4: String = o.get_string("nn_sessionid");
        add_component(arg_0, arg_1, arg_2, arg_3, arg_4)
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

pub fn add_component(lib: String, control_id: String, component_type: String, name: String, nn_sessionid: String) -> DataObject {
// 1. Create the new ID by writing an empty payload
let new_id = app_write(lib.clone(), DNull, DataObject::new(), DNull, DNull, nn_sessionid.clone()).get_string("id");

let mut comp_data = DataObject::new();
comp_data.put_string("name", &name);
comp_data.put_string("id", &new_id);

// If it's a Command, we must initialize the legacy java target
// TODO - Verify this is no longer referenced prior to removing legacy java field
if component_type == "cmd" {
  let mut empty_java = DataObject::new();
  empty_java.put_string("java", "return null;");
  let java_id = app_write(lib.clone(), DNull, empty_java, DNull, DNull, nn_sessionid.clone()).get_string("id");
  comp_data.put_string("java", &java_id);
} 

// Save the component's metadata
app_write(lib.clone(), DString(new_id), comp_data.clone(), DNull, DNull, nn_sessionid.clone());

// 2. Attach the new component to its parent control
let mut parent = app_read(lib.clone(), control_id.clone(), nn_sessionid.clone()).get_object("data");
let mut arr = if parent.has(&component_type) {
  parent.get_array(&component_type)
} else {
  DataArray::new()
};

arr.push_object(comp_data.clone());
parent.put_array(&component_type, arr);

app_write(lib, DString(control_id), parent, DNull, DNull, nn_sessionid.clone());

// Return the new component configuration
comp_data
}
