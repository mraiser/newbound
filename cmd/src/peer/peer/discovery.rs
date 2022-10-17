use ndata::dataobject::*;
use flowlang::datastore::DataStore;

pub fn execute(_o: DataObject) -> DataObject {
let ax = discovery();
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn discovery() -> DataObject {
let system = DataStore::globals().get_object("system");
system.get_object("discovery")
}

