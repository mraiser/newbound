use ndata::dataobject::*;
use flowlang::datastore::DataStore;
use flowlang::generated::flowlang::file::write_properties::write_properties;
use flowlang::appserver::init_globals;


pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_object("settings");
let ax = settings(a0);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn settings(settings:DataObject) -> DataObject {
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
}

