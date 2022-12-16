use ndata::dataobject::*;
use flowlang::buildrust::*;
use ndata::dataarray::*;
use flowlang::flowlang::system::system_call::system_call;
use std::io::{self, BufRead};
use flowlang::datastore::DataStore;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let a1 = o.get_string("ctl");
let a2 = o.get_string("cmd");
let ax = check(a0, a1, a2);
let mut o = DataObject::new();
o.put_string("a", &ax);
o
}

pub fn check(lib:String, ctl:String, cmd:String) -> String {
let store = DataStore::new();
let root = store.get_lib_root(&lib);
let b = build(&lib, &ctl, &cmd, &root);
if b {
  let ja = build_check_command();
  println!("{}", ja.to_string());

  let (b, s) = execute_check_command(ja);
  if b { panic!("{}",s); }
  println!("Check OK");
}

"OK".to_string()
}

pub fn execute_check_command(ja:DataArray) -> (bool, String) {
  let o = system_call(ja);
  let e = o.get_string("err");
  let lines = io::BufReader::new(e.as_bytes()).lines();
  let mut b = false;
  let mut c = false;
  let mut s = "".to_string();
  for line in lines {
    let line = line.unwrap();
    if c {
      s += &line;
      s += "\n";
      c = line != "";
    }
    else if line.starts_with("error") {
      s += &line;
      s += "\n";
      b = true;
      c = true;
    }
  }
  (b, s)
}

pub fn build_check_command() -> DataArray {
  let mut ja = DataArray::new();
  ja.push_string("cargo");
  ja.push_string("check");
  
//  let store = DataStore::new();
//  if root == store.root.parent().unwrap().join("cmd") {
//    ja.push_string("-p");
//    ja.push_string("cmd");
//  }

  #[cfg(not(debug_assertions))]
  ja.push_string("--release");

  let mut features = "".to_string();

  #[cfg(feature="serde_support")]
  {
    features += ",serde_support";
  }

  #[cfg(feature="reload")]
  {
    features += ",reload";
  }

  #[cfg(feature="python_runtime")]
  {
    features += ",python_runtime";
  }

  #[cfg(feature="javascript_runtime")]
  {
    features += ",javascript_runtime";
  }

  #[cfg(feature="java_runtime")]
  {
    features += ",java_runtime";
  }

  if features != "".to_string() {
    features = features[1..].to_string();
    features = "--features=".to_string() + &features;
    ja.push_string(&features);
  }
  ja
}

