use ndata::dataobject::*;
use crate::peer::service::listen::P2PConnection;
pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_object("user");
let ax = session_expire(a0);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn session_expire(user:DataObject) -> DataObject {
if user.has("id") {
  let username = user.get_string("id");
  if username.len() == 36 {
    let connections = user.get_array("connections");
    println!("Peer {} session expire, cons {}", username, connections.to_string());
    for con in connections.objects(){
      let conid = con.int();
      let con = P2PConnection::get(conid).duplicate();
      con.shutdown(&username, conid).expect("shutdown call failed");
    }
  }
}
DataObject::new()
}

