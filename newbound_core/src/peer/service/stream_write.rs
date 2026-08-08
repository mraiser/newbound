use ndata::dataobject::DataObject;
use ndata::databytes::DataBytes;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;
use core::time::Duration;
use std::thread;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["uuid", "stream_id", "data"] {
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
        let arg_2: DataBytes = o.get_bytes("data");
        stream_write(arg_0, arg_1, arg_2)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_boolean("a", ax);
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

pub fn stream_write(uuid: String, stream_id: i64, data: DataBytes) -> bool {
let user = get_user(&uuid).unwrap();

let mut timeout = 0;
while timeout < 500 {
  let con = get_best(user.clone());
  if con.is_some() {
    let mut con = con.unwrap();
	let v = data.get_data();
	return con.write_stream(stream_id, &v);
  }
  timeout += 1;
  if timeout > 500 { println!("Unable to write to stream {}", stream_id); return false; }
  let beat = Duration::from_millis(timeout);
  thread::sleep(beat);
}
false
}
