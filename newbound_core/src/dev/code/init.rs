use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        init()
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

pub fn init() -> DataObject {
// Timer-fired once at boot (start 0, no repeat), on the same pattern as
// security.security.init and peer.reboot.init. A clone-built instance has
// no data/runtime (identity keys are redacted from the repo), so
// runtime/metaidentity is absent and dev.editcontrol.publishapp panics on
// its known FIXME. When the record is missing, seed the platform's
// historical default identity - the "Some Dev" the shipped library
// meta.json files carry - so a fresh checkout publishes out of the box
// with no hand-seeding. The workbench publish pane's identity form edits
// it from there; an instance that already has an identity is untouched.
let store = DataStore::new();
let mut o = DataObject::new();
o.put_string("status", "ok");
if store.exists("runtime", "metaidentity") {
    o.put_boolean("created", false);
} else {
    let r = crate::dev::code::set_meta_identity::set_meta_identity(
        "Some Dev".to_string(), String::new(), "system".to_string(), String::new());
    if r.get_string("status") != "ok" { return r; }
    println!("dev.code.init: seeded runtime/metaidentity as \"Some Dev\"");
    o.put_boolean("created", true);
}
o

}
