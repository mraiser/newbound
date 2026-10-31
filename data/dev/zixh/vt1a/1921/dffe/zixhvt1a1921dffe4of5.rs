// R5: the ORDINARY run of a saved flow command - no debug session, no tape,
// no snapshots, no 10k debug budget. The same gate as app.app.exec (library
// check, check_auth, nn_sessionid, cast_params), then flowlang's own stepper
// (flowlang::stepper::step_stack - the one execution semantics Code::execute
// runs) driven to the end on the default pick, mirroring stepper::run's loop.
// The driver only OBSERVES: root-frame `next` events close a path segment,
// the terminal event closes the last one; per-case time is monotonic
// (Instant) at this boundary. Event recording is optional and its cap never
// touches the path or the result. ONE mapping turns the end into the
// app.app.exec envelope (format_result on ok/terminate).
const DEFAULT_BUDGET: i64 = 1_000_000; // == flowlang::stepper::run(budget<=0): the cap Command::execute runs under
fn err_env(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}
fn s_of(o: &DataObject, k: &str) -> String {
    if o.has(k) && o.get_property(k).is_string() { o.get_string(k) } else { String::new() }
}
fn panic_text(p: &Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = p.downcast_ref::<String>() { s.clone() } else if let Some(s) = p.downcast_ref::<&str>() { s.to_string() } else { "unknown error".to_string() }
}
fn seg(case: i64, end: &str, op: Option<i64>, t: &Instant, steps: i64) -> DataObject {
    let us = t.elapsed().as_micros() as i64;
    let mut s = DataObject::new();
    s.put_int("case", case);
    s.put_string("end", end);
    if let Some(o) = op { s.put_int("op", o); }
    s.put_int("ms", us / 1000);
    s.put_int("us", us);
    s.put_int("steps", steps);
    s
}
let t0 = Instant::now();
if !DataStore::globals().get_object("system").get_object("libraries").has(&lib) {
    return err_env(&format!("NO SUCH LIBRARY: {}", lib));
}
let store = DataStore::new();
let id = store.lookup_cmd_id(&lib, &ctl, &cmd);
if id.is_empty() { return err_env(&format!("Command {}:{}:{} not found", lib, ctl, cmd)); }
if !check_auth(&lib, &id, &nn_sessionid, false) { return err_env("UNAUTHORIZED"); }
let command = Command::new(&lib, &id);
if command.lang != "flow" {
    return err_env(&format!("'{}' is not a flow command (type is '{}')", cmd, command.lang));
}
// the app.app.exec gate: the caller's args handle, nn_sessionid, cast_params
let mut a = args.clone();
a.put_string("nn_sessionid", &nn_sessionid);
command.cast_params(a.clone());
let body = command.src().to_data();
let max: i64 = if budget == 0 { DEFAULT_BUDGET } else if budget < 0 { i64::MAX } else { budget };
let keep = events;
let mut frames = DataArray::new();
frames.push_object(stepper::new_frame(a, "root", body, DataArray::new()));
let pick = DataObject::new();
let mut steps: i64 = 0;
let mut max_depth: i64 = 1;
let mut last = DataObject::new();
let mut path = DataArray::new();
let mut evs = DataArray::new();
let mut ev_trunc = false;
let mut case_t = Instant::now();
let mut case_steps: i64 = 0;
let mut stop = String::new(); // "" = the root ended | budget | fatal | panic
let ran = panic::catch_unwind(panic::AssertUnwindSafe(|| {
    loop {
        let n = frames.len();
        if n == 0 {
            let mut e = DataObject::new();
            e.put_string("type", "error"); e.put_string("code", "panic"); e.put_string("msg", "the frame stack is empty");
            last = e; stop = "fatal".to_string(); break;
        }
        if frames.get_object(0).get_string("phase") == "ended" { break; }
        if steps >= max {
            let mut e = DataObject::new();
            e.put_string("type", "error"); e.put_string("code", "budget");
            e.put_string("msg", &format!("the run's step budget ({} steps) ran out before the flow ended - a safety limit, not a flow failure", max));
            last = e; stop = "budget".to_string(); break;
        }
        let e = stepper::step_stack(&mut frames, &pick);
        steps += 1;
        case_steps += 1;
        let d = frames.len() as i64;
        if d > max_depth { max_depth = d; }
        if keep != 0 {
            if keep < 0 || (evs.len() as i64) < keep { evs.push_object(e.clone()); } else { ev_trunc = true; }
        }
        let et = s_of(&e, "type");
        let at_root = !(e.has("frame") && e.get_property("frame").is_array() && e.get_array("frame").len() > 0);
        if at_root && et == "next" {
            let from = if e.has("from") { e.get_int("from") } else { e.get_int("case") };
            let op = if e.has("op") { Some(e.get_int("op")) } else { None };
            path.push_object(seg(from, "next", op, &case_t, case_steps));
            case_t = Instant::now();
            case_steps = 0;
        }
        // stepper::run's terminal-event break: a fatal event ends the whole run
        if frames.get_object(0).get_string("phase") != "ended" && (et == "error" || et == "stall") {
            last = e; stop = "fatal".to_string(); break;
        }
        last = e;
    }
}));
if let Err(p) = ran {
    let mut e = DataObject::new();
    e.put_string("type", "error"); e.put_string("code", "panic"); e.put_string("msg", &panic_text(&p));
    last = e; stop = "panic".to_string();
}
// the outcome, exactly as stepper::run reads it
let et = s_of(&last, "type");
let (outcome, out_obj) = if stop.is_empty() {
    let root = frames.get_object(0);
    let mut oc = { let o = root.get_string("outcome"); if o.is_empty() { "ok".to_string() } else { o } };
    if oc == "ok" && (et == "stall" || et == "error") { oc = "fail".to_string(); }
    if et == "terminate" { oc = "terminate".to_string(); }
    (oc, root.get_object("out"))
} else { ("fail".to_string(), DataObject::new()) };
let code = s_of(&last, "code");
let end: String = if stop == "budget" { "budget".to_string() }
    else if et == "done" || et == "terminate" || et == "fail" { if outcome == "ok" { "done".to_string() } else { outcome.clone() } }
    else if et == "stall" { "stall".to_string() }
    else if et == "error" { if code.is_empty() { "error".to_string() } else { code.clone() } }
    else if outcome == "ok" { "done".to_string() } else { outcome.clone() };
