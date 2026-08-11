// An empty author defaults to the calling session's user — the platform
// injects nn_sessionid into params on every web call (HTTP and websocket
// alike); CLI/MCP callers that want a specific provenance name pass author.
let author = {
    let a = author.trim().to_string();
    if !a.is_empty() { a } else {
        let mut who = String::new();
        if !nn_sessionid.is_empty() {
            let system = flowlang::datastore::DataStore::globals().get_object("system");
            if system.has("sessions") {
                let sessions = system.get_object("sessions");
                if sessions.has(&nn_sessionid) {
                    let session = sessions.get_object(&nn_sessionid);
                    if session.has("user") {
                        who = session.get_object("user").try_get_string("displayname").unwrap_or_default();
                    }
                    if who.trim().is_empty() {
                        who = session.try_get_string("username").unwrap_or_default();
                    }
                }
            }
        }
        if who.trim().is_empty() { "anonymous".to_string() } else { who }
    }
};

// Comma-delimited CATEGORIZATION tags at library, control, or command level. Plain metadata for discovery and organization - carries NO permission meaning. The groups field is SECURITY groups and is never written by tag conventions (the owner's correction, 2026-07-31).
// Targeting: ctl=="" -> the library's meta.json; cmd=="" -> the control
// record; else the command's IMPL record (set_command_meta's chain).
// EXPLICIT REPLACE: the value is stored verbatim; empty string CLEARS the
// field (unlike set_*_meta's empty-means-untouched). Unjournaled like the
// meta family. Record-level readers/writers are never modified here.
let _author = author;
let value = tags.trim().to_string();
let store = DataStore::new();

if ctl.is_empty() {
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
    let old = if meta.has("tags") { meta.get_string("tags") } else { String::new() };
    let changed = old != value;
    if changed {
        if value.is_empty() { meta.remove_property("tags"); }
        else { meta.put_string("tags", &value); }
        if let Err(e) = std::fs::write(&path, meta.to_string()) {
            let mut o = DataObject::new();
            o.put_string("status", "err");
            o.put_string("msg", &format!("Unable to write meta.json for '{}': {}", lib, e));
            return o;
        }
    }
    let mut o = DataObject::new();
    o.put_string("status", "ok");
    o.put_boolean("changed", changed);
    o.put_string("tags", &value);
    return o;
}

let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

let target_id = if cmd.is_empty() {
    ctlid.clone()
} else {
    let data_obj = store.get_data(&lib, &ctlid).get_object("data");
    let list = if data_obj.has("cmd") { data_obj.get_array("cmd") } else { DataArray::new() };
    let mut cmd_id = String::new();
    for i in 0..list.len() {
        let item = list.get_object(i);
        if item.get_string("name") == cmd {
            cmd_id = item.get_string("id");
            break;
        }
    }
    if cmd_id.is_empty() || !store.exists(&lib, &cmd_id) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Command '{}' not found in control '{}'", cmd, ctl));
        return o;
    }
    let cmd_doc = store.get_data(&lib, &cmd_id).get_object("data");
    let lang = if cmd_doc.has("type") { cmd_doc.get_string("type") } else { "rust".to_string() };
    if !cmd_doc.has(&lang) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Command '{}' has no impl record", cmd));
        return o;
    }
    let impl_id = cmd_doc.get_string(&lang);
    if !store.exists(&lib, &impl_id) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", "Command metadata not found in datastore");
        return o;
    }
    impl_id
};

let mut record = store.get_data(&lib, &target_id);
let mut data_obj = record.get_object("data");
let old = if data_obj.has("tags") { data_obj.get_string("tags") } else { String::new() };
let changed = old != value;
if changed {
    if value.is_empty() { data_obj.remove_property("tags"); }
    else { data_obj.put_string("tags", &value); }
    record.put_object("data", data_obj);
    record.put_int("time", time());
    store.set_data(&lib, &target_id, record);
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
o.put_string("tags", &value);
o
