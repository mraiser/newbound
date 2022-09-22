use ndata::dataobject::*;
use flowlang::datastore::DataStore;
use flowlang::appserver::check_auth;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let a1 = o.get_string("id");
let a2 = o.get_string("nn_sessionid");
let ax = delete(a0, a1, a2);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn delete(lib:String, id:String, nn_sessionid:String) -> String {
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