let root_case = if frames.len() > 0 { frames.get_object(0).get_int("case") } else { 0 };
let end_op = if last.has("op") && last.get_property("op").is_int() { Some(last.get_int("op")) } else { None };
path.push_object(seg(root_case, &end, end_op, &case_t, case_steps));
// THE mapping: ok and terminate deliver the output so far through app.app.exec's format_result
let result = if outcome == "ok" || outcome == "terminate" {
    match panic::catch_unwind(panic::AssertUnwindSafe(move || format_result(command, out_obj))) {
        Ok(x) => x,
        Err(p) => {
            // app.app.exec's own panic envelope, verbatim
            let s = format!("<html><head><title>500 - Server Error</title></head><body><h2>500</h2>Server Error: {}</body></html>", panic_text(&p));
            let mut o = DataObject::new();
            o.put_string("body", &s); o.put_int("code", 500); o.put_string("mimetype", "text/html");
            o.put_string("status", "err"); o.put_string("msg", &s);
            o
        }
    }
} else {
    let msg = if stop == "budget" { s_of(&last, "msg") }
        else if et == "done" || et == "fail" { "the flow failed: a fail rule fired".to_string() }
        else if et == "stall" { format!("the flow stalled: {}", { let m = s_of(&last, "msg"); if m.is_empty() { "no progress".to_string() } else { m } }) }
        else { format!("the flow errored [{}]: {}", if code.is_empty() { "error" } else { &code }, s_of(&last, "msg")) };
    let mut o = err_env(&msg);
    o.put_string("flow_end", &end);
    if stop == "budget" { o.put_boolean("budget_exhausted", true); o.put_int("budget", max); }
    o
};
let total_us = t0.elapsed().as_micros() as i64;
let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_object("result", result);
o.put_int("cases", path.len() as i64);
o.put_array("path", path);
o.put_boolean("complete", true);
o.put_string("outcome", &outcome);
o.put_string("end", &end);
o.put_int("steps", steps);
o.put_int("max_depth", max_depth);
o.put_int("budget", if budget < 0 { -1 } else { max });
o.put_int("ms", total_us / 1000);
o.put_int("us", total_us);
if keep != 0 {
    o.put_array("events", evs);
    o.put_boolean("events_truncated", ev_trunc);
    o.put_int("events_total", steps);
}
DataStore::gc();
o