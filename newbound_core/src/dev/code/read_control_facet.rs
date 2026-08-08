use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "facet"] {
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
        let arg_2: String = o.get_string("facet");
        read_control_facet(arg_0, arg_1, arg_2)
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

pub fn read_control_facet(lib: String, ctl: String, facet: String) -> DataObject {
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
}
