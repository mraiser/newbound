let store = DataStore::new();
let path = store.root.join(&lib).join("meta.json");
if !path.exists() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' not found (no meta.json)", lib));
    return o;
}

let s = match std::fs::read_to_string(&path) {
    Ok(s) => s,
    Err(e) => {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Unable to read meta.json for '{}': {}", lib, e));
        return o;
    }
};
let mut meta = DataObject::from_string(&s);

// Empty string leaves a field untouched. Metadata only: the enforced
// permission lists (meta.json readers/writers) are deliberately not
// editable here.
let mut changed = false;
if !desc.is_empty() {
    meta.put_string("desc", &desc);
    changed = true;
}
if !groups.is_empty() {
    meta.put_string("groups", &groups);
    changed = true;
}

if changed {
    if let Err(e) = std::fs::write(&path, meta.to_string()) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Unable to write meta.json for '{}': {}", lib, e));
        return o;
    }
}

// Like dev.libsettings.save_library_config, this edits meta.json on disk;
// the in-memory system.libraries snapshot refreshes on restart.
let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
o