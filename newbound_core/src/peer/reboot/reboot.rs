use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::flowlang::system::system_call::system_call;

pub fn execute(_: DataObject) -> DataObject {
    let ax = reboot();
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn reboot() -> DataObject {
let mut ja = DataArray::new();
ja.push_string("sudo");
ja.push_string("reboot");
let o = system_call(ja);
o
}
