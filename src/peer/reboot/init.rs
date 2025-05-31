use ndata::dataobject::DataObject;
use ndata::dataarray::*;
use flowlang::flowlang::data::write::write;
use flowlang::datastore::DataStore;

pub fn execute(_: DataObject) -> DataObject {
  let ax = init();
  let mut result_obj = DataObject::new();
  result_obj.put_object("a", ax);
  result_obj
}

pub fn init() -> DataObject {
let store = DataStore::new();
let mut d;
if store.exists("runtime", "controls_available") { d = store.get_data("runtime", "controls_available").get_object("data"); }
else { d = DataObject::new(); }

let mut b = false;
if !d.has("peer:reboot") {
  let o = DataObject::from_string("{\"title\":\"Reboot Device\",\"type\":\"peer:reboot\",\"big\":false,\"position\":\"inline\",\"groups\":[\"admin\"]}");
  d.put_object("peer:reboot", o);
  b = true;
}

if b { write("runtime".to_string(), "controls_available".to_string(), d.clone(), DataArray::new(), DataArray::new()); }
  
d
}
