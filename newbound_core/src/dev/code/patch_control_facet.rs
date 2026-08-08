use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "facet", "old_snippet", "new_snippet", "base", "label", "author"] {
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
        let arg_3: String = o.get_string("old_snippet");
        let arg_4: String = o.get_string("new_snippet");
        let arg_5: String = o.get_string("base");
        let arg_6: String = o.get_string("label");
        let arg_7: String = o.get_string("author");
        patch_control_facet(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6, arg_7)
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

pub fn patch_control_facet(lib: String, ctl: String, facet: String, old_snippet: String, new_snippet: String, base: String, label: String, author: String) -> DataObject {
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

// FNV-1a over the \r-normalized source; must stay in sync with read_control_facet.
fn content_hash(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

let mut record = store.get_data(&lib, &ctlid);
let mut data_obj = record.get_object("data");

// Normalize line endings to avoid strict matching failures caused by \r\n vs \n
let current = if data_obj.has(&facet) { data_obj.get_string(&facet).replace("\r", "") } else { String::new() };
let current_hash = content_hash(&current);

// Optional concurrency token: reject when the caller's base no longer matches.
if !base.is_empty() && base != current_hash {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "stale_base");
    o.put_string("current_hash", &current_hash);
    return o;
}

let old_n = old_snippet.replace("\r", "");
let new_n = new_snippet.replace("\r", "");

let journal_old;
let new_code;
if old_n.is_empty() {
    if new_n.is_empty() {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", "Nothing to do: old_snippet and new_snippet are both empty.");
        return o;
    }
    // Empty old_snippet: create or replace the whole facet (covers the
    // facet-absent case and initial authoring). The journal keeps the prior
    // source so the patch stays invertible.
    journal_old = current.clone();
    new_code = new_n.clone();
} else {
    let count = current.matches(&old_n).count();
    if count == 0 {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", "Snippet not found. Call `read_control_facet` to view the exact current source and try again. The snippet must match exactly, including whitespace and indentation.");
        return o;
    }
    if count > 1 {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Snippet is ambiguous: it matches {} times. Provide a longer snippet that matches exactly once. No change was made.", count));
        return o;
    }
    journal_old = old_n.clone();
    new_code = current.replacen(&old_n, &new_n, 1);
}

// Facets are attachment fields (attachmentkeynames); create the key rather
// than failing when the facet doesn't exist on the record yet.
let mut keys = if data_obj.has("attachmentkeynames") {
    data_obj.get_array("attachmentkeynames")
} else {
    DataArray::new()
};
let mut listed = false;
for k in keys.objects() {
    if k.string() == facet { listed = true; }
}
if !listed { keys.push_string(&facet); }
data_obj.put_array("attachmentkeynames", keys);

data_obj.put_string(&facet, &new_code);
record.put_object("data", data_obj);
record.put_int("time", time());
store.set_data(&lib, &ctlid, record);

// Append to the control's journal: one DataStore record per control, read by
// list_control_patches. Revert = apply the inverse as a new patch; the
// journal itself is never rewritten.
let jid = format!("{}_patches", ctlid);
let mut jrec;
let mut jdata;
let mut list;
if store.exists(&lib, &jid) {
    jrec = store.get_data(&lib, &jid);
    jdata = jrec.get_object("data");
    list = if jdata.has("list") { jdata.get_array("list") } else { DataArray::new() };
} else {
    jrec = DataObject::new();
    jrec.put_string("id", &jid);
    jrec.put_string("username", "system");
    jrec.put_array("readers", DataArray::new());
    jrec.put_array("writers", DataArray::new());
    jdata = DataObject::new();
    list = DataArray::new();
}

let patch_id = format!("p{}", list.len() + 1);
let mut entry = DataObject::new();
entry.put_string("patch_id", &patch_id);
entry.put_string("author", &author);
entry.put_string("facet", &facet);
entry.put_string("old", &journal_old);
entry.put_string("new", &new_n);
entry.put_int("time", time());
entry.put_string("label", &label);
list.push_object(entry);

jdata.put_array("list", list);
jrec.put_object("data", jdata);
jrec.put_int("time", time());
store.set_data(&lib, &jid, jrec);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("ok", true);
o.put_string("patch_id", &patch_id);
o.put_string("hash", &content_hash(&new_code));
o
}
