fn bad_name(name: &str) -> bool {
    name.is_empty()
        || name.starts_with('/')
        || name.contains('\\')
        || name.split('/').any(|seg| seg.is_empty() || seg == "." || seg == "..")
}

if bad_name(&name) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Invalid asset name: use a relative path inside _ASSETS ('style.css', 'vendor/lib.js'); no leading '/', no '..'.");
    return o;
}

let store = DataStore::new();
let libdir = store.root.join(&lib);
if !libdir.exists() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' not found", lib));
    return o;
}

let target = libdir.join("_ASSETS").join(&name);
if !target.is_file() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("No such asset: {}", name));
    return o;
}
if let Err(e) = std::fs::remove_file(&target) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Unable to delete asset: {}", e));
    return o;
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("name", &name);
o.put_boolean("removed", true);
o