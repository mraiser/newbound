  let system = DataStore::globals().get_object("system");
  let users = system.get_object("users");
  let mut peers = DataArray::new();
  for (id, o) in users.objects(){
    if id.len() == 36 {
      peers.push_object(user_to_peer(o.object(), id));
    }
  }

  peers
}

pub fn user_to_peer(o:DataObject, id:String) -> DataObject {
  let mut o = o.deep_copy();
  o.remove_property("password");
  o.remove_property("publickkey");
  o.put_str("id", &id);
  let connected = o.get_array("connections").len()>0;
  o.put_bool("connected", connected);  
  if connected { o.put_bool("tcp", true); }
  else { o.put_bool("tcp", false); }
  o.put_bool("udp", false);
  o