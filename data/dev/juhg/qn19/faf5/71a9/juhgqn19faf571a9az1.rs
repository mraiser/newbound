
let _author = author;
let store = DataStore::new();
let path = store.root.join(&lib);
if !path.exists() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' not found", lib));
    return o;
}

let mut n = 0;
if store.exists(&lib, "controls") {
    let d = store.get_data(&lib, "controls").get_object("data");
    if d.has("list") { n = d.get_array("list").len(); }
}
if n > 0 {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' has {} control(s) - delete them first (rmdir semantics)", lib, n));
    return o;
}

let _x = std::fs::remove_dir_all(&path);
init_globals();

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("Library '{}' deleted", lib));
o
