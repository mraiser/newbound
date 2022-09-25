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
for g in v { da.push_str(&g); }
da