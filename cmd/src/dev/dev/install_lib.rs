use ndata::dataobject::*;
use crate::peer::service::exec::exec;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_string("lib");
let ax = install_lib(a0, a1);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn install_lib(uuid:String, lib:String) -> DataObject {
let mut o = DataObject::new();
o.put_str("lib", &lib);
let o = exec(uuid, "dev".to_string(), "lib_info".to_string(), o);
let o = o.get_object("data");
let v = o.get_i64("version");
o
}

