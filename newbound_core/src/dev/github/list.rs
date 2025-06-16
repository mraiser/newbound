use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use std::path::Path;

pub fn execute(_: DataObject) -> DataObject {
    let ax = list();
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn list() -> DataObject {
let mut a = DataArray::new();

let repodir = Path::new("repositories");
if repodir.exists() {
  for libdir in std::fs::read_dir(&repodir).unwrap() {
    let libdir = libdir.unwrap();
    let libid = libdir.file_name().into_string().unwrap();
    if libdir.path().join("data").exists(){
      a.push_string(&libid);
    }
  }
}

let mut d = DataObject::new();
d.put_array("list", a);
d
}
