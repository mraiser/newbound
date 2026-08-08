use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        get_meta_identity()
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

pub fn get_meta_identity() -> DataObject {
// The read half of the meta-identity pair. /app/read cannot serve the
// runtime lib (it answers 500 - the lib is store-only, never app-loaded),
// so the publish panel reads through this instead. Returns exists=false
// with empty fields on a fresh instance - the state set_meta_identity
// (and its form) exists to fix, because publishapp panics in it.
let store = DataStore::new();
let mut o = DataObject::new();
o.put_string("status", "ok");
if store.exists("runtime", "metaidentity") {
    let d = store.get_data("runtime", "metaidentity").get_object("data");
    o.put_boolean("exists", true);
    let dn = if d.has("displayname") { d.get_string("displayname") } else { String::new() };
    let og = if d.has("organization") { d.get_string("organization") } else { String::new() };
    o.put_string("displayname", &dn);
    o.put_string("organization", &og);
} else {
    o.put_boolean("exists", false);
    o.put_string("displayname", "");
    o.put_string("organization", "");
}
o

}
