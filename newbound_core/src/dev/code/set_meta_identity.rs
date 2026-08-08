use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["displayname", "organization", "author"] {
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
        let arg_0: String = o.get_string("displayname");
        let arg_1: String = o.get_string("organization");
        let arg_2: String = o.get_string("author");
        set_meta_identity(arg_0, arg_1, arg_2)
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

pub fn set_meta_identity(displayname: String, organization: String, author: String) -> DataObject {
// Publishing signs libraries with the instance's meta identity — the
// runtime/metaidentity record publishapp reads (and, on its known FIXME,
// panics without). This setter creates or wholly replaces the record, so
// the publish panel's identity form can close that wrinkle at the root on
// a fresh instance. Unjournaled like write_asset (there is no _patches
// home for the runtime lib); the canonical repo's git history is the
// record. `author` is accepted for symmetry with every other mutation.

if displayname.trim().is_empty() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "A display name is required - publishing signs libraries with it");
    return o;
}

let _author = author;
let store = DataStore::new();
let created = !store.exists("runtime", "metaidentity");
let mut rec;
let mut d;
if created {
    rec = DataObject::new();
    rec.put_string("id", "metaidentity");
    rec.put_string("username", "admin");
    rec.put_array("readers", DataArray::new());
    rec.put_array("writers", DataArray::new());
    d = DataObject::new();
} else {
    rec = store.get_data("runtime", "metaidentity");
    d = rec.get_object("data");
}
d.put_string("displayname", &displayname);
d.put_string("organization", &organization);
rec.put_object("data", d);
rec.put_int("time", time());
store.set_data("runtime", "metaidentity", rec);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("created", created);
o.put_string("displayname", &displayname);
o.put_string("organization", &organization);
o

}
