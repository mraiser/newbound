let mut g = DataStore::globals();

let mut o = DataObject::new();

let a = match g.has("network_interfaces") && time() - g.get_object("network_interfaces").get_int("timestamp") < 30000 {
  true => g.get_object("network_interfaces").get_array("list"),
  false => {
    let mut a = DataArray::new();

    let network_interfaces = list_afinet_netifas().unwrap();
    for (_name, ip) in network_interfaces.iter() {
      let s = ip.to_string();
      if s != "127.0.0.1" && s != "::1" {
        a.push_string(&s);
      }
    }
    let mut wrap = DataObject::new();
    wrap.put_array("list", a.clone());
    wrap.put_int("timestamp", time());
    g.put_object("network_interfaces", wrap);
    a
  }
};

//println!("ADDRESSES {}", a.to_string());

o.put_array("addresses", a.clone());

{
  let system = g.get_object("system");
  let name = system.get_object("config").get_string("machineid");
  let http_port = Data::as_string(system.get_object("config").get_property("http_port")).parse::<i64>().unwrap();
  let port = Data::as_string(system.get_object("apps").get_object("peer").get_object("runtime").get_property("port")).parse::<i64>().unwrap();
  let id = system.get_object("apps").get_object("app").get_object("runtime").get_string("uuid");
  o.put_string("name", &name);
  o.put_string("uuid", &id);
  o.put_string("session_id", &nn_sessionid);
  o.put_int("p2p_port", port);
  o.put_int("http_port", http_port);
}
let mut cons = DataObject::new();
o.put_object("connections", cons.clone());

if uuid.is_array() || (uuid.is_string() && uuid.string().starts_with("[")) {
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
      //println!("INFO hash {} {}", uuid, hash);
      map.insert(hash, user.object());
    }
  }
  
  for uhash in DataArray::from_string(&Data::as_string(uuid)).objects() {
    let uhash = uhash.string();
    let u = map.get(&uhash);
    if u.is_some(){
      let u = u.unwrap();
      let uuid = u.get_string("id");
      let mut p = user_to_peer(u.clone(), uuid.to_owned());
      if p.has("p2pport") && !p.has("p2p_port") { p.set_property("p2p_port", p.get_property("p2pport")); }
      if p.has("p2p_port") && p.has("address") && p.get_boolean("tcp") { cons.put_string(&uuid, &("tcp#".to_string()+&p.get_string("address")+"#"+&Data::as_string(p.get_property("p2p_port")))); }
      else if p.has("p2p_port") && p.has("address") && p.get_boolean("udp") { cons.put_string(&uuid, &("udp#".to_string()+&p.get_string("address")+"#"+&Data::as_string(p.get_property("p2p_port")))); }
      else if p.get_boolean("relay") { cons.put_string(&uuid, "relay#"); }
    }
  }
}

o