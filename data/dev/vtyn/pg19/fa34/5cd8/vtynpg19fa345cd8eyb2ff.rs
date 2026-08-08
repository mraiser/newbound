let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

// FNV-1a over the facet's ndata serialization — the concurrency token
// write_control_scene accepts as `base`. Must stay in sync with it.
fn content_hash(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

// The scene facet is an inline JSON object on the control record's data
// (the legacy `three` storage posture — an object, not a string
// attachment). Facet-absent is a normal state: exists=false, empty
// object, hash of "".
let data_obj = store.get_data(&lib, &ctlid).get_object("data");
let mut o = DataObject::new();
o.put_string("status", "ok");
if !data_obj.has("scene") {
    o.put_boolean("exists", false);
    o.put_object("scene", DataObject::new());
    o.put_string("hash", &content_hash(""));
    return o;
}
let scene = data_obj.get_object("scene");
o.put_string("hash", &content_hash(&scene.to_string()));
o.put_object("scene", scene);
o.put_boolean("exists", true);
o