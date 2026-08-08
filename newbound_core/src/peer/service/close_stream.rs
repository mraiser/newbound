use ndata::dataobject::DataObject;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["uuid", "streamid", "write"] {
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
        let arg_0: String = o.get_string("uuid");
        let arg_1: i64 = o.get_int("streamid");
        let arg_2: bool = o.get_boolean("write");
        close_stream(arg_0, arg_1, arg_2)
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

pub fn close_stream(uuid: String, streamid: i64, write: bool) -> DataObject {
let user = get_user(&uuid).unwrap();
let con = get_best(user.clone());
if con.is_some() {
  let mut con = con.unwrap();
  if write {
    con.end_stream_write(streamid);
  }
  else {
    con.end_stream_read(streamid);
  }
}
DataObject::new()
}
