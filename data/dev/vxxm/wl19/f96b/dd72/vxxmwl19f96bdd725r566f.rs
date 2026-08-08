// Relative paths only, always inside _ASSETS — reject traversal outright.
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
if let Some(parent) = target.parent() {
    if let Err(e) = std::fs::create_dir_all(parent) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Unable to create asset directory: {}", e));
        return o;
    }
}

let replaced = target.exists();
if !tempfile.is_empty() {
    // Multipart uploads land as a temp-file path in params (CONTRACT §1.2);
    // copy it into place. Inline `content` is ignored when tempfile is set.
    let src = std::path::Path::new(&tempfile);
    if !src.is_file() {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("tempfile is not a readable file: {}", tempfile));
        return o;
    }
    if let Err(e) = std::fs::copy(src, &target) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Unable to write asset: {}", e));
        return o;
    }
} else if let Err(e) = std::fs::write(&target, content.as_bytes()) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Unable to write asset: {}", e));
    return o;
}

let size = std::fs::metadata(&target).map(|m| m.len() as i64).unwrap_or(0);
let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("name", &name);
o.put_int("size", size);
o.put_boolean("replaced", replaced);
o