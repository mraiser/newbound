let pollx2 = 60000;

// Kill any connection with no response over 2x poll period
let mut live = Vec::new();
{
  let now = time();
  let pcons = P2PConnection::list();
  for id in pcons {
    let con = P2PConnection::get(id);
    if con.last_contact() < now - pollx2 {
      let _x = con.shutdown(&con.uuid, id as i64);
    }
    else { live.push(con.duplicate()); }
  }
}

// Ping every connected user and update user data
// If keepalive but no live connection, connect TCP
// Upgrade relay to UDP
// Upgrade UDP to TCP

let users = users();
let mut ask = DataArray::new();
let salt = unique_session_id();

for (uuid, user) in users.objects(){
  if uuid.len() == 36 {
    let user = user.object();
    
    let mut hasher = Blake2b80::new();
    hasher.update(salt.as_bytes());
    hasher.update(uuid.as_bytes());
    let res = hasher.finalize();
    let hash = to_hex(&res);
    ask.push_string(&hash);
    
    if get_tcp(user.clone()).is_none() {
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
  }
}

let adr = ask.data_ref;
for (uuid, user) in users.objects(){
  if uuid.len() == 36 {
    let mut user = user.object();
    if user.get_array("connections").len() > 0 {
      user.put_boolean("connected", true);
      let salt = salt.to_owned();
      thread::spawn(move || {
        let system = DataStore::globals().get_object("system");
        
        let ask = DataArray::get(adr);
        let t1 = time();
        let mut d = DataObject::new();
        d.put_array("uuid", ask);
        d.put_string("salt", &salt);
        let o = exec(user.get_string("id"), "peer".to_string(), "info".to_string(), d);
        if o.get_string("status") == "ok" {
          let o = o.get_object("data");
          let t2 = time();
          let l = t2 - t1;
          user.put_int("latency", l);
          if !user.has("addresses") { user.put_array("addresses", DataArray::new()); }
          let addrs = user.get_array("addresses");
          let v = o.get_array("addresses");
          for a in v.objects(){
            addrs.push_unique(a);
          }
          user.put_string("displayname", &o.get_string("name"));
          user.put_string("session_id", &o.get_string("session_id"));
          user.put_int("http_port", o.get_int("http_port"));
          user.put_int("p2p_port", o.get_int("p2p_port"));
          
          let cons = o.get_object("connections");
          user.put_object("peers", cons.clone());
          
          if get_tcp(user.clone()).is_some() {
            let users = system.get_object("users");
            for (uuid2,u) in users.objects() {
              let b = u.object().has("connected") && Data::as_string(u.object().get_property("connected")).parse::<bool>().unwrap();
              if uuid2.len() == 36 && uuid != uuid2 && !b {
                let b = cons.has(&uuid2) && cons.get_string(&uuid2).starts_with("tcp#");
                if b { relay(&uuid, &uuid2, b); }
              }
            }
          }        
          // Fixme - notify if something changes (latency?)
          fire_event("peer", "UPDATE", user_to_peer(user, uuid));
        }
      });
    }
    else {
      user.put_boolean("connected", false);
      // Fixme - notify if something changes (latency?)
      fire_event("peer", "UPDATE", user_to_peer(user, uuid));
    }
  }
}

"OK".to_string()