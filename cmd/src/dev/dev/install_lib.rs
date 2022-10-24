use ndata::dataobject::*;
use crate::peer::service::exec::exec;
use crate::peer::peer::remote::remote;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_string("lib");
let ax = install_lib(a0, a1);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn install_lib(uuid:String, lib:String) -> DataObject {
let mut d = DataObject::new();
d.put_str("lib", &lib);
let o = exec(uuid.to_owned(), "dev".to_string(), "lib_info".to_string(), d.duplicate());
let o = o.get_object("data");
let v = o.get_string("version").parse::<i64>().unwrap();
d.put_i64("version", v);
let o = exec(uuid, "dev".to_string(), "lib_archive".to_string(), d);
o
}

