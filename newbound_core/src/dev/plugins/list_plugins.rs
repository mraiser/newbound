use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;

pub fn execute(_: DataObject) -> DataObject {
    let ax = list_plugins();
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn list_plugins() -> DataObject {
let path = DataStore::new().root.parent().unwrap().join("runtime").join("dev").join("plugins.json");
if !path.exists() { 
  return DataObject::new(); 
}
DataObject::from_string(&std::fs::read_to_string(&path).unwrap())
}
