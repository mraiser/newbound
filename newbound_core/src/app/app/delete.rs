use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use crate::security::security::init::check_auth;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("lib");
    let arg_1: String = o.get_string("id");
    let arg_2: String = o.get_string("nn_sessionid");
    let ax = delete(arg_0, arg_1, arg_2);
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn delete(lib: String, id: String, nn_sessionid: String) -> String {
// FIXME - Does not delete attachments or empty parent folders
// Move to DataStore::delete()
if check_auth(&lib, &id, &nn_sessionid, true) {
  let s = DataStore::new();
  let f = s.get_data_file(&lib, &id);
  let _x = std::fs::remove_file(f);
  return "OK".to_string()
}
panic!("UNAUTHORIZED read {}:{}", lib, id);
}
