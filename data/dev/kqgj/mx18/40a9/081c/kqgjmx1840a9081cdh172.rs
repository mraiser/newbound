let mut o = DataObject::new();
o.put_str("lib", &lib);
let o = exec(uuid, "dev".to_string(), "lib_info".to_string(), o);
o