use ndata::dataobject::DataObject;
use ndata::databytes::DataBytes;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;
use core::time::Duration;
use std::thread;

pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("uuid");
  let arg_1: i64 = o.get_int("stream_id");
  let arg_2: DataBytes = o.get_bytes("data");
  let ax = stream_write(arg_0, arg_1, arg_2);
  let mut result_obj = DataObject::new();
  result_obj.put_boolean("a", ax);
  result_obj
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
