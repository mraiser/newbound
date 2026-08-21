// Read-only window onto runtime/dev/repos.json - the registry every
// dev.git command resolves repo names against. An absent file is an
// empty registry, not an error.
let regpath = DataStore::new().root.parent().unwrap()
    .join("runtime").join("dev").join("repos.json");
let mut o = DataObject::new();
if !regpath.exists() {
    o.put_string("status", "ok");
    o.put_object("repos", DataObject::new());
    o.put_int("count", 0);
    return o;
}
match DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap()) {
    Ok(entries) => {
        o.put_string("status", "ok");
        o.put_int("count", entries.get_keys().len() as i64);
        o.put_object("repos", entries);
    }
    Err(_) => {
        o.put_string("status", "err");
        o.put_string("msg", &format!("{} is not valid JSON", regpath.display()));
    }
}
o