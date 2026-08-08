use ndata::dataobject::DataObject;
use flowlang::buildrust::build_lib;
use crate::dev::dev::compile::build_compile_command;
use crate::dev::dev::compile::execute_compile_command;
use flowlang::datastore::DataStore;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib"] {
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
        let arg_0: String = o.get_string("lib");
        rebuild_lib(arg_0)
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

pub fn rebuild_lib(lib: String) -> String {
if build_lib(lib.to_owned()) {
  let data_path = DataStore::new().root.canonicalize().unwrap();
  let mut base_path = data_path.parent().unwrap().to_path_buf();
  let meta_json_path = data_path.join(&lib).join("meta.json");
  if let Ok(json_content) =  std::fs::read_to_string(&meta_json_path) {
    let meta_do = DataObject::from_string(&json_content);
    if meta_do.has("cargo") {
      let crate_do = meta_do.get_object("cargo");
      if crate_do.has("ffi") && crate_do.get_boolean("ffi"){
        println!("WE HAVE AN FFI CRATE!");
        base_path = base_path.join(&lib);
      }
    }
  };
  let base_path = base_path.display().to_string();
  
  let ja = build_compile_command();
  println!("{}", ja.to_string());

  let (b, s) = execute_compile_command(ja, base_path);
  if b { panic!("{}",s); }
}
"OK".to_string()
}
