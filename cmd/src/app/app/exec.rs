use ndata::dataobject::*;
use flowlang::command::Command;
use flowlang::appserver::check_auth;
use flowlang::appserver::format_result;

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
  let mut args = args.duplicate();
  args.put_str("nn_sessionid", &nn_sessionid);
  let command = Command::new(&lib, &id);
  let o = command.execute(args).unwrap();
  return format_result(command, o);
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")
}

