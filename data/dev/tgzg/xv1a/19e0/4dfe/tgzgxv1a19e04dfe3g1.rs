// Resolve the command and confirm it is a Python command.
let store = DataStore::new();
let id = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| store.lookup_cmd_id(&lib, &ctl, &cmd))) {
    Ok(id) => id,
    Err(_) => {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Command {}:{}:{} not found", lib, ctl, cmd));
        return o;
    }
};
let lang = store.get_data(&lib, &id).get_object("data").get_string("type");
if lang != "python" {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("{}:{}:{} is a {} command, not a Python command", lib, ctl, cmd, lang));
    return o;
}

// Regenerate the source (and the ndata_py/flowlang stubs) from the store, as
// dev.compile does on every edit, so the check sees the current code.
let _ = std::panic::catch_unwind(|| build(&lib, &ctl, &cmd, Path::new("")));

// Compile, import and (if mypy is installed) type-check it - in a separate
// Python process, never running the command.
check(&lib, &id)
