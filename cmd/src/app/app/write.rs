use ndata::dataobject::*;
use flowlang::appserver::check_auth;
use flowlang::generated::flowlang::*;
use ndata::dataarray::DataArray;
use ndata::data::Data;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let a1 = o.get_property("id");
let a2 = o.get_object("data");
let a3 = o.get_property("readers");
let a4 = o.get_property("writers");
let a5 = o.get_string("nn_sessionid");
let ax = write(a0, a1, a2, a3, a4, a5);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn write(lib:String, id:Data, data:DataObject, readers:Data, writers:Data, nn_sessionid:String) -> DataObject {
let tid = id;
let id;
if tid.clone().is_null() { id = system::unique_session_id::unique_session_id(); }
else { id = tid.string(); }

let tid = readers;
let readers;
if tid.clone().is_null() { readers = DataArray::new(); }
else { readers = DataArray::from_string(&Data::as_string(tid)); }

let tid = writers;
let writers;
if tid.clone().is_null() { writers = DataArray::new(); }
else { writers = DataArray::from_string(&Data::as_string(tid)); }

if check_auth(&lib, &id, &nn_sessionid, false) {
  return data::write::write(lib, id, data, readers, writers);
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")
}

