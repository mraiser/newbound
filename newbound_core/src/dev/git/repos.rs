use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        repos()
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

pub fn repos() -> DataObject {
// Read-only window onto runtime/dev/repos.json - the registry every
// dev.git command resolves repo names against. An absent file is an
// empty registry, not an error.
let regpath = DataStore::new().root.parent().unwrap()
    .join("runtime").join("dev").join("repos.json");
let mut o = DataObject::new();
if !regpath.exists() {
    o.put_string("status", "ok");
    o.put_object("repos", DataObject::new());
    o.put_int("count", 0);
    return o;
}
match DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap()) {
    Ok(entries) => {
        o.put_string("status", "ok");
        o.put_int("count", entries.get_keys().len() as i64);
        o.put_object("repos", entries);
    }
    Err(_) => {
        o.put_string("status", "err");
        o.put_string("msg", &format!("{} is not valid JSON", regpath.display()));
    }
}
o
}
