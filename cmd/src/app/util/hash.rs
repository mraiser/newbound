use ndata::dataobject::*;
use blake2::{Blake2b512, Blake2s256, Digest};
use std::path::Path;
use flowlang::generated::flowlang::file::read_all_string::read_all_string;
use std::fs;
use std::io;
use std::io::prelude::*;
use std::fs::File;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("file");
let ax = hash(a0);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn hash(file:String) -> String {
  let path = Path::new(&file);
  let mut hasher = Blake2b512::new();
  hash_path(&path, &mut hasher);
  let res = hasher.finalize();
  let mut s = "".to_string();
  for b in res {
    s += &format!("{:02X?}", b);
  }
  s
}

pub fn hash_path(path:&Path, hasher:&mut Blake2b512) {
  if path.is_dir() { 
    hash_dir(path, hasher); 
  }
  else {
    hash_file(path, hasher);
  }
}

pub fn hash_file(path:&Path, hasher:&mut Blake2b512) {
  let mut f = File::open(path).unwrap();
  let mut buffer = Vec::new();
  let _x = f.read_to_end(&mut buffer).unwrap();
  hasher.update(&buffer);
}

pub fn hash_dir(path:&Path, hasher:&mut Blake2b512) {
  let mut vec = Vec::new();
  for file in fs::read_dir(path).unwrap() {
    let path = file.unwrap().path().into_os_string().into_string().unwrap();
    if !path.starts_with(".") {
      vec.push(path);
    }
  }
  vec.sort();
  for file in vec {
    let path = Path::new(&file);
    hash_path(&path, hasher);
  }
}

