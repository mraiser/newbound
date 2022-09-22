use ndata::dataobject::*;
use flowlang::datastore::DataStore;
use flowlang::appserver::check_auth;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("lib");
let a1 = o.get_string("id");
let a2 = o.get_string("nn_sessionid");
let ax = read(a0, a1, a2);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn read(lib:String, id:String, nn_sessionid:String) -> DataObject {
if check_auth(&lib, &id, &nn_sessionid, false) {
  return DataStore::new().get_data(&lib, &id);
}
panic!("UNAUTHORIZED read {}:{}", lib, id);
}

