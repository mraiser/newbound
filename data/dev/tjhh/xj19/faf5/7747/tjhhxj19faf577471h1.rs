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

// A published app's control must be unpublished first, not deleted under it.
if ctl == lib {
    let app_props = store.root.join(&lib).join("_APPS").join(&ctl).join("app.properties");
    if app_props.exists() {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Control '{}' is a published app (_APPS/{} exists) - unpublish before deleting", ctl, ctl));
        return o;
    }
}

let _author = author; // terminal deletion: the journal it would be recorded in goes too
let rec = store.get_data(&lib, &ctlid);
let data = rec.get_object("data");
let mut n_cmds = 0i64;
let mut n_comps = 0i64;

// timers/events: deregister LIVE first (the setters' timeron/eventon in
// reverse), then delete the component records
if data.has("timer") {
    let list = data.get_array("timer");
    for i in 0..list.len() {
        let id = list.get_object(i).get_string("id");
        flowlang::appserver::remove_timer(&id);
        zap(&store, &lib, &id);
        n_comps += 1;
    }
}
if data.has("event") {
    let list = data.get_array("event");
    for i in 0..list.len() {
        let id = list.get_object(i).get_string("id");
        remove_event_listener(&id);
        zap(&store, &lib, &id);
        n_comps += 1;
    }
}

// commands: command record -> its typed impl/flow record -> both, with attachments
if data.has("cmd") {
    let list = data.get_array("cmd");
    for i in 0..list.len() {
        let cid = list.get_object(i).get_string("id");
        if store.exists(&lib, &cid) {
            let cd = store.get_data(&lib, &cid).get_object("data");
            let t = if cd.has("type") { cd.get_string("type") } else { "rust".to_string() };
            if cd.has(&t) {
                let impl_id = cd.get_string(&t);
                zap(&store, &lib, &impl_id);
            }
        }
        zap(&store, &lib, &cid);
        n_cmds += 1;
    }
}

// the journal dies with the control (terminal - stated in the contract)
let jid = format!("{}_patches", ctlid);
zap(&store, &lib, &jid);

// unlink from the library's controls index
if store.exists(&lib, "controls") {
    let mut idx = store.get_data(&lib, "controls");
    let mut idata = idx.get_object("data");
    let list = if idata.has("list") { idata.get_array("list") } else { DataArray::new() };
    let mut kept = DataArray::new();
    for i in 0..list.len() {
        let item = list.get_object(i);
        if item.get_string("id") != ctlid { kept.push_object(item); }
    }
    idata.put_array("list", kept);
    idx.put_object("data", idata);
    store.set_data(&lib, "controls", idx);
}

// finally the control record itself (facet attachments go with it)
zap(&store, &lib, &ctlid);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("Control '{}' deleted from library '{}'", ctl, lib));
o.put_int("deleted_commands", n_cmds);
o.put_int("deleted_components", n_comps);
o
