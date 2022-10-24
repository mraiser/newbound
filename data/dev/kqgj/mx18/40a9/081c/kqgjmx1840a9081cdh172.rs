let mut o = DataObject::new();
o.put_str("lib", &lib);
let o = exec(uuid, "dev".to_string(), "lib_info".to_string(), o);
let o = o.get_object("data");
let v = o.get_i64("version");
o