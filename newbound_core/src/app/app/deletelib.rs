use ndata::dataobject::DataObject;
use std::fs;
use flowlang::datastore::*;
use flowlang::appserver::init_globals;
pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("lib");
    let ax = deletelib(arg_0);
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn deletelib(lib: String) -> String {
let store = DataStore::new();
let path = store.root.join(&lib);
if path.exists() { let _ = fs::remove_dir_all(&path).unwrap(); }
init_globals();
"OK".to_string()
}
