use ndata::dataobject::*;
use flowlang::datastore::*;
use ndata::dataarray::DataArray;

pub fn execute(_o: DataObject) -> DataObject {
let ax = libs();
let mut o = DataObject::new();
o.put_array("a", ax);
o
}

pub fn libs() -> DataArray {
let o = DataStore::globals().get_object("system").get_object("libraries");
let mut a = DataArray::new();
for (_k,v) in o.objects(){ a.push_property(v); }
a
}

