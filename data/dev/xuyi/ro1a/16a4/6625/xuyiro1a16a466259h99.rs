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