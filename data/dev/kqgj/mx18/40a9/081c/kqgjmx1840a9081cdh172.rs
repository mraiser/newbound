let mut d = DataObject::new();
d.put_str("lib", &lib);
let o = exec(uuid.to_owned(), "dev".to_string(), "lib_info".to_string(), d.duplicate());
let o = o.get_object("data");
let v = o.get_string("version").parse::<i64>();
let o = exec(uuid, "dev".to_string(), "lib_info".to_string(), d);
o