use ndata::dataobject::*;
use ndata::dataarray::DataArray;
use crate::peer::service::listen::P2PHEAP;
use std::net::Shutdown;use flowlang::appserver::fire_event;
use crate::peer::peer::peers::user_to_peer;

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
    let mut connections = user.get_array("connections");
    println!("Peer {} session expire, cons {}", username, connections.to_string());
    for con in connections.objects(){
      let conid = con.int();
      let con = P2PHEAP.get().write().unwrap().get(conid as usize).duplicate();
      con.shutdown(&username, conid).expect("shutdown call failed");
    }
  }
}
DataObject::new()
}

