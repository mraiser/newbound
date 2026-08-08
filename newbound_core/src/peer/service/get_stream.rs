use ndata::dataobject::DataObject;
use ndata::databytes::DataBytes;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;
use core::time::Duration;
use std::thread;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["uuid", "stream_id"] {
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
        let arg_1: i64 = o.get_int("stream_id");
        get_stream(arg_0, arg_1)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_bytes("a", ax);
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

pub fn get_stream(uuid: String, stream_id: i64) -> DataBytes {
let mut timeout = 0;
while timeout < 246 {
  let user = get_user(&uuid);
  if user.is_some() {
    let user = user.unwrap();
	let con = get_best(user.clone());
    if con.is_some() {
      let mut con = con.unwrap();
      return con.join_stream(stream_id);
    }
  }
  timeout += 1;
  let beat = Duration::from_millis(timeout);
  thread::sleep(beat);
}
panic!("NO SUCH STREAM! {}/{}", stream_id, uuid);
}
