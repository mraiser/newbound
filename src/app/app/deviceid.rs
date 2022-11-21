use ndata::dataobject::*;
use flowlang::datastore::DataStore;

pub fn execute(_o: DataObject) -> DataObject {
let ax = deviceid();
let mut o = DataObject::new();
o.put_string("a", &ax);
o
}

pub fn deviceid() -> String {
let system = DataStore::globals().get_object("system");
let o = system.get_object("apps").get_object("app").get_object("runtime");
o.get_string("uuid")
}

