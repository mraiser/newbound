use ndata::dataobject::*;
use ndata::dataarray::DataArray;
use flowlang::datastore::DataStore;
use std::fs;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let ax = assets(a0);
let mut o = DataObject::new();
o.put_array("a", ax);
o
}

pub fn assets(lib:String) -> DataArray {
let store = DataStore::new();
let mut a = DataArray::new();

let p = store.root.join(&lib).join("_ASSETS");
for file in fs::read_dir(&p).unwrap() {
  let path = file.unwrap().path();
  let name:String = path.file_name().unwrap().to_str().unwrap().to_string();
  a.push_string(&name);
}
a
}

