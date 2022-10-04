let users = users();
let mut ask = DataArray::new();
for (uuid, user) in users.objects(){
  if uuid.len() == 36 {
    let user = user.object();
    if user.get_array("connections").len() == 0 {
      if user.has("keepalive") && Data::as_string(user.get_property("keepalive")) == "true" {
        ask.push_str(&uuid);
        if user.has("address") && user.has("port") {
          let ipaddr = user.get_string("address");
          let port = Data::as_string(user.get_property("port")).parse::<i64>().unwrap();
          thread::spawn(move || {
            tcp_connect(uuid, ipaddr, port);
          });
        }
      }
    }
  }
}

let adr = ask.data_ref;
for (uuid, user) in users.objects(){
  if uuid.len() == 36 {
    let mut user = user.object();
    if user.get_array("connections").len() > 0 {
      thread::spawn(move || {
        let ask = DataArray::get(adr);
        let t1 = time();
        let mut d = DataObject::new();
        d.put_array("uuid", ask);
        let o = exec(user.get_string("id"), "peer".to_string(), "info".to_string(), d);
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
          
          let cons = o.get_object("connections");
          user.put_object("peers", cons.duplicate());
          
          let mut users = DataStore::globals().get_object("system").get_object("users");
          for (uuid2,_u) in users.objects() {
            if (uuid2.len() == 36 && uuid != uuid2) {
              let b = cons.has(&uuid2) && cons.get_string(&uuid2).starts_with("tcp#");
              relay(&uuid, &uuid2, b);
            }
          }
          
          // Fixme - notify if something changes (latency?)
          fire_event("peer", "UPDATE", user_to_peer(user, uuid));
        }
      });
    }
    else {
      let mut users = DataStore::globals().get_object("system").get_object("users");
      for (uuid2,_u) in users.objects() {
        if (uuid2.len() == 36 && uuid != uuid2) {
          relay(&uuid, &uuid2, false);
        }
      }
      // FIXME - notify on relay add
      fire_event("peer", "UPDATE", user_to_peer(user, uuid));
    }
  }
}
"OK".to_string()