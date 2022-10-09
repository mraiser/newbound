let mut o = DataObject::new();
let mut a = DataArray::new();
o.put_array("addresses", a.duplicate());

let network_interfaces = list_afinet_netifas().unwrap();
for (_name, ip) in network_interfaces.iter() {
  let s = ip.to_string();
  if s != "127.0.0.1" && s != "::1" {
    a.push_str(&s);
  }
}

let system = DataStore::globals().get_object("system");
let name = system.get_object("config").get_string("machineid");
let http_port = Data::as_string(system.get_object("config").get_property("http_port")).parse::<i64>().unwrap();
let port = system.get_object("apps").get_object("peer").get_object("runtime").get_i64("port");
let id = system.get_object("apps").get_object("app").get_object("runtime").get_string("uuid");
o.put_str("name", &name);
o.put_str("uuid", &id);
o.put_str("session_id", &nn_sessionid);
o.put_i64("p2p_port", port);
o.put_i64("http_port", http_port);

let mut cons = DataObject::new();
o.put_object("connections", cons.duplicate());

if !salt.clone().is_null(){
  let salt = salt.string();
  let users = users();
  let mut map = HashMap::new();
  for (uuid, user) in users.objects() {
    if uuid.len() == 36 {
      let mut hasher = Blake2b80::new();
      hasher.update(salt.to_owned().as_bytes());
      hasher.update(uuid.as_bytes());
      let res = hasher.finalize();
      let hash = to_hex(&res);
      map.insert(&salt, user.object());
    }
  }
  
  for uhash in DataArray::from_string(&Data::as_string(uuid)).objects() {
    let uhash = uhash.string();
    let u = map.get(&uhash);
    if u.is_some(){
      let u = u.unwrap();
      let uuid = u.get_string("id");
      let p = user_to_peer(u.duplicate(), uuid.to_owned());
      if p.get_bool("tcp") { cons.put_str(&uuid, &("tcp#".to_string()+&p.get_string("address")+"#"+&p.get_i64("p2p_port").to_string())); }
      else if p.get_bool("udp") { cons.put_str(&uuid, &("udp#".to_string()+&p.get_string("address")+"#"+&p.get_i64("p2p_port").to_string())); }
      else if p.get_bool("relay") { cons.put_str(&uuid, "relay#"); }
    }
  }
}

o