use ndata::dataobject::*;
use flowlang::buildrust::build_lib;
use flowlang::datastore::DataStore;
use crate::dev::dev::compile::build_compile_command;
use crate::dev::dev::compile::execute_compile_command;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let ax = rebuild_lib(a0);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn rebuild_lib(lib:String) -> String {
if build_lib(lib.to_owned()) {
  let store = DataStore::new();
  let root = store.get_lib_root(&lib);
  let ja = build_compile_command(root);
  println!("{}", ja.to_string());

  let (b, s) = execute_compile_command(ja);
  if b { panic!("{}",s); }
}
"OK".to_string()
}

