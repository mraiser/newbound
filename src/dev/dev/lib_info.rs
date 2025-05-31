use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use std::fs;

pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("lib");
  let ax = lib_info(arg_0);
  let mut result_obj = DataObject::new();
  result_obj.put_object("a", ax);
  result_obj
}

pub fn lib_info(lib: String) -> DataObject {
let filename = lib + ".json";
let file_path = DataStore::new().root.parent().unwrap().join("runtime").join("dev").join("libraries").join(&filename);
let json = fs::read_to_string(file_path).expect("Should have been able to read the file");
DataObject::from_string(&json)
}
