use ndata::dataobject::*;
use flowlang::command::Command;
use crate::app::service::init::format_result;
use crate::security::security::init::check_auth;
use std::panic;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let a1 = o.get_string("id");
let a2 = o.get_object("args");
let a3 = o.get_string("nn_sessionid");
let ax = exec(a0, a1, a2, a3);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn exec(lib:String, id:String, args:DataObject, nn_sessionid:String) -> DataObject {
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

