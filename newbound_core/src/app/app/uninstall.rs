use ndata::dataobject::DataObject;
use std::fs;
use flowlang::datastore::DataStore;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("app");
    let ax = uninstall(arg_0);
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn uninstall(app: String) -> String {
let path = DataStore::new().root.parent().unwrap().join("runtime").join(&app);
let _x = fs::remove_dir_all(path).unwrap();
"OK".to_string()
}
