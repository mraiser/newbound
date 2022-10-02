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
    thread::spawn(move || {
      let t1 = time();
      let o = exec(user.get_string("id"), "peer".to_string(), "info".to_string(), DataObject::new());
      if o.get_string("status") == "ok" {
        let o = o.get_object("data");
        let t2 = time();
        let l = t2 - t1;
        user.put_i64("latency", l);
        if !user.has("addresses") { user.put_array("addresses", DataArray::new()); }
        let addrs = user.get_array("addresses");
        let v = o.get_array("addresses");
        for a in v.objects(){
          addrs.push_unique(a);
        }
        user.put_str("displayname", &o.get_string("name"));
        user.put_str("session_id", &o.get_string("session_id"));
        user.put_i64("http_port", o.get_i64("http_port"));
        user.put_i64("p2p_port", o.get_i64("p2p_port"));
        fire_event("peer", "UPDATE", user_to_peer(user, uuid));
      }
    });
  }
}
DataObject::new()