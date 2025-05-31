use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;

pub fn execute(_: DataObject) -> DataObject {
  let ax = discovery();
  let mut result_obj = DataObject::new();
  result_obj.put_object("a", ax);
  result_obj
}

pub fn discovery() -> DataObject {
let system = DataStore::globals().get_object("system");
system.get_object("discovery")
}
