use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        debug_reap()
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

pub fn debug_reap() -> DataObject {
// Timer target (flow step debugger P3): drops debug sessions idle for more than 30 minutes (touched is
// refreshed by every debug_* call and by a running continue). A session whose continue is still running is
// kept unless it has been idle for 2 hours, in which case it is paused and dropped.
let idle_ms: i64 = 30 * 60 * 1000;
let hard_ms: i64 = 2 * 60 * 60 * 1000;
let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0);
let mut o = DataObject::new();
let g = DataStore::globals();
let mut removed = DataArray::new();
let mut kept = 0i64;
if g.has("flowstep_debug") && g.get_property("flowstep_debug").is_object() {
  let mut all = g.get_object("flowstep_debug");
  for (id, s) in all.objects() {
    if !s.is_object() { removed.push_string(&id); continue; }
    let mut s = s.object();
    let touched = if s.has("touched") && s.get_property("touched").is_int() { s.get_int("touched") } else { 0 };
    let running = s.has("running") && s.get_property("running").is_boolean() && s.get_boolean("running");
    let idle = now - touched;
    if (!running && idle > idle_ms) || idle > hard_ms { s.put_boolean("pause", true); removed.push_string(&id); } else { kept += 1; }
  }
  for i in 0..removed.len() { all.remove_property(&removed.get_string(i)); }
}
o.put_string("status", "ok");
o.put_array("removed", removed);
o.put_int("kept", kept);
o
}
