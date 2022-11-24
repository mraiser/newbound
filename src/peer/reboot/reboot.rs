use ndata::dataobject::*;
use ndata::dataarray::DataArray;
use flowlang::flowlang::system::system_call::system_call;

pub fn execute(_o: DataObject) -> DataObject {
let ax = reboot();
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn reboot() -> DataObject {
let mut ja = DataArray::new();
ja.push_string("sudo");
ja.push_string("reboot");
let o = system_call(ja);
o
}

