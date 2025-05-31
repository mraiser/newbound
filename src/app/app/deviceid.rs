use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;

pub fn execute(_: DataObject) -> DataObject {
  let ax = deviceid();
  let mut result_obj = DataObject::new();
  result_obj.put_string("a", &ax);
  result_obj
}

pub fn deviceid() -> String {
let system = DataStore::globals().get_object("system");
let o = system.get_object("apps").get_object("app").get_object("runtime");
o.get_string("uuid")
}
