use ndata::dataobject::DataObject;
use crate::peer::service::listen::P2PConnection;
pub fn execute(o: DataObject) -> DataObject {
    let arg_0: DataObject = o.get_object("user");
    let ax = session_expire(arg_0);
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn session_expire(user: DataObject) -> DataObject {
//FIXME - Param should be sessionid not user. Don't kill all their cons because a session died!!!
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
