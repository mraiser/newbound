use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use crate::security::security::init::check_auth;

pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("lib");
  let arg_1: String = o.get_string("id");
  let arg_2: String = o.get_string("nn_sessionid");
  let ax = read(arg_0, arg_1, arg_2);
  let mut result_obj = DataObject::new();
  result_obj.put_object("a", ax);
  result_obj
}

pub fn read(lib: String, id: String, nn_sessionid: String) -> DataObject {
if check_auth(&lib, &id, &nn_sessionid, false) {
  let store = DataStore::new();
  if store.exists(&lib, &id) { return store.get_data(&lib, &id); }
  else { return DataObject::from_string("{\"status\":\"err\",\"msg\":\"NOT FOUND\"}"); }
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")
}
