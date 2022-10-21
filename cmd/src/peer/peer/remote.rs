use ndata::dataobject::*;
use ndata::databytes::DataBytes;
use crate::peer::service::listen::get_best;
use flowlang::appserver::get_user;
use crate::peer::service::exec::exec;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("nn_path");
let a1 = o.get_string("nn_sessionid");
let a2 = o.get_object("nn_params");
let a3 = o.get_object("nn_headers");
let ax = remote(a0, a1, a2, a3);
let mut o = DataObject::new();
o.put_bytes("a", ax);
o
}

pub fn remote(nn_path:String, nn_sessionid:String, nn_params:DataObject, nn_headers:DataObject) -> DataBytes {
let uuid = &nn_path[13..49];
let path = &nn_path[49..];
let user = get_user(uuid).unwrap();
let con = get_best(user).unwrap();
let sessionid = con.sessionid.to_owned();

let mut d = DataObject::new();
d.put_str("path", path);
d.put_str("sessionid", &sessionid);
d.put_object("params", nn_params);
d.put_object("headers", nn_headers);

let mut o = DataObject::new();
o.put_object("request", d);

let d = exec(uuid.to_string(), "peer".to_string(), "local".to_string(), o);

DataBytes::from_bytes(&d.to_string().as_bytes().to_vec())
}

