use ndata::dataobject::*;
use ndata::dataarray::DataArray;
use std::path::Path;

pub fn execute(_o: DataObject) -> DataObject {
let ax = list();
let mut o = DataObject::new();
o.put_object("a", ax);
o
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

