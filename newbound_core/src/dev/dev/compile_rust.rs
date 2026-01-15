use ndata::dataobject::DataObject;
use crate::dev::dev::compile::build_compile_command;
use crate::dev::dev::compile::execute_compile_command;
use flowlang::datastore::DataStore;

pub fn execute(_: DataObject) -> DataObject {
    let ax = compile_rust();
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn compile_rust() -> String {
let ja = build_compile_command();

let base_path = DataStore::new().root.canonicalize().unwrap();
let mut base_path = base_path.parent().unwrap();
let base_path = base_path.display().to_string();
println!("cd {}; {}", &base_path, ja.to_string());


let (b, s) = execute_compile_command(ja, base_path);
if b { panic!("{}",s); }
println!("Compile OK");
"OK".to_string()

}
