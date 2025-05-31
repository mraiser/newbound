use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::datastore::DataStore;

pub fn execute(_: DataObject) -> DataObject {
  let ax = groups();
  let mut result_obj = DataObject::new();
  result_obj.put_array("a", ax);
  result_obj
}

pub fn groups() -> DataArray {
let mut v = Vec::new();
let system = DataStore::globals().get_object("system");
let users = system.get_object("users");
for (_k, user) in users.objects(){
  for group in user.object().get_array("groups").objects() {
    let group = group.string();
    if !v.contains(&group) { v.push(group); }
  }
}
if !v.contains(&"anonymous".to_string()) { v.push("anonymous".to_string()); }
let mut da = DataArray::new();
for g in v { da.push_string(&g); }
da
}
