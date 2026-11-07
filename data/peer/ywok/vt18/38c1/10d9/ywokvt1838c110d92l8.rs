  let users = DataStore::globals().get_object("system").get_object("users");
  let mut peers = DataArray::new();
  for (id, o) in users.objects(){
    if id.len() == 36 {
      peers.push_object(user_to_peer(o.object(), id));
    }
  }

  peers
}
/*
pub fn get_relays(id:String) -> DataArray {
  let users = DataStore::globals().get_object("system").get_object("users");
  let mut v = DataArray::new();
  for (uuid, user) in users.objects(){
    if uuid != id {
      let user = user.object();
      if user.has("peers"){
        let peers = user.get_object("peers");
        if peers.has(&id) && peers.get_string(&id).starts_with("tcp#") {
          v.push_str(&uuid);
        }
      }
    }
  }
  v
}
*/
pub fn user_to_peer(o:DataObject, id:String) -> DataObject {
  let mut o = o.deep_copy();
  o.remove_property("password");
  // publickey stays: a peer's public key is public by design (anyone connecting needs it); only privatekey must never leave the machine, and it never appears in a user record.
  o.put_string("id", &id);
  o.put_string("name", &o.get_string("displayname"));
  
  // One lookup per transport (the old code called each twice - once for the
  // flag, and the connection was needed again for last_contact).
  let tcpc = get_tcp(o.clone());
  let udpc = get_udp(o.clone());
  let relayc = get_relay(o.clone());
  let now = flowlang::flowlang::system::time::time();
  let tcp = tcpc.as_ref().map(|c| c.alive.load(std::sync::atomic::Ordering::SeqCst) && now - c.last_contact() < 120000).unwrap_or(false);
  let udp = udpc.is_some();
  let relay = relayc.is_some();
  let connected = tcp || udp || relay;

  // last_contact is a real receive timestamp on every transport. A quiet or
  // half-open TCP connection therefore ages normally and can be recovered.
  let last_contact = match (&tcpc, &udpc, &relayc) {
    (Some(c), _, _) => c.last_contact(),
    (_, Some(c), _) => c.last_contact(),
    (_, _, Some(c)) => c.last_contact(),
    _ => 0,
  };

  let live_connections = o.get_array("connections").deep_copy();
  o.put_array("connections", live_connections);
  o.put_boolean("tcp", tcp);  
  o.put_boolean("udp", udp);  
  o.put_boolean("relay", relay);  
  o.put_boolean("connected", connected);  
  o.put_int("last_contact", last_contact);

  // F13: a dialled-in peer's saved address is empty - report the IP actually
  // on the wire. TCP first (matching last_contact), then UDP; relay has no
  // peer_addr, so the field stays absent there.
  if let Some(c) = tcpc.as_ref().or(udpc.as_ref()) {
    if let Ok(addr) = c.stream.peer_addr() {
      o.put_string("remote_address", &addr.ip().to_string());
    }
  }

  o