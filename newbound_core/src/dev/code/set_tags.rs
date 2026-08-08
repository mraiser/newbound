use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use ndata::dataarray::DataArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "cmd", "tags", "author"] {
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
        let arg_3: String = o.get_string("tags");
        let arg_4: String = o.get_string("author");
        set_tags(arg_0, arg_1, arg_2, arg_3, arg_4)
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

pub fn set_tags(lib: String, ctl: String, cmd: String, tags: String, author: String) -> DataObject {
// Comma-delimited CATEGORIZATION tags (agent discovery, dest-* homes, deprecated marks, memory keying). Plain metadata - carries NO permission meaning. The groups field is SECURITY groups and is never written by tag conventions (the owner's correction, 2026-07-31).
// Targeting: ctl=="" -> the library's meta.json; cmd=="" -> the control
// record; else the command's IMPL record (set_command_meta's chain).
// EXPLICIT REPLACE: the value is stored verbatim; empty string CLEARS the
// field (unlike set_*_meta's empty-means-untouched). Unjournaled like the
// meta family. Record-level readers/writers are never modified here.
let _author = author;
let value = tags.trim().to_string();
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
    let old = if meta.has("tags") { meta.get_string("tags") } else { String::new() };
    let changed = old != value;
    if changed {
        if value.is_empty() { meta.remove_property("tags"); }
        else { meta.put_string("tags", &value); }
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
    o.put_string("tags", &value);
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

let target_id = if cmd.is_empty() {
    ctlid.clone()
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
    impl_id
};

let mut record = store.get_data(&lib, &target_id);
let mut data_obj = record.get_object("data");
let old = if data_obj.has("tags") { data_obj.get_string("tags") } else { String::new() };
let changed = old != value;
if changed {
    if value.is_empty() { data_obj.remove_property("tags"); }
    else { data_obj.put_string("tags", &value); }
    record.put_object("data", data_obj);
    record.put_int("time", time());
    store.set_data(&lib, &target_id, record);
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
o.put_string("tags", &value);
o

}
