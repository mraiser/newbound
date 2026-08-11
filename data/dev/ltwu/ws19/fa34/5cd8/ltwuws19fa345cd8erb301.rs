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

// FNV-1a over the facet's ndata serialization; must match read_control_scene.
fn content_hash(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

let mut ctl_rec = store.get_data(&lib, &ctlid);
let mut data_obj = ctl_rec.get_object("data");

// Read-modify-write of the ONE key. Everything else on the record — the
// legacy `three` facet included — passes through verbatim (design
// acceptance 5; the validator checks it).
let created = !data_obj.has("scene");
let current = if created {
    String::new()
} else {
    data_obj.get_object("scene").to_string()
};
let current_hash = content_hash(&current);

// Optional concurrency token, same semantics as patch_control_facet /
// write_flow_body: empty base = unguarded.
if !base.is_empty() && base != current_hash {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "stale_base");
    o.put_string("current_hash", &current_hash);
    return o;
}

let new_s = scene.to_string();
data_obj.put_object("scene", scene);
ctl_rec.put_object("data", data_obj);
ctl_rec.put_int("time", time());
store.set_data(&lib, &ctlid, ctl_rec);

// Append to the control's shared journal (the same record the facet
// patches use); revert = write_control_scene of the entry's `old`.
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
entry.put_string("facet", "scene");
entry.put_string("old", &current);
entry.put_string("new", &new_s);
entry.put_int("time", time());
entry.put_string("label", &label);
jlist.push_object(entry);

jdata.put_array("list", jlist);
jrec.put_object("data", jdata);
jrec.put_int("time", time());
store.set_data(&lib, &jid, jrec);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("ok", true);
o.put_boolean("created", created);
o.put_string("patch_id", &patch_id);
o.put_string("hash", &content_hash(&new_s));
o