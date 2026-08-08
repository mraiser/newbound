let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

// FNV-1a over the body's ndata serialization — the concurrency token
// write_flow_body accepts as `base`. Must stay in sync with write_flow_body.
fn content_hash(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
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
    o.put_string("msg", &format!("Command '{}' not found in control '{}'. write_flow_body creates flow commands.", cmd, ctl));
    return o;
}

if !store.exists(&lib, &cmd_id) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Command metadata not found in datastore");
    return o;
}

let cmd_doc = store.get_data(&lib, &cmd_id).get_object("data");
let lang = if cmd_doc.has("type") { cmd_doc.get_string("type") } else { "rust".to_string() };
if lang != "flow" {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("'{}' is not a flow command (type is '{}')", cmd, lang));
    return o;
}

// Body-absent is a normal state (a freshly-created flow command):
// exists=false, empty body, hash of "".
let mut o = DataObject::new();
o.put_string("status", "ok");
if !cmd_doc.has("flow") {
    o.put_boolean("exists", false);
    o.put_object("body", DataObject::new());
    o.put_string("hash", &content_hash(""));
    return o;
}
let impl_id = cmd_doc.get_string("flow");
if !store.exists(&lib, &impl_id) {
    o.put_boolean("exists", false);
    o.put_object("body", DataObject::new());
    o.put_string("hash", &content_hash(""));
    return o;
}
let impl_doc = store.get_data(&lib, &impl_id).get_object("data");
if !impl_doc.has("flow") {
    o.put_boolean("exists", false);
    o.put_object("body", DataObject::new());
    o.put_string("hash", &content_hash(""));
    return o;
}

// The .flow attachment is inlined by the datastore as a JSON object.
let body = impl_doc.get_object("flow");
o.put_string("hash", &content_hash(&body.to_string()));
o.put_object("body", body);
o.put_boolean("exists", true);
o