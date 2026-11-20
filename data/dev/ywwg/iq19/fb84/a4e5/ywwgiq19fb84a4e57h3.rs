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

// The DELIBERATE editor for the platform's security-group intent — and its
// enforcement. Writes the comma-delimited groups string AND derives the
// enforced readers arrays from it (split on comma, trimmed) — the same
// derivation the retired editcontrol/editcommand save paths performed.
// Never used for tags/categorization - that is set_tags.
// Targeting: ctl=="" -> the library's meta.json (its readers are the library
// gate in check_security/check_auth; the in-memory system.libraries snapshot
// refreshes on restart); cmd=="" -> the control record plus its inline data
// records (the records app.read serves the UI from — save_control parity);
// else the command META record (the record check_security reads via
// lookup_command_id) plus its impl record (the old editcommand set both).
// EXPLICIT REPLACE: the value is stored verbatim; empty string CLEARS the
// groups field and derives an empty readers array (= admin-only). JOURNALED:
// control and command changes on the control's patch journal (facet
// "security"), library changes in runtime/dev/security_journal.jsonl.
// writers is never modified here.

fn derived(value: &str) -> DataArray {
    let mut a = DataArray::new();
    for g in value.split(',') {
        let g = g.trim();
        if !g.is_empty() { a.push_string(g); }
    }
    a
}
fn as_vec(a: &DataArray) -> Vec<String> {
    let mut v = Vec::new();
    for i in 0..a.len() { v.push(a.get_string(i)); }
    v
}
// Set a record's top-level readers to the derived array; true if changed.
fn set_record_readers(lib: &str, id: &str, value: &str) -> bool {
    let store = DataStore::new();
    let mut rec = store.get_data(lib, id);
    let old = if rec.has("readers") { as_vec(&rec.get_array("readers")) } else { Vec::new() };
    let nu = derived(value);
    if old == as_vec(&nu) { return false; }
    rec.put_array("readers", nu);
    rec.put_int("time", time());
    store.set_data(lib, id, rec);
    true
}
// Set the groups string on a record's data; true if changed.
fn set_record_groups(lib: &str, id: &str, value: &str) -> bool {
    let store = DataStore::new();
    let mut record = store.get_data(lib, id);
    let mut data_obj = record.get_object("data");
    let old = if data_obj.has("groups") { data_obj.get_string("groups") } else { String::new() };
    if old == value { return false; }
    if value.is_empty() { data_obj.remove_property("groups"); }
    else { data_obj.put_string("groups", value); }
    record.put_object("data", data_obj);
    record.put_int("time", time());
    store.set_data(lib, id, record);
    true
}

