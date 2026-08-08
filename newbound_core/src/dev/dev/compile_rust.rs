use ndata::dataobject::DataObject;
use crate::dev::dev::compile::build_compile_command;
use crate::dev::dev::compile::execute_compile_command;
use flowlang::datastore::DataStore;

pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        compile_rust()
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
