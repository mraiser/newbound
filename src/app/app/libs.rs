use ndata::dataobject::DataObject;
use flowlang::datastore::*;
use ndata::dataarray::DataArray;

pub fn execute(_: DataObject) -> DataObject {
  let ax = libs();
  let mut result_obj = DataObject::new();
  result_obj.put_array("a", ax);
  result_obj
}

pub fn libs() -> DataArray {
let o = DataStore::globals().get_object("system").get_object("libraries");
let mut a = DataArray::new();
for (_k,v) in o.objects(){ a.push_property(v); }
a
}
