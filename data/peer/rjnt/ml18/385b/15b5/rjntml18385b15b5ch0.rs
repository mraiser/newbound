let users = users();
for (uuid, user) in users.objects(){
  let user = user.object();
  if user.has("keepalive") && Data::as_string(user.get_property("keepalive")) == "true" && user.get_array("connections").len() == 0 {
    println!("CONNECT TO {}", user.to_string());
    if user.has("address") && user.has("port") {
      let ipaddr = user.get_string("address");
      let port = Data::as_string(user.get_property("port")).parse::<i64>().unwrap();
      tcp_connect(uuid, ipaddr, port);
    }
  }
}
DataObject::new()