// The case path of ONE real run. P5: no sentinel-nextcase — the run is ONE
// debug session over the stepper (dev.flowstep debug_start + debug_step
// continue + debug_state + debug_stop), the same interpreter path the
// editor's run button and the debugger ride. The case path is read off the
// session's root frames (one per case it entered, with its outcome); each
// case's ms is the sum of its stepper events' ms on that case.
fn err_env(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}
let store = DataStore::new();
let id = store.lookup_cmd_id(&lib, &ctl, &cmd);
if id.is_empty() { return err_env(&format!("Command {}:{}:{} not found", lib, ctl, cmd)); }
if !check_auth(&lib, &id, &nn_sessionid, false) { return err_env("UNAUTHORIZED"); }
let command = Command::new(&lib, &id);
if command.lang != "flow" {
    return err_env(&format!("'{}' is not a flow command (type is '{}')", cmd, command.lang));
}
let mut out = DataObject::new();
out.put_string("status", "ok");
let mut path = DataArray::new();
let mut args = args.clone();
args.put_string("nn_sessionid", &nn_sessionid);
// open a session on the SAVED body (debug_start with an empty body reads it)
let st = {
    let mut a = DataObject::new();
    a.put_string("lib", &lib); a.put_string("ctl", &ctl); a.put_string("cmd", &cmd);
    a.put_object("body", DataObject::new());
    a.put_object("args", args.clone());
    let (l, c, m) = (lib.clone(), ctl.clone(), cmd.clone());
    match panic::catch_unwind(panic::AssertUnwindSafe(move || Command::lookup("dev", "flowstep", "debug_start").execute(a))) {
        Ok(Ok(r)) => r,
        _ => return err_env(&format!("{}.{}.{}: the stepper refused to open a session", l, c, m)),
    }
};
if !st.has("session") || !st.get_property("session").is_string() {
    let msg = if st.has("msg") { st.get_string("msg") } else { "no session".to_string() };
    return err_env(&format!("debug_start failed: {}", msg));
}
let session = st.get_string("session");
// run to the end
let fin = {
    let mut a = DataObject::new();
    a.put_string("session", &session);
    a.put_string("mode", "continue");
    let mut p = DataObject::new(); p.put_boolean("wait", true);
    a.put_object("pick", p);
    match panic::catch_unwind(panic::AssertUnwindSafe(move || Command::lookup("dev", "flowstep", "debug_step").execute(a))) {
        Ok(Ok(r)) => r,
        _ => {
            let mut z = DataObject::new(); z.put_string("session", &session);
            let _ = Command::lookup("dev", "flowstep", "debug_stop").execute(z);
            return err_env("debug_step continue panicked");
        }
    }
};
let st2 = {
    let mut a = DataObject::new();
    a.put_string("session", &session);
    match panic::catch_unwind(panic::AssertUnwindSafe(move || Command::lookup("dev", "flowstep", "debug_state").execute(a))) {
        Ok(Ok(r)) => r,
        _ => DataObject::new(),
    }
};
// per-case ms: sum each event's ms over the case it happened on
let mut case_ms: std::collections::HashMap<i64, i64> = std::collections::HashMap::new();
if st2.has("last_run") && st2.get_property("last_run").is_object() {
    let lr = st2.get_object("last_run");
    if lr.has("events") && lr.get_property("events").is_array() {
        for ev in lr.get_array("events").objects() {
            let ev = ev.object();
            if ev.has("case") && ev.has("ms") {
                let k = ev.get_int("case");
                *case_ms.entry(k).or_insert(0) += ev.get_int("ms");
            }
        }
    }
}
// the case path: one entry per root frame (a case the run entered)
let mut last_end = "done".to_string();
if st2.has("state") && st2.get_property("state").is_object() {
    let state = st2.get_object("state");
    if state.has("frames") && state.get_property("frames").is_array() {
        for f in state.get_array("frames").objects() {
            let f = f.object();
            if !(f.has("kind") && f.get_string("kind") == "root") { continue; }
            let case_i = if f.has("case") { f.get_int("case") } else { 0 };
            let phase = if f.has("phase") { f.get_string("phase") } else { "done".to_string() };
            let outcome = if f.has("outcome") { f.get_string("outcome") } else { "done".to_string() };
            let end = if phase == "ended" { outcome } else { phase };
            last_end = end.clone();
            let mut step = DataObject::new();
            step.put_int("case", case_i);
            step.put_string("end", &end);
            step.put_int("ms", *case_ms.get(&case_i).unwrap_or(&0));
            path.push_object(step);
        }
    }
}
{
    let mut a = DataObject::new();
    a.put_string("session", &session);
    let _ = panic::catch_unwind(panic::AssertUnwindSafe(move || { let _ = Command::lookup("dev", "flowstep", "debug_stop").execute(a); }));
}
// the result envelope: the run's own output, formatted as app.app.exec would
let failure = if st2.has("ended") && st2.get_property("ended").is_boolean() && st2.get_boolean("ended") {
    let ev = if st2.has("event") && st2.get_property("event").is_object() { st2.get_object("event") } else { DataObject::new() };
    if ev.has("type") && ev.get_string("type") == "done" && (!ev.has("fail") || !ev.get_boolean("fail")) && ev.has("outcome") && ev.get_string("outcome") == "ok" {
        None
    } else if ev.has("type") && (ev.get_string("type") == "stall" || ev.get_string("type") == "error") {
        Some(err_env(&format!("the flow {}: {}", ev.get_string("type"), if ev.has("msg") { ev.get_string("msg") } else { "no progress".to_string() })))
    } else if last_end == "panic" {
        Some(err_env("the flow panicked"))
    } else if last_end == "fail" || (ev.has("fail") && ev.get_boolean("fail")) {
        Some(err_env("the flow failed: a fail rule fired"))
    } else if last_end != "done" && last_end != "ok" {
        Some(err_env(&format!("the run ended ({})", last_end)))
    } else { None }
} else {
    Some(err_env(&format!("the run did not end ({})", if fin.has("msg") { fin.get_string("msg") } else { "no done".to_string() })))
};
let result = match failure {
    Some(e) => e,
    None => {
        let ev = st2.get_object("event");
        let mut acc = DataObject::new();
        if ev.has("out") && ev.get_property("out").is_object() { acc = ev.get_object("out"); }
        let cmd2 = Command::new(&lib, &id);
        match panic::catch_unwind(panic::AssertUnwindSafe(move || format_result(cmd2, acc))) {
            Ok(x) => x,
            Err(_) => err_env("Server Error: format_result panicked"),
        }
    }
};
DataStore::gc();
out.put_object("result", result);
out.put_array("path", path);
out.put_int("cases", path.len() as i64);
out