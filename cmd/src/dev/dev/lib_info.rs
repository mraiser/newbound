use ndata::dataobject::*;
use flowlang::datastore::DataStore;
use std::fs;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let ax = lib_info(a0);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn lib_info(lib:String) -> DataObject {
let filename = lib + ".json";
let file_path = DataStore::new().root.parent().unwrap().join("runtime").join("dev").join("libraries").join(&filename);
let json = fs::read_to_string(file_path).expect("Should have been able to read the file");
DataObject::from_string(&json)
}

