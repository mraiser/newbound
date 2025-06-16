use ndata::dataobject::DataObject;
use crate::dev::dev::compile::build_compile_command;
use crate::dev::dev::compile::execute_compile_command;

pub fn execute(_: DataObject) -> DataObject {
    let ax = compile_rust();
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn compile_rust() -> String {
let ja = build_compile_command();
println!("{}", ja.to_string());
let (b, s) = execute_compile_command(ja);
if b { panic!("{}",s); }
println!("Compile OK");
"OK".to_string()
}
