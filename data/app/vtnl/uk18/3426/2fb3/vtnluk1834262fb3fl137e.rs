let o = DataStore::globals().get_object("system").get_object("libraries");
let mut a = DataArray::new();
for (_k,v) in o.objects(){ a.push_property(v); }
a