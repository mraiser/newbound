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
  o.remove_property("publickkey");
  o.put_str("id", &id);
  o.put_str("name", &o.get_string("displayname"));
  
  // FIXME - Each call gets the same lock
  let tcp = get_tcp(o.duplicate()).is_some();
  let udp = get_udp(o.duplicate()).is_some();
  let relay = get_relay(o.duplicate()).is_some();
  let connected = tcp || udp || relay;
  
  o.put_bool("tcp", tcp);  
  o.put_bool("udp", udp);  
  o.put_bool("relay", relay);  
  o.put_bool("connected", connected);  

  o