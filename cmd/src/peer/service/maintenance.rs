use ndata::dataobject::*;
use crate::security::security::users::users;
use ndata::data::Data;
use crate::peer::service::tcp_connect::tcp_connect;

pub fn execute(_o: DataObject) -> DataObject {
let ax = maintenance();
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn maintenance() -> DataObject {
let users = users();
for (uuid, user) in users.objects(){
  let user = user.object();
  if user.has("keepalive") && Data::as_string(user.get_property("keepalive")) == "true" && user.get_array("connections").len() == 0 {
    if user.has("address") && user.has("port") {
      let ipaddr = user.get_string("address");
      let port = Data::as_string(user.get_property("port")).parse::<i64>().unwrap();
      tcp_connect(uuid, ipaddr, port);
    }
  }
}
DataObject::new()
}

