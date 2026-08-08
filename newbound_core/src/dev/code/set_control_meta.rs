use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use ndata::dataobject::DataObject;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "desc", "groups"] {
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
        let arg_2: String = o.get_string("desc");
        let arg_3: String = o.get_string("groups");
        set_control_meta(arg_0, arg_1, arg_2, arg_3)
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

pub fn set_control_meta(lib: String, ctl: String, desc: String, groups: String) -> DataObject {
let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

let mut record = store.get_data(&lib, &ctlid);
let mut data_obj = record.get_object("data");

// Empty string leaves a field untouched. `groups` is the platform's
// comma-delimited security-group string, stored verbatim (the same field
// the dev editor's save_control writes). Record-level readers/writers are
// not modified.
let mut changed = false;
if !desc.is_empty() {
    data_obj.put_string("desc", &desc);
    changed = true;
}
if !groups.is_empty() {
    data_obj.put_string("groups", &groups);
    changed = true;
}

if changed {
    record.put_object("data", data_obj);
    record.put_int("time", time());
    store.set_data(&lib, &ctlid, record);
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
o
}
