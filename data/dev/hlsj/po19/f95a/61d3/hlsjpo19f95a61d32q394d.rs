// An empty author defaults to the calling session's user - the platform
// injects nn_sessionid into params on every web call (HTTP and websocket
// alike); CLI/MCP callers that want a specific provenance name pass author.
// Same rule as patch_control_facet and delete_command.
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

let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

let data_obj = store.get_data(&lib, &ctlid).get_object("data");
let list = if data_obj.has("cmd") {
    data_obj.get_array("cmd")
} else {
    DataArray::new()
};

let mut cmd_id = String::new();
for i in 0..list.len() {
    let item = list.get_object(i);
    if item.get_string("name") == cmd {
        cmd_id = item.get_string("id");
        break;
    }
}

if cmd_id.is_empty() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Command '{}' not found in control '{}'", cmd, ctl));
    return o;
}

if !store.exists(&lib, &cmd_id) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Command metadata not found in datastore");
    return o;
}

let mut cmd_rec = store.get_data(&lib, &cmd_id);
let mut cmd_doc = cmd_rec.get_object("data");
let lang = if cmd_doc.has("type") { cmd_doc.get_string("type") } else { "rust".to_string() };

if !cmd_doc.has(&lang) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Implementation ID for language '{}' not found", lang));
    return o;
}
let impl_id = cmd_doc.get_string(&lang);

if !store.exists(&lib, &impl_id) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Implementation record not found in datastore");
    return o;
}

let mut impl_rec = store.get_data(&lib, &impl_id);
let mut impl_doc = impl_rec.get_object("data");

// desc and groups live on the implementation record (the dev editor's
// save_command writes them there); empty string leaves a field untouched.
// Record-level readers/writers are not modified.
let j_old_desc = impl_doc.try_get_string("desc").unwrap_or_default();
let j_old_groups = impl_doc.try_get_string("groups").unwrap_or_default();
let mut changed = false;
if !desc.is_empty() {
    impl_doc.put_string("desc", &desc);
    // Keep a legacy desc on the command record itself in sync —
    // read_command prefers it when present.
    if cmd_doc.has("desc") {
        cmd_doc.put_string("desc", &desc);
        cmd_rec.put_object("data", cmd_doc);
        cmd_rec.put_int("time", time());
        store.set_data(&lib, &cmd_id, cmd_rec);
    }
    changed = true;
}
if !groups.is_empty() {
    impl_doc.put_string("groups", &groups);
    changed = true;
}

if changed {
    impl_rec.put_object("data", impl_doc);
    impl_rec.put_int("time", time());
    store.set_data(&lib, &impl_id, impl_rec);
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
// old/new carry only the fields whose value actually moved, so re-setting
// the same desc (the usual call after an upsert) journals nothing.
let mut j_old = DataObject::new();
let mut j_new = DataObject::new();
if !desc.is_empty() && desc != j_old_desc { j_old.put_string("desc", &j_old_desc); j_new.put_string("desc", &desc); }
if !groups.is_empty() && groups != j_old_groups { j_old.put_string("groups", &j_old_groups); j_new.put_string("groups", &groups); }
// Journal the edit on the control's patch journal (facet "command", op
// "meta"). It runs after the store write, so the entry describes
// what the store now holds; a journal problem is reported on the result and
// never turns the edit into a failure. The entry carries the
// caller-supplied label (the stated why) and the resolved author.
if j_new.has("desc") || j_new.has("groups") {
    let mut j_entry = DataObject::new();
    j_entry.put_string("author", &author);
    j_entry.put_string("facet", "command");
    j_entry.put_string("cmd", &cmd);
    j_entry.put_string("op", "meta");
    j_entry.put_string("old", &j_old.to_string());
    j_entry.put_string("new", &j_new.to_string());
    j_entry.put_string("label", label.trim());
    let j_r = crate::dev::code::patch_journal::patch_journal("append".to_string(), lib.clone(), ctlid.clone(), String::new(), j_entry, 0, false, nn_sessionid.clone());
    if j_r.get_string("status") == "ok" {
        o.put_string("patch_id", &j_r.get_string("patch_id"));
    } else {
        o.put_string("journal_warning", &j_r.try_get_string("msg").unwrap_or_default());
    }
}
o