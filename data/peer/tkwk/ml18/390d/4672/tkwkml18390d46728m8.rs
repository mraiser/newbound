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
let uuid = system.get_object("apps").get_object("app").get_object("runtime").get_string("uuid");
o.put_str("name", &name);
o.put_str("uuid", &uuid);
o.put_str("session_id", &nn_sessionid);
o.put_i64("p2p_port", port);
o.put_i64("http_port", http_port);

o