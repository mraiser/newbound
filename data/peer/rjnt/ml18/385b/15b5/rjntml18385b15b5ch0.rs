let users = users();
for (uuid, user) in users.objects(){
  let user = user.object();
  if user.get_array("connections").len() == 0 {
    if user.has("keepalive") && Data::as_string(user.get_property("keepalive")) == "true" {
      if user.has("address") && user.has("port") {
        let ipaddr = user.get_string("address");
        let port = Data::as_string(user.get_property("port")).parse::<i64>().unwrap();
        thread::spawn(move || {
          tcp_connect(uuid, ipaddr, port);
        });
      }
    }
  }
  else {
    let o = exec(user.get_string("id"), "peer".to_string(), "info".to_string(), DataObject::new());
    println!("maint {}", o.to_string());
  }
}
DataObject::new()