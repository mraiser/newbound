use ndata::dataobject::*;
use flowlang::buildrust::*;
use ndata::dataarray::*;
use flowlang::generated::flowlang::system::system_call::system_call;
use std::io::{self, BufRead};

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let a1 = o.get_string("ctl");
let a2 = o.get_string("cmd");
let ax = compile(a0, a1, a2);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn compile(lib:String, ctl:String, cmd:String) -> String {
build(&lib, &ctl, &cmd);
let mut ja = DataArray::new();
ja.push_str("cargo");
ja.push_str("build");
ja.push_str("-p");
ja.push_str("cmd");

#[cfg(not(debug_assertions))]
ja.push_str("--release");

let mut features = "".to_string();

#[cfg(feature="serde_support")]
{
  features += ",serde_support";
}

#[cfg(feature="reload")]
{
  features += ",reload";
}

if features != "".to_string() {
  features = features[1..].to_string();
  features = "--features=".to_string() + &features;
  ja.push_str(&features);
}
println!("{}", ja.to_string());

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

if b { panic!("{}",s); }

"OK".to_string()
}

