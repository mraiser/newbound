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


let _author = author;
let store = DataStore::new();
let path = store.root.join(&lib);
if !path.exists() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' not found", lib));
    return o;
}

let mut n = 0;
if store.exists(&lib, "controls") {
    let d = store.get_data(&lib, "controls").get_object("data");
    if d.has("list") { n = d.get_array("list").len(); }
}
if n > 0 {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' has {} control(s) - delete them first (rmdir semantics)", lib, n));
    return o;
}

let _x = std::fs::remove_dir_all(&path);
init_globals();

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("Library '{}' deleted", lib));
o
