use ndata::dataobject::DataObject;
use blake2::Blake2b512;
use blake2::Digest;
use std::path::Path;
use std::fs;
use std::io::prelude::*;
use std::fs::File;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["file"] {
        if !o.has(p) {
            let mut e = DataObject::new();
            e.put_string("status", "err");
            e.put_string("msg", &format!("missing required parameter: {}", p));
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", e);
            return result_obj;
        }
    }
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        let arg_0: String = o.get_string("file");
        hash(arg_0)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
            result_obj
        }
        Err(err) => {
            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");

            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic occurred".to_string()
            };

            err_obj.put_string("msg", &msg);
            // Wrapped in the same `a` envelope a successful return uses.
            // Unwrapped, callers that unpack the envelope (newbound's
            // format_result, for one) report an opaque 500 — "Not an object:
            // DString(\"err\")" — instead of this message.
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", err_obj);
            result_obj
        }
    }
}

pub fn hash(file: String) -> String {
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
