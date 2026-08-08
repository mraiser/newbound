use ndata::dataobject::DataObject;
use flowlang::flowlang::*;
use ndata::dataarray::DataArray;
use ndata::data::Data;
use crate::security::security::init::check_auth;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "id", "data", "readers", "writers", "nn_sessionid"] {
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
        let arg_1: Data = o.get_property("id");
        let arg_2: DataObject = o.get_object("data");
        let arg_3: Data = o.get_property("readers");
        let arg_4: Data = o.get_property("writers");
        let arg_5: String = o.get_string("nn_sessionid");
        write(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5)
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

pub fn write(lib: String, id: Data, data: DataObject, readers: Data, writers: Data, nn_sessionid: String) -> DataObject {
let tid = id;
let id;
if tid.clone().is_null() { id = system::unique_session_id::unique_session_id(); }
else { id = tid.string(); }

let tid = readers;
let readers;
if tid.clone().is_null() { readers = DataArray::new(); }
else { readers = DataArray::from_string(&Data::as_string(tid)); }

let tid = writers;
let writers;
if tid.clone().is_null() { writers = DataArray::new(); }
else { writers = DataArray::from_string(&Data::as_string(tid)); }

if check_auth(&lib, &id, &nn_sessionid, false) {
  return data::write::write(lib, id, data, readers, writers);
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")
}
