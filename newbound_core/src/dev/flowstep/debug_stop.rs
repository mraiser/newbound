use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["session"] {
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
        let arg_0: String = o.get_string("session");
        debug_stop(arg_0)
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

pub fn debug_stop(session: String) -> DataObject {
// End a debug session (flow step debugger P3): a running continue is told to pause, and the session (tape,
// branches, live state) is dropped from memory. Persistent globals stay as they are at the session's cursor.
fn err(msg: &str) -> DataObject { let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", msg); o }
let g = DataStore::globals();
if !(g.has("flowstep_debug") && g.get_property("flowstep_debug").is_object()) { return err(&format!("no debug session '{}'", session)); }
let mut all = g.get_object("flowstep_debug");
if !(all.has(&session) && all.get_property(&session).is_object()) { return err(&format!("no debug session '{}' (stopped or reaped?)", session)); }
let mut s = all.get_object(&session);
let running = s.has("running") && s.get_property("running").is_boolean() && s.get_boolean("running");
s.put_boolean("pause", true);
let cursor = if s.has("cursor") { s.get_int("cursor") } else { 0 };
all.remove_property(&session);
let mut o = DataObject::new();
o.put_string("status", "ok"); o.put_string("session", &session); o.put_boolean("was_running", running); o.put_int("cursor", cursor);
o
}
