use ndata::dataobject::DataObject;
use crate::app::app::read::read as app_read;
use crate::app::app::write::write as app_write;
use ndata::Data::DString;
use ndata::Data::DArray;
use ndata::Data::DNull;
use crate::dev::editcontrol::appdata::appdata;
use crate::app::app::libs::libs;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "control_id", "nn_sessionid"] {
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
        let arg_2: String = o.get_string("nn_sessionid");
        get_publish_context(arg_0, arg_1, arg_2)
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

pub fn get_publish_context(lib: String, control_id: String, nn_sessionid: String) -> DataObject {
let ctl = app_read(lib.clone(), control_id.clone(), nn_sessionid.clone()).get_object("data");

// Construct the payload expected by the appdata() function
let mut ad_req = DataObject::new();
ad_req.put_string("name", &ctl.get_string("name"));
ad_req.put_string("db", &lib);
ad_req.put_string("ctl", &control_id);

let props = appdata(ad_req); 
let system_libraries = libs();

let mut res = DataObject::new();

// Transfer ownership of props and system_libraries into the return object
res.put_object("properties", props);
res.put_array("system_libraries", system_libraries);

res
}
