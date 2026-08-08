if facet != "html" && facet != "css" && facet != "js" && facet != "memory" && facet != "prompt" {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Unsupported facet '{}'. Supported: html, css, js, memory (kb entries, docs/memory.md), prompt (the curriculum core, docs/prompting.md); the data and three facets are not facet-patchable.", facet));
    return o;
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

// FNV-1a over the \r-normalized source; this hash is the concurrency token
// patch_control_facet accepts as `base`.
fn content_hash(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

let data_obj = store.get_data(&lib, &ctlid).get_object("data");

let exists = data_obj.has(&facet);
let source = if exists { data_obj.get_string(&facet).replace("\r", "") } else { String::new() };

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("source", &source);
o.put_string("hash", &content_hash(&source));
o.put_boolean("exists", exists);
o