use ndata::dataobject::DataObject;
use flowlang::buildrust::build_lib;
use crate::dev::dev::compile::build_compile_command;
use crate::dev::dev::compile::execute_compile_command;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("lib");
    let ax = rebuild_lib(arg_0);
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn rebuild_lib(lib: String) -> String {
if build_lib(lib.to_owned()) {
//  let store = DataStore::new();
//  let root = store.get_lib_root(&lib);
  let ja = build_compile_command();
  println!("{}", ja.to_string());

  let (b, s) = execute_compile_command(ja);
  if b { panic!("{}",s); }
}
"OK".to_string()
}
