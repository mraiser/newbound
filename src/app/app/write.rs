use ndata::dataobject::DataObject;
use flowlang::flowlang::*;
use ndata::dataarray::DataArray;
use ndata::data::Data;
use crate::security::security::init::check_auth;

pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("lib");
  let arg_1: Data = o.get_property("id");
  let arg_2: DataObject = o.get_object("data");
  let arg_3: Data = o.get_property("readers");
  let arg_4: Data = o.get_property("writers");
  let arg_5: String = o.get_string("nn_sessionid");
  let ax = write(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5);
  let mut result_obj = DataObject::new();
  result_obj.put_object("a", ax);
  result_obj
}

pub fn write(lib: String, id: Data, data: DataObject, readers: Data, writers: Data, nn_sessionid: String) -> DataObject {
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
