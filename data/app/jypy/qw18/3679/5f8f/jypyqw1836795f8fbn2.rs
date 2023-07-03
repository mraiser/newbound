let system = DataStore::globals().get_object("system");
let o = system.get_object("apps").get_object("app").get_object("runtime");
o.get_string("uuid")