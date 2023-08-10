use ndata::dataobject::*;
use flowlang::flowlang::data::exists::exists;
use flowlang::flowlang::data::read::read;
use ndata::dataarray::DataArray;
use flowlang::flowlang::data::write::write;
use std::path::Path;

pub fn execute(_o: DataObject) -> DataObject {
let ax = list();
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn list() -> DataObject {
let mut a = DataArray::new();

let mut repodir = Path::new("repositories");
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

