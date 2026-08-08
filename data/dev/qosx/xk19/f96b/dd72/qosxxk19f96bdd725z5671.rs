fn bad_name(name: &str) -> bool {
    name.is_empty()
        || name.starts_with('/')
        || name.contains('\\')
        || name.split('/').any(|seg| seg.is_empty() || seg == "." || seg == "..")
}

if bad_name(&from) || bad_name(&to) {
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

let base = libdir.join("_ASSETS");
let src = base.join(&from);
if !src.is_file() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("No such asset: {}", from));
    return o;
}
let dst = base.join(&to);
if dst.exists() {
    // No silent clobber: delete_asset the target first if replacement is meant.
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Target asset already exists: {}", to));
    return o;
}
if let Some(parent) = dst.parent() {
    if let Err(e) = std::fs::create_dir_all(parent) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Unable to create asset directory: {}", e));
        return o;
    }
}
if let Err(e) = std::fs::rename(&src, &dst) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Unable to rename asset: {}", e));
    return o;
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("from", &from);
o.put_string("to", &to);
o