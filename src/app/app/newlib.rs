use ndata::dataobject::DataObject;
use std::fs;
use ndata::dataarray::*;
use flowlang::datastore::*;
use flowlang::appserver::load_library;
use flowlang::flowlang::*;
pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("lib");
  let arg_1: DataArray = o.get_array("readers");
  let arg_2: DataArray = o.get_array("writers");
  let ax = newlib(arg_0, arg_1, arg_2);
  let mut result_obj = DataObject::new();
  result_obj.put_string("a", &ax);
  result_obj
}

pub fn newlib(lib: String, readers: DataArray, writers: DataArray) -> String {
let store = DataStore::new();
let path = store.root.join(&lib);
if !path.exists() { let _ = fs::create_dir_all(&path).unwrap(); }

let mut meta = DataObject::new();
meta.put_string("username", "system");
meta.put_array("readers", readers);
meta.put_array("writers", writers);

let path2 = path.join("meta.json");
fs::write(path2, meta.to_string()).expect("Unable to write file");

load_library(&lib);
data::write::write(lib.to_owned(), "tasklists".to_string(), DataObject::new(), DataArray::new(), DataArray::new());

let mut controls = DataObject::new();
controls.put_array("list", DataArray::new());
data::write::write(lib.to_owned(), "controls".to_string(), controls, DataArray::new(), DataArray::new());

let path2 = path.join("_ASSETS");
let _ = fs::create_dir_all(&path2).unwrap();

"OK".to_string()
}
