use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "desc", "groups"] {
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
        let arg_1: String = o.get_string("desc");
        let arg_2: String = o.get_string("groups");
        set_library_meta(arg_0, arg_1, arg_2)
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

pub fn set_library_meta(lib: String, desc: String, groups: String) -> DataObject {
let store = DataStore::new();
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

// Empty string leaves a field untouched. Metadata only: the enforced
// permission lists (meta.json readers/writers) are deliberately not
// editable here.
let mut changed = false;
if !desc.is_empty() {
    meta.put_string("desc", &desc);
    changed = true;
}
if !groups.is_empty() {
    meta.put_string("groups", &groups);
    changed = true;
}

if changed {
    if let Err(e) = std::fs::write(&path, meta.to_string()) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Unable to write meta.json for '{}': {}", lib, e));
        return o;
    }
}

// Like dev.libsettings.save_library_config, this edits meta.json on disk;
// the in-memory system.libraries snapshot refreshes on restart.
let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
o
}
