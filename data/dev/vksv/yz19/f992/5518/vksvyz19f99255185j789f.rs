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

// FNV-1a over the body's ndata serialization; must match read_flow_body.
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
let mut list = if data_obj.has("cmd") {
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

// Creating flow commands is this command's job (upsert_command is
// rust-only): absent from the control's cmd list ⇒ create the entry.
let created = cmd_id.is_empty();
if created {
    cmd_id = unique_session_id();
    let mut item = DataObject::new();
    item.put_string("id", &cmd_id);
    item.put_string("name", &cmd);
    list.push_object(item);
    data_obj.put_array("cmd", list);
    ctl_rec.put_object("data", data_obj);
    ctl_rec.put_int("time", time());
    store.set_data(&lib, &ctlid, ctl_rec);
}

let mut cmd_rec;
let mut cmd_doc;
if store.exists(&lib, &cmd_id) {
    cmd_rec = store.get_data(&lib, &cmd_id);
    cmd_doc = cmd_rec.get_object("data");
} else {
    cmd_rec = DataObject::new();
    cmd_rec.put_string("id", &cmd_id);
    cmd_rec.put_string("username", "system");
    cmd_rec.put_array("readers", DataArray::new());
    cmd_rec.put_array("writers", DataArray::new());
    cmd_doc = DataObject::new();
    cmd_doc.put_string("id", &cmd_id);
    cmd_doc.put_string("name", &cmd);
}

if cmd_doc.has("type") && cmd_doc.get_string("type") != "flow" {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("'{}' is not a flow command (type is '{}')", cmd, cmd_doc.get_string("type")));
    return o;
}
cmd_doc.put_string("type", "flow");
let impl_id = if cmd_doc.has("flow") {
    cmd_doc.get_string("flow")
} else {
    let id = unique_session_id();
    cmd_doc.put_string("flow", &id);
    id
};
cmd_rec.put_object("data", cmd_doc);
cmd_rec.put_int("time", time());
store.set_data(&lib, &cmd_id, cmd_rec);

let mut impl_rec;
let mut impl_doc;
if store.exists(&lib, &impl_id) {
    impl_rec = store.get_data(&lib, &impl_id);
    impl_doc = impl_rec.get_object("data");
} else {
    impl_rec = DataObject::new();
    impl_rec.put_string("id", &impl_id);
    impl_rec.put_string("username", "system");
    impl_rec.put_array("readers", DataArray::new());
    impl_rec.put_array("writers", DataArray::new());
    impl_doc = DataObject::new();
}

// The bars ARE the command's signature: Command::new requires `params`
// and `returntype` on this record to execute the flow, so derive both
// from the body's input/output maps on every write. Node types are the
// loose lowercase strings; map them to flowlang's declared types.
fn flow_type(t: &str) -> String {
    match t {
        "object" => "JSONObject".to_string(),
        "array" => "JSONArray".to_string(),
        "int" | "integer" => "Integer".to_string(),
        "decimal" | "float" => "Float".to_string(),
        "boolean" => "Boolean".to_string(),
        "string" => "String".to_string(),
        _ => "Any".to_string(),
    }
}

let mut params = DataArray::new();
if body.has("input") {
    for (k, v) in body.get_object("input").objects() {
        let node = v.object();
        let t = if node.has("type") { node.get_string("type") } else { String::new() };
        let mut p = DataObject::new();
        p.put_string("name", &k);
        p.put_string("type", &flow_type(&t));
        params.push_object(p);
    }
}
let mut returntype = "JSONObject".to_string();
if body.has("output") {
    let outs = body.get_object("output").objects();
    if outs.len() == 1 {
        let node = outs[0].1.object();
        let t = if node.has("type") { node.get_string("type") } else { String::new() };
        returntype = flow_type(&t);
    }
}

let current = if impl_doc.has("flow") {
    impl_doc.get_object("flow").to_string()
} else {
    String::new()
};
let current_hash = content_hash(&current);

// Optional concurrency token, same semantics as patch_control_facet.
if !base.is_empty() && base != current_hash {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "stale_base");
    o.put_string("current_hash", &current_hash);
    return o;
}

// The body is stored whole as the `.flow` attachment (a JSON object);
// create the attachment field properly when absent.
let mut keys = if impl_doc.has("attachmentkeynames") {
    impl_doc.get_array("attachmentkeynames")
} else {
    DataArray::new()
};
let mut listed = false;
for k in keys.objects() {
    if k.string() == "flow" { listed = true; }
}
if !listed { keys.push_string("flow"); }
impl_doc.put_array("attachmentkeynames", keys);

let new_s = body.to_string();
impl_doc.put_object("flow", body);
impl_doc.put_string("type", "flow");
impl_doc.put_array("params", params);
impl_doc.put_string("returntype", &returntype);
if !impl_doc.has("import") { impl_doc.put_string("import", ""); }
if !impl_doc.has("desc") { impl_doc.put_string("desc", ""); }
impl_doc.put_string("lib", &lib);
impl_doc.put_string("ctl", &ctl);
impl_doc.put_string("cmd", &cmd);
impl_rec.put_object("data", impl_doc);
impl_rec.put_int("time", time());
store.set_data(&lib, &impl_id, impl_rec);

// Append to the control's shared journal (the same record the facet
// patches use); revert = write_flow_body of the entry's `old`.
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
entry.put_string("facet", "flow");
entry.put_string("cmd", &cmd);
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