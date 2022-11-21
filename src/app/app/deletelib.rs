use ndata::dataobject::*;
use std::fs;
use flowlang::datastore::*;
use flowlang::appserver::init_globals;
pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let ax = deletelib(a0);
let mut o = DataObject::new();
o.put_string("a", &ax);
o
}

pub fn deletelib(lib:String) -> String {
let store = DataStore::new();
let path = store.root.join(&lib);
if path.exists() { let _ = fs::remove_dir_all(&path).unwrap(); }
init_globals();
"OK".to_string()
}

