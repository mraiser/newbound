use ndata::dataobject::DataObject;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;

pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("uuid");
  let arg_1: i64 = o.get_int("streamid");
  let arg_2: bool = o.get_boolean("write");
  let ax = close_stream(arg_0, arg_1, arg_2);
  let mut result_obj = DataObject::new();
  result_obj.put_object("a", ax);
  result_obj
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
