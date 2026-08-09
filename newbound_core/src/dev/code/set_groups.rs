use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use ndata::dataarray::DataArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "cmd", "groups", "author"] {
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
        let arg_2: String = o.get_string("cmd");
        let arg_3: String = o.get_string("groups");
        let arg_4: String = o.get_string("author");
        set_groups(arg_0, arg_1, arg_2, arg_3, arg_4)
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

pub fn set_groups(lib: String, ctl: String, cmd: String, groups: String, author: String) -> DataObject {
// The DELIBERATE editor for the platform's security-group intent — and its
// enforcement. Writes the comma-delimited groups string AND derives the
// enforced readers arrays from it (split on comma, trimmed) — the same
// derivation the retired editcontrol/editcommand save paths performed.
// Never used for tags/categorization - that is set_tags.
// Targeting: ctl=="" -> the library's meta.json (its readers are the library
// gate in check_security/check_auth; the in-memory system.libraries snapshot
// refreshes on restart); cmd=="" -> the control record plus its inline data
// records (the records app.read serves the UI from — save_control parity);
// else the command META record (the record check_security reads via
// lookup_command_id) plus its impl record (the old editcommand set both).
// EXPLICIT REPLACE: the value is stored verbatim; empty string CLEARS the
// groups field and derives an empty readers array (= admin-only). Unjournaled
// like the meta family. writers is never modified here.

fn derived(value: &str) -> DataArray {
    let mut a = DataArray::new();
    for g in value.split(',') {
        let g = g.trim();
        if !g.is_empty() { a.push_string(g); }
    }
    a
}
fn as_vec(a: &DataArray) -> Vec<String> {
    let mut v = Vec::new();
    for i in 0..a.len() { v.push(a.get_string(i)); }
    v
}
// Set a record's top-level readers to the derived array; true if changed.
fn set_record_readers(lib: &str, id: &str, value: &str) -> bool {
    let store = DataStore::new();
    let mut rec = store.get_data(lib, id);
    let old = if rec.has("readers") { as_vec(&rec.get_array("readers")) } else { Vec::new() };
    let nu = derived(value);
    if old == as_vec(&nu) { return false; }
    rec.put_array("readers", nu);
    rec.put_int("time", time());
    store.set_data(lib, id, rec);
    true
}
// Set the groups string on a record's data; true if changed.
fn set_record_groups(lib: &str, id: &str, value: &str) -> bool {
    let store = DataStore::new();
    let mut record = store.get_data(lib, id);
    let mut data_obj = record.get_object("data");
    let old = if data_obj.has("groups") { data_obj.get_string("groups") } else { String::new() };
    if old == value { return false; }
    if value.is_empty() { data_obj.remove_property("groups"); }
    else { data_obj.put_string("groups", value); }
    record.put_object("data", data_obj);
    record.put_int("time", time());
    store.set_data(lib, id, record);
    true
}

let _author = author;
let value = groups.trim().to_string();
let store = DataStore::new();

if ctl.is_empty() {
    let path = store.root.join(&lib).join("meta.json");
    if !path.exists() {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Library '{}' not found (no meta.json)", lib));
        return o;
    }
    let s = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(e) => {
            let mut o = DataObject::new();
            o.put_string("status", "err");
            o.put_string("msg", &format!("Unable to read meta.json for '{}': {}", lib, e));
            return o;
        }
    };
    let mut meta = DataObject::from_string(&s);
    let old = if meta.has("groups") { meta.get_string("groups") } else { String::new() };
    let oldreaders = if meta.has("readers") { as_vec(&meta.get_array("readers")) } else { Vec::new() };
    let nureaders = derived(&value);
    let changed = old != value || oldreaders != as_vec(&nureaders);
    if changed {
        if value.is_empty() { meta.remove_property("groups"); }
        else { meta.put_string("groups", &value); }
        meta.put_array("readers", nureaders);
        if let Err(e) = std::fs::write(&path, meta.to_string()) {
            let mut o = DataObject::new();
            o.put_string("status", "err");
            o.put_string("msg", &format!("Unable to write meta.json for '{}': {}", lib, e));
            return o;
        }
    }
    let mut o = DataObject::new();
    o.put_string("status", "ok");
    o.put_boolean("changed", changed);
    o.put_string("groups", &value);
    o.put_array("readers", derived(&value));
    return o;
}

let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

let mut changed = false;

if cmd.is_empty() {
    // The control record: intent string + enforced readers, then the same
    // readers onto its inline data records — these are the records app.read
    // serves to the browser, so they gate what the UI can even render.
    if set_record_groups(&lib, &ctlid, &value) { changed = true; }
    if set_record_readers(&lib, &ctlid, &value) { changed = true; }
    let data_obj = store.get_data(&lib, &ctlid).get_object("data");
    if data_obj.has("data") {
        let list = data_obj.get_array("data");
        for i in 0..list.len() {
            let item = list.get_object(i);
            if item.has("id") {
                let did = item.get_string("id");
                if store.exists(&lib, &did) {
                    if set_record_readers(&lib, &did, &value) { changed = true; }
                }
            }
        }
    }
} else {
    let data_obj = store.get_data(&lib, &ctlid).get_object("data");
    let list = if data_obj.has("cmd") { data_obj.get_array("cmd") } else { DataArray::new() };
    let mut cmd_id = String::new();
    for i in 0..list.len() {
        let item = list.get_object(i);
        if item.get_string("name") == cmd {
            cmd_id = item.get_string("id");
            break;
        }
    }
    if cmd_id.is_empty() || !store.exists(&lib, &cmd_id) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Command '{}' not found in control '{}'", cmd, ctl));
        return o;
    }
    let cmd_doc = store.get_data(&lib, &cmd_id).get_object("data");
    let lang = if cmd_doc.has("type") { cmd_doc.get_string("type") } else { "rust".to_string() };
    if !cmd_doc.has(&lang) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Command '{}' has no impl record", cmd));
        return o;
    }
    let impl_id = cmd_doc.get_string(&lang);
    if !store.exists(&lib, &impl_id) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", "Command metadata not found in datastore");
        return o;
    }
    // The groups intent string lives on the impl record (set_command_meta's
    // chain); readers go on BOTH the meta record (the array check_security
    // consults) and the impl record (old editcommand parity).
    if set_record_groups(&lib, &impl_id, &value) { changed = true; }
    if set_record_readers(&lib, &cmd_id, &value) { changed = true; }
    if set_record_readers(&lib, &impl_id, &value) { changed = true; }
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
o.put_string("groups", &value);
o.put_array("readers", derived(&value));
o

}
