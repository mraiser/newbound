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
    if o.get_boolean("security") { o.put_string("security", "on"); }
    else { o.put_string("security", "off"); }
  }
  write_properties("config.properties".to_string(), o.clone()); 
  init_globals();
}

o