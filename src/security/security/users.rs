use ndata::dataobject::*;
use flowlang::datastore::DataStore;

pub fn execute(_o: DataObject) -> DataObject {
let ax = users();
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn users() -> DataObject {
let system = DataStore::globals().get_object("system");
system.get_object("users")
}

