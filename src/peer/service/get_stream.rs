use ndata::dataobject::*;
use ndata::databytes::DataBytes;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;
use core::time::Duration;
use std::thread;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_int("stream_id");
let ax = get_stream(a0, a1);
let mut o = DataObject::new();
o.put_bytes("a", ax);
o
}

pub fn get_stream(uuid:String, stream_id:i64) -> DataBytes {
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

