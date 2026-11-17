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
let events = if data_obj.has("event") { data_obj.get_array("event") } else { DataArray::new() };

let mut comp_id = String::new();
let mut kept = DataArray::new();
for i in 0..events.len() {
    let item = events.get_object(i);
    if item.get_string("name") == name {
        comp_id = item.get_string("id");
    } else {
        kept.push_object(item);
    }
}
if comp_id.is_empty() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("No event handler named '{}' on control '{}'", name, ctl));
    return o;
}

let old = if store.exists(&lib, &comp_id) {
    store.get_data(&lib, &comp_id).get_object("data").to_string()
} else {
    String::new()
};

data_obj.put_array("event", kept);
ctl_rec.put_object("data", data_obj);
ctl_rec.put_int("time", time());
store.set_data(&lib, &ctlid, ctl_rec);

remove_event_listener(&comp_id);
let f = store.get_data_file(&lib, &comp_id);
if f.exists() {
    let _x = std::fs::remove_file(f);
}

let mut entry = DataObject::new();
entry.put_string("author", &author);
entry.put_string("facet", "event");
entry.put_string("cmd", &name);
entry.put_string("old", &old);
entry.put_string("new", "");
entry.put_int("time", time());
entry.put_string("label", &format!("remove event handler {}", name));
let jr = crate::dev::code::patch_journal::patch_journal("append".to_string(), lib, ctlid, String::new(), entry, 0, false, nn_sessionid);
if jr.get_string("status") != "ok" { return jr; }
let patch_id = jr.get_string("patch_id");

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("removed", true);
o.put_string("patch_id", &patch_id);
o