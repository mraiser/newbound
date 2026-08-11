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


fn zap(store: &DataStore, lib: &str, id: &str) {
    if !store.exists(lib, id) { return; }
    let d = store.get_data(lib, id).get_object("data");
    let f = store.get_data_file(lib, id);
    if d.has("attachmentkeynames") {
        let keys = d.get_array("attachmentkeynames");
        for i in 0..keys.len() {
            let k = keys.get_string(i);
            if let Some(dir) = f.parent() {
                let af = dir.join(format!("{}.{}", id, k));
                if af.exists() { let _x = std::fs::remove_file(af); }
            }
        }
    }
    if f.exists() { let _x = std::fs::remove_file(f); }
}

let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());
let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

let mut ctl_rec = store.get_data(&lib, &ctlid);
let mut data_obj = ctl_rec.get_object("data");
let list = if data_obj.has("cmd") { data_obj.get_array("cmd") } else { DataArray::new() };

let mut cmd_id = String::new();
let mut kept = DataArray::new();
for i in 0..list.len() {
    let item = list.get_object(i);
    if item.get_string("name") == cmd { cmd_id = item.get_string("id"); }
    else { kept.push_object(item); }
}
if cmd_id.is_empty() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Command '{}' not found in control '{}'", cmd, ctl));
    return o;
}

// capture BOTH records for the journal before anything is removed - `old` is
// what a revert re-authors from
let mut old = DataObject::new();
let mut impl_id = String::new();
if store.exists(&lib, &cmd_id) {
    let cd = store.get_data(&lib, &cmd_id).get_object("data");
    let t = if cd.has("type") { cd.get_string("type") } else { "rust".to_string() };
    if cd.has(&t) { impl_id = cd.get_string(&t); }
    old.put_object("command", cd);
}
if !impl_id.is_empty() && store.exists(&lib, &impl_id) {
    old.put_object("impl", store.get_data(&lib, &impl_id).get_object("data"));
}

// unlink, then delete both records with their attachments
data_obj.put_array("cmd", kept);
ctl_rec.put_object("data", data_obj);
ctl_rec.put_int("time", time());
store.set_data(&lib, &ctlid, ctl_rec);
if !impl_id.is_empty() { zap(&store, &lib, &impl_id); }
zap(&store, &lib, &cmd_id);

// journal the deletion (the only mutation here that was unjournaled before)
let jid = format!("{}_patches", ctlid);
let mut jrec;
let mut jdata;
let mut jlist;
if store.exists(&lib, &jid) {
    jrec = store.get_data(&lib, &jid);
    jdata = jrec.get_object("data");
    jlist = if jdata.has("list") { jdata.get_array("list") } else { DataArray::new() };
} else {
    jrec = DataObject::new();
    jrec.put_string("id", &jid);
    jrec.put_string("username", "system");
    jrec.put_array("readers", DataArray::new());
    jrec.put_array("writers", DataArray::new());
    jdata = DataObject::new();
    jlist = DataArray::new();
}
let patch_id = format!("p{}", jlist.len() + 1);
let mut entry = DataObject::new();
entry.put_string("patch_id", &patch_id);
entry.put_string("author", &author);
entry.put_string("facet", "command");
entry.put_string("cmd", &cmd);
entry.put_string("old", &old.to_string());
entry.put_string("new", "");
entry.put_int("time", time());
entry.put_string("label", &format!("delete command {}", cmd));
jlist.push_object(entry);
jdata.put_array("list", jlist);
jrec.put_object("data", jdata);
jrec.put_int("time", time());
store.set_data(&lib, &jid, jrec);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("Command '{}' deleted from control '{}'", cmd, ctl));
o.put_string("patch_id", &patch_id);
o
