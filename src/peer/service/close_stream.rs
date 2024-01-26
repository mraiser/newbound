use ndata::dataobject::*;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_int("streamid");
let a2 = o.get_boolean("write");
let ax = close_stream(a0, a1, a2);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn close_stream(uuid:String, streamid:i64, write:bool) -> DataObject {
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

