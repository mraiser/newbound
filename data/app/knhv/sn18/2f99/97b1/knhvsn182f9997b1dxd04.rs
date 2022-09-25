let system = DataStore::globals().get_object("system");
let mut o = system.get_object("config");
let mut b = false;
if !settings.clone().is_null(){
  for (k,v) in DataObject::from_string(&Data::as_string(settings)).objects() {
    o.set_property(&k,v);
    b = true;
  }
}
if b {
  let mut o = o.deep_copy();
  o.remove_property("socket_address");
  if o.has("security") {
    if o.get_bool("security") { o.put_str("security", "on"); }
    else { o.put_str("security", "off"); }
  }
  write_properties("config.properties".to_string(), o.duplicate()); 
  init_globals();
}

o