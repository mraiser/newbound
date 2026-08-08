use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "scene", "base", "label", "author"] {
        if !o.has(p) {
            let mut e = DataObject::new();
            e.put_string("status", "err");
            e.put_string("msg", &format!("missing required parameter: {}", p));
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", e);
            return result_obj;
        }
    }
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        let arg_0: String = o.get_string("lib");
        let arg_1: String = o.get_string("ctl");
        let arg_2: DataObject = o.get_object("scene");
        let arg_3: String = o.get_string("base");
        let arg_4: String = o.get_string("label");
        let arg_5: String = o.get_string("author");
        write_control_scene(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
            result_obj
        }
        Err(err) => {
            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");

            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic occurred".to_string()
            };

            err_obj.put_string("msg", &msg);
            // Wrapped in the same `a` envelope a successful return uses.
            // Unwrapped, callers that unpack the envelope (newbound's
            // format_result, for one) report an opaque 500 — "Not an object:
            // DString(\"err\")" — instead of this message.
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", err_obj);
            result_obj
        }
    }
}

pub fn write_control_scene(lib: String, ctl: String, scene: DataObject, base: String, label: String, author: String) -> DataObject {
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
}
