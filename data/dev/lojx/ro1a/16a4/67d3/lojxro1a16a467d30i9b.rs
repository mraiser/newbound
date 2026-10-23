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