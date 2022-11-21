use ndata::dataobject::*;
use ndata::dataarray::*;
use flowlang::datastore::*;
pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("app");
let ax = events(a0);
let mut o = DataObject::new();
o.put_array("a", ax);
o
}

pub fn events(app:String) -> DataArray {
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