// JOURNAL helpers: what a record holds right now, for the before/after entry.
fn readers_of(lib: &str, id: &str) -> DataArray {
    let rec = DataStore::new().get_data(lib, id);
    let mut a = DataArray::new();
    if rec.has("readers") {
        let r = rec.get_array("readers");
        for i in 0..r.len() { a.push_string(&r.get_string(i)); }
    }
    a
}
fn groups_of(lib: &str, id: &str) -> String {
    let d = DataStore::new().get_data(lib, id).get_object("data");
    if d.has("groups") { d.get_string("groups") } else { String::new() }
}
let value = groups.trim().to_string();
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
    let old = if meta.has("groups") { meta.get_string("groups") } else { String::new() };
    let oldreaders = if meta.has("readers") { as_vec(&meta.get_array("readers")) } else { Vec::new() };
    let nureaders = derived(&value);
    let changed = old != value || oldreaders != as_vec(&nureaders);
    if changed {
        if value.is_empty() { meta.remove_property("groups"); }
        else { meta.put_string("groups", &value); }
        meta.put_array("readers", nureaders);
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
    // JOURNAL (library level): a library has no control, so no patch journal
    // to write to. The change is appended as one JSON line to the
    // instance-local runtime/dev/security_journal.jsonl. A journal problem is
    // reported on the result and never turns the edit into a failure.
    if changed {
        let mut j_old = DataObject::new();
        j_old.put_string("groups", &old);
        let mut oa = DataArray::new();
        for g in oldreaders.iter() { oa.push_string(g); }
        j_old.put_array("readers", oa);
        let mut j_new = DataObject::new();
        j_new.put_string("groups", &value);
        j_new.put_array("readers", derived(&value));
        let mut line = DataObject::new();
        line.put_int("time", time());
        line.put_string("author", &author);
        line.put_string("scope", "library");
        line.put_string("lib", &lib);
        line.put_object("old", j_old);
        line.put_object("new", j_new);
        let jdir = match store.root.parent() {
            Some(p) => p.join("runtime").join("dev"),
            None => std::path::PathBuf::from("runtime").join("dev"),
        };
        let jpath = jdir.join("security_journal.jsonl");
        let wrote = std::fs::create_dir_all(&jdir).and_then(|_| {
            use std::io::Write;
            let mut f = std::fs::OpenOptions::new().create(true).append(true).open(&jpath)?;
            f.write_all(format!("{}\n", line.to_string()).as_bytes())
        });
        match wrote {
            Ok(_) => o.put_string("journal", &jpath.to_string_lossy()),
            Err(e) => o.put_string("journal_warning", &format!("{}", e)),
        }
    }
    o.put_string("groups", &value);
    o.put_array("readers", derived(&value));
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

let mut changed = false;
let mut j_old = DataObject::new();
let mut j_new = DataObject::new();

if cmd.is_empty() {
    // JOURNAL: the control's state before the write, inline data included.
    j_old.put_string("groups", &groups_of(&lib, &ctlid));
    j_old.put_array("readers", readers_of(&lib, &ctlid));
    {
        let d0 = store.get_data(&lib, &ctlid).get_object("data");
        if d0.has("data") {
            let l0 = d0.get_array("data");
            let mut dr = DataObject::new();
            let mut any = false;
            for i in 0..l0.len() {
                let item = l0.get_object(i);
                if item.has("id") {
                    let did = item.get_string("id");
                    if store.exists(&lib, &did) {
                        dr.put_array(&did, readers_of(&lib, &did));
                        any = true;
                    }
                }
            }
            if any { j_old.put_object("data_readers", dr); }
        }
    }
    // The control record: intent string + enforced readers, then the same
    // readers onto its inline data records — these are the records app.read
    // serves to the browser, so they gate what the UI can even render.
    if set_record_groups(&lib, &ctlid, &value) { changed = true; }
    if set_record_readers(&lib, &ctlid, &value) { changed = true; }
    let data_obj = store.get_data(&lib, &ctlid).get_object("data");
    if data_obj.has("data") {
        let list = data_obj.get_array("data");
        for i in 0..list.len() {
            let item = list.get_object(i);
            if item.has("id") {
                let did = item.get_string("id");
                if store.exists(&lib, &did) {
                    if set_record_readers(&lib, &did, &value) { changed = true; }
                }
            }
        }
    }
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
    // The groups intent string lives on the impl record (set_command_meta's
    // chain); readers go on BOTH the meta record (the array check_security
    // consults) and the impl record (old editcommand parity).
    // JOURNAL: the command's state before the write (groups label on the
    // impl record; readers on the meta record and on the impl record).
    j_old.put_string("groups", &groups_of(&lib, &impl_id));
    j_old.put_array("readers", readers_of(&lib, &cmd_id));
    j_old.put_array("impl_readers", readers_of(&lib, &impl_id));
    j_new.put_array("impl_readers", derived(&value));
    if set_record_groups(&lib, &impl_id, &value) { changed = true; }
    if set_record_readers(&lib, &cmd_id, &value) { changed = true; }
    if set_record_readers(&lib, &impl_id, &value) { changed = true; }
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
o.put_string("groups", &value);
o.put_array("readers", derived(&value));
// JOURNAL the change on the control's patch journal (facet "security"; cmd =
// the command name, or empty for the control itself; old/new = JSON of the
// groups label and readers before and after). Runs after the store write, so
// the entry describes what the store now holds; nothing changed = no entry.
// A journal problem is reported on the result, never as a failed edit.
if changed {
    j_new.put_string("groups", &value);
    j_new.put_array("readers", derived(&value));
    fn show(o: &DataObject) -> String {
        let r = o.get_array("readers");
        let mut v = Vec::new();
        for i in 0..r.len() { v.push(r.get_string(i)); }
        if v.is_empty() { "admin only".to_string() } else { v.join(", ") }
    }
    let target = if cmd.is_empty() { format!("control {}.{}", lib, ctl) } else { format!("command {}.{}.{}", lib, ctl, cmd) };
    let j_label = format!("security of {}: {} -> {}", target, show(&j_old), show(&j_new));
    let mut j_entry = DataObject::new();
    j_entry.put_string("author", &author);
    j_entry.put_string("facet", "security");
    j_entry.put_string("cmd", &cmd);
    j_entry.put_string("op", "groups");
    j_entry.put_string("old", &j_old.to_string());
    j_entry.put_string("new", &j_new.to_string());
    j_entry.put_string("label", &j_label);
    let j_r = crate::dev::code::patch_journal::patch_journal("append".to_string(), lib.clone(), ctlid.clone(), String::new(), j_entry, 0, false, nn_sessionid.clone());
    if j_r.get_string("status") == "ok" {
        o.put_string("patch_id", &j_r.get_string("patch_id"));
    } else {
        o.put_string("journal_warning", &j_r.try_get_string("msg").unwrap_or_default());
    }
}
o
