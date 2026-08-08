use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "cmd", "desc", "groups"] {
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
        let arg_3: String = o.get_string("desc");
        let arg_4: String = o.get_string("groups");
        set_command_meta(arg_0, arg_1, arg_2, arg_3, arg_4)
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

pub fn set_command_meta(lib: String, ctl: String, cmd: String, desc: String, groups: String) -> DataObject {
let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
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
    o.put_string("msg", &format!("Command '{}' not found in control '{}'", cmd, ctl));
    return o;
}

if !store.exists(&lib, &cmd_id) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Command metadata not found in datastore");
    return o;
}

let mut cmd_rec = store.get_data(&lib, &cmd_id);
let mut cmd_doc = cmd_rec.get_object("data");
let lang = if cmd_doc.has("type") { cmd_doc.get_string("type") } else { "rust".to_string() };

if !cmd_doc.has(&lang) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Implementation ID for language '{}' not found", lang));
    return o;
}
let impl_id = cmd_doc.get_string(&lang);

if !store.exists(&lib, &impl_id) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Implementation record not found in datastore");
    return o;
}

let mut impl_rec = store.get_data(&lib, &impl_id);
let mut impl_doc = impl_rec.get_object("data");

// desc and groups live on the implementation record (the dev editor's
// save_command writes them there); empty string leaves a field untouched.
// Record-level readers/writers are not modified.
let mut changed = false;
if !desc.is_empty() {
    impl_doc.put_string("desc", &desc);
    // Keep a legacy desc on the command record itself in sync —
    // read_command prefers it when present.
    if cmd_doc.has("desc") {
        cmd_doc.put_string("desc", &desc);
        cmd_rec.put_object("data", cmd_doc);
        cmd_rec.put_int("time", time());
        store.set_data(&lib, &cmd_id, cmd_rec);
    }
    changed = true;
}
if !groups.is_empty() {
    impl_doc.put_string("groups", &groups);
    changed = true;
}

if changed {
    impl_rec.put_object("data", impl_doc);
    impl_rec.put_int("time", time());
    store.set_data(&lib, &impl_id, impl_rec);
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
o
}
