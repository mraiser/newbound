use ndata::dataobject::*;
use ndata::databytes::DataBytes;
use crate::peer::service::listen::get_best;
use flowlang::appserver::get_user;
use crate::peer::service::exec::exec;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("nn_path");
let a1 = o.get_object("nn_params");
let a2 = o.get_object("nn_headers");
let ax = remote(a0, a1, a2);
let mut o = DataObject::new();
o.put_bytes("a", ax);
o
}

pub fn remote(nn_path:String, nn_params:DataObject, nn_headers:DataObject) -> DataBytes {
let uuid = &nn_path[13..49];
let path = &nn_path[49..];
let user = get_user(uuid).unwrap();
let mut con = get_best(user).unwrap();
let sessionid = con.sessionid.to_owned();

let mut d = DataObject::new();
d.put_str("path", path);
d.put_str("sessionid", &sessionid);
d.put_object("params", nn_params);
d.put_object("headers", nn_headers);

let mut o = DataObject::new();
o.put_object("request", d);

println!("initiating remote command");
let d = exec(uuid.to_string(), "peer".to_string(), "local".to_string(), o);
println!("received remote command result {}", d.to_string());
let d = d.get_object("data");
if d.has("stream_id") {
  let id = d.get_i64("stream_id");
  return con.join_stream(id);
}
if d.has("body") {
  return DataBytes::from_bytes(&d.get_string("body").as_bytes().to_vec());
}
DataBytes::from_bytes(&"404".as_bytes().to_vec())
}

