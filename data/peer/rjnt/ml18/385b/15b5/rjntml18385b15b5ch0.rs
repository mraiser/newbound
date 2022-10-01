let users = users();
for (uuid, user) in users.objects(){
  let mut user = user.object();
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
    let t1 = time();
    let o = exec(user.get_string("id"), "peer".to_string(), "info".to_string(), DataObject::new());
    let t2 = time();
    let l = t2 - t1;
    user.put_i64("latency", l);
    if !user.has("addresses") { user.put_array("addresses", DataArray::new()); }
    let addrs = user.get_array("addresses");
    let v = user.get_array("addresses");
    for a in v.objects(){
      addrs.push_unique(a);
    }
    fire_event("peer", "UPDATE", user_to_peer(user, uuid));
  }
}
DataObject::new()