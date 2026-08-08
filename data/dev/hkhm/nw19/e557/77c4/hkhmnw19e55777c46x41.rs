let store = DataStore::new();
let real_id = lookup_cmd_id(lib.clone(), ctl.clone(), cmd.clone());
let mut o = store.get_data(&lib, &real_id).get_object("data");
o.put_string("cmd_id", &real_id);
o