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