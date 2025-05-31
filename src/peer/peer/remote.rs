use ndata::dataobject::DataObject;
use ndata::databytes::DataBytes;
use crate::peer::service::listen::get_best;
use crate::peer::service::exec::exec;
use crate::security::security::init::get_user;
pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("nn_path");
  let arg_1: DataObject = o.get_object("nn_params");
  let arg_2: DataObject = o.get_object("nn_headers");
  let ax = remote(arg_0, arg_1, arg_2);
  let mut result_obj = DataObject::new();
  result_obj.put_bytes("a", ax);
  result_obj
}

pub fn remote(nn_path: String, nn_params: DataObject, nn_headers: DataObject) -> DataBytes {
let uuid = &nn_path[13..49];
let path = &nn_path[49..];
let user = get_user(uuid).unwrap();

let mut d = DataObject::new();
d.put_string("path", path);
if user.has("session_id") { d.put_string("sessionid", &user.get_string("session_id")); }
d.put_object("params", nn_params.clone());
d.put_object("headers", nn_headers);

let mut o = DataObject::new();
o.put_object("request", d);

let d = exec(uuid.to_string(), "peer".to_string(), "local".to_string(), o);
if d.has("data"){
  let d = d.get_object("data");
  if d.has("stream_id") {
    let id = d.get_int("stream_id");
    let mut con = get_best(user.clone()).unwrap();
    return con.join_stream(id);
  }
  if d.has("body") {
    let body = d.get_string("body");
    let s;
    if nn_params.has("callback") {
      s = nn_params.get_string("callback") + "(" + &body + ")";
    }
    else {
      s = body;
    }
    let x = DataBytes::from_bytes(&s.as_bytes().to_vec());
    if d.has("mimetype") { x.set_mime_type(Some(d.get_string("mimetype"))); }
    return x;
  }
}
DataBytes::from_bytes(&"404".as_bytes().to_vec())
}
