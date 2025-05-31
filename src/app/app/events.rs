use ndata::dataobject::DataObject;
use ndata::dataarray::*;
use flowlang::datastore::*;
pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("app");
  let ax = events(arg_0);
  let mut result_obj = DataObject::new();
  result_obj.put_array("a", ax);
  result_obj
}

pub fn events(app: String) -> DataArray {
let mut a = DataArray::new();

let system = DataStore::globals().get_object("system");
let events = system.get_object("events");
if events.has(&app) { 
  let app = events.get_object(&app);
  for k in app.keys() {
    a.push_string(&k);
  }
}

a
}
