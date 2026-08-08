use ndata::dataobject::DataObject;
use flowlang::command::Command;
use crate::app::service::init::format_result;
use crate::security::security::init::check_auth;
use std::panic;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "id", "args", "nn_sessionid"] {
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
        let arg_1: String = o.get_string("id");
        let arg_2: DataObject = o.get_object("args");
        let arg_3: String = o.get_string("nn_sessionid");
        exec(arg_0, arg_1, arg_2, arg_3)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
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

pub fn exec(lib: String, id: String, args: DataObject, nn_sessionid: String) -> DataObject {
if check_auth(&lib, &id, &nn_sessionid, false) {
  let mut args = args.clone();
  args.put_string("nn_sessionid", &nn_sessionid);
  let command = Command::new(&lib, &id);
  command.cast_params(args.clone());
  let result = panic::catch_unwind(|| {
    let o = command.execute(args).unwrap();
    return format_result(command, o);
  });

  match result {
    Ok(x) => return x,
    Err(e) => {
      let s = match e.downcast::<String>() {
      Ok(panic_msg) => format!("{}", panic_msg),
      Err(_) => "unknown error".to_string()
    };        

    let mut o = DataObject::new();
    let s = format!("<html><head><title>500 - Server Error</title></head><body><h2>500</h2>Server Error: {}</body></html>", s);
    o.put_string("body", &s);
    o.put_int("code", 500);
    o.put_string("mimetype", "text/html");
    o.put_string("status", "err");
    o.put_string("msg", &s);
    return o;
  }
}
    
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")
}
