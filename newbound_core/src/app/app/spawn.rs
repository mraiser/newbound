use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::flowlang::system::system_call::system_call;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("lib");
    let arg_1: String = o.get_string("ctl");
    let arg_2: String = o.get_string("cmd");
    let arg_3: DataObject = o.get_object("args");
    let ax = spawn(arg_0, arg_1, arg_2, arg_3);
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn spawn(lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
let mut ja = DataArray::new();

#[cfg(debug_assertions)]
let bin = "target/debug/newbound";

#[cfg(not(debug_assertions))]
let bin = "target/release/newbound";

ja.push_string(&bin);

ja.push_string("exec");
ja.push_string(&lib);
ja.push_string(&ctl);
ja.push_string(&cmd);
ja.push_string(&args.to_string());

system_call(ja)
}
