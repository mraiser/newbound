use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "from", "to"] {
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
        let arg_1: String = o.get_string("from");
        let arg_2: String = o.get_string("to");
        rename_asset(arg_0, arg_1, arg_2)
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

pub fn rename_asset(lib: String, from: String, to: String) -> DataObject {
fn bad_name(name: &str) -> bool {
    name.is_empty()
        || name.starts_with('/')
        || name.contains('\\')
        || name.split('/').any(|seg| seg.is_empty() || seg == "." || seg == "..")
}

if bad_name(&from) || bad_name(&to) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Invalid asset name: use a relative path inside _ASSETS ('style.css', 'vendor/lib.js'); no leading '/', no '..'.");
    return o;
}

let store = DataStore::new();
let libdir = store.root.join(&lib);
if !libdir.exists() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' not found", lib));
    return o;
}

let base = libdir.join("_ASSETS");
let src = base.join(&from);
if !src.is_file() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("No such asset: {}", from));
    return o;
}
let dst = base.join(&to);
if dst.exists() {
    // No silent clobber: delete_asset the target first if replacement is meant.
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Target asset already exists: {}", to));
    return o;
}
if let Some(parent) = dst.parent() {
    if let Err(e) = std::fs::create_dir_all(parent) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Unable to create asset directory: {}", e));
        return o;
    }
}
if let Err(e) = std::fs::rename(&src, &dst) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Unable to rename asset: {}", e));
    return o;
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("from", &from);
o.put_string("to", &to);
o
}
