let system = DataStore::globals().get_object("system");
let users = system.get_object("users");
let mut peers = DataArray::new();
for (id, o) in users.objects(){
  if id.len() == 36 {
    let mut o = o.object().deep_copy();
    o.remove_property("password");
    o.remove_property("publickkey");
    o.put_str("id", &id);
    peers.push_object(o);
  }
}

peers