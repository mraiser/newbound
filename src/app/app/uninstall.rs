use ndata::dataobject::*;
use std::fs;
use flowlang::datastore::DataStore;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("app");
let ax = uninstall(a0);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn uninstall(app:String) -> String {
let path = DataStore::new().root.parent().unwrap().join("runtime").join(&app);
let _x = fs::remove_dir_all(path).unwrap();
"OK".to_string()
}

