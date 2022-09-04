let system = DataStore::globals().get_object("system");
let mut o = system.get_object("config");
o.remove_property("socket_address");
let mut b = false;
for (k,v) in settings.objects() {
  o.set_property(&k,v);
  b = true;
}
if b { 
  write_properties("config.properties".to_string(), o.duplicate()); 
  init_globals();
}

o