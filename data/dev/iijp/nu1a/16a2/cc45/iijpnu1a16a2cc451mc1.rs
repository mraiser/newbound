// Step modes over step() (spec: dev/_ASSETS/docs/flow-language.md 1.5.4, Frames). A UNIT is a frame (pushed by
// a local or flow-command op) or an op in progress (list/loop iterations). Every mode takes at least one
// step; the first step uses pick ({} = the default pick), every later step the default pick.
//  into     - one step.
//  over     - one step; if it opened a unit (pushed a frame, started an op in progress, or began an
//             iteration) continue until that unit has closed (for a frame: its leave AND the closing eval).
//  out      - finish the innermost open unit: with an op in progress in the top frame, until that op is no
//             longer in progress; inside a nested frame, until the frame is popped and the enclosing op's
//             closing eval ran; in the root frame with nothing in progress, to the end.
//  run_to   - continue until the next DEFAULT pick is target {kind: wire|sync|op, index} (optionally in frame
//             path target.frame and case target.case) - a breakpoint: it stops BEFORE that item runs.
//  continue - to the end.
// over == into followed by out wherever the step opens a unit (both continue on the default picks).
// budget bounds the steps (<= 0 means 10000); running out stops with stopped = budget (a pause, not an event).
fn depth_of(s: &DataObject) -> i64 { if s.has("frames") && s.get_property("frames").is_array() { s.get_array("frames").len() as i64 } else { 1 } }
fn top_of(s: &DataObject) -> Option<DataObject> {
  if s.has("frames") && s.get_property("frames").is_array() { let a = s.get_array("frames"); if a.len() > 0 { return Some(a.get_object(a.len() - 1)); } }
  None
}
fn top_inprog(s: &DataObject) -> bool { match top_of(s) { Some(t) => t.has("inprog") && t.get_property("inprog").is_object(), None => false } }
fn top_stage(s: &DataObject) -> String { if top_inprog(s) { top_of(s).unwrap().get_object("inprog").get_string("stage") } else { String::new() } }
fn top_path(s: &DataObject) -> String { match top_of(s) { Some(t) => if t.has("path") && t.get_property("path").is_array() { t.get_array("path").to_string() } else { "[]".to_string() }, None => "[]".to_string() } }
fn top_case(s: &DataObject) -> i64 { match top_of(s) { Some(t) => t.get_int("case"), None => 0 } }
fn hits(r: &DataObject, st: &DataObject, target: &DataObject) -> bool {
  if !(r.has("default") && r.get_property("default").is_object()) { return false; }
  let d = r.get_object("default");
  if !target.has("kind") || d.get_string("kind") != target.get_string("kind") { return false; }
  if !target.has("index") || d.get_int("index") != target.get_int("index") { return false; }
  if target.has("frame") && target.get_property("frame").is_array() && target.get_array("frame").to_string() != top_path(st) { return false; }
  if target.has("case") && target.get_property("case").is_int() && target.get_int("case") != top_case(st) { return false; }
  true
}
let mut res = DataObject::new();
let modes = ["into", "over", "out", "run_to", "continue"];
if !modes.contains(&mode.as_str()) {
  res.put_string("status", "err"); res.put_string("msg", &format!("mode '{}' is not one of into, over, out, run_to, continue", mode));
  res.put_object("state", state.clone()); return res;
}
if mode == "run_to" && !(target.has("kind") && target.has("index")) {
  res.put_string("status", "err"); res.put_string("msg", "run_to needs target {kind: wire|sync|op, index} (frame and case optional)");
  res.put_object("state", state.clone()); return res;
}
let max = if budget <= 0 { 10000 } else { budget };
let d0 = depth_of(&state);
let ip0 = top_inprog(&state);
let mut st = state.clone();
let mut events = DataArray::new();
let mut steps = 0i64;
let mut last = DataObject::new();
let mut stopped = "budget".to_string();
// the unit `over` waits for, decided by its first step: 0 none, 1 frame, 2 op in progress, 3 iteration
let mut unit = 0;
while steps < max {
  let pk = if steps == 0 { pick.clone() } else { DataObject::new() };
  let r = super::step::step(st.clone(), pk);
  if r.get_string("status") != "ok" {
    if steps == 0 {
      res.put_string("status", "err"); res.put_string("msg", &r.get_string("msg"));
      if r.has("ready") { res.put_array("ready", r.get_array("ready")); }
      res.put_object("state", state.clone()); return res;
    }
    stopped = format!("refused: {}", r.get_string("msg")); break;
  }
  steps += 1;
  let e = if r.has("event") && r.get_property("event").is_object() { Some(r.get_object("event")) } else { None };
  if let Some(e) = &e { events.push_object(e.clone()); }
  st = r.get_object("state");
  last = r.clone();
  if r.get_boolean("ended") { stopped = "ended".to_string(); break; }
  let d = depth_of(&st); let ip = top_inprog(&st); let stage = top_stage(&st);
  if steps == 1 && mode == "over" {
    let et = match &e { Some(e) => e.get_string("type"), None => String::new() };
    if d > d0 { unit = 1; } else if d == d0 && !ip0 && ip { unit = 2; } else if d == d0 && ip0 && et == "iter" { unit = 3; }
  }
  let ok = match mode.as_str() {
    "into" => true,
    "over" => match unit { 1 => d <= d0 && stage != "closing", 2 => d <= d0 && !ip, 3 => d <= d0 && (!ip || stage == "iter"), _ => true },
    "out" => if ip0 { d <= d0 && !ip } else if d0 > 1 { d < d0 && stage != "closing" } else { false },
    "run_to" => hits(&r, &st, &target),
    _ => false,
  };
  if ok { stopped = if mode == "run_to" { "reached".to_string() } else { "stepped".to_string() }; break; }
}
res.put_string("status", "ok");
res.put_string("mode", &mode);
res.put_string("stopped", &stopped);
res.put_int("steps", steps);
res.put_boolean("ended", last.has("ended") && last.get_boolean("ended"));
res.put_int("depth", depth_of(&st));
if last.has("ready") { res.put_array("ready", last.get_array("ready")); } else { res.put_array("ready", DataArray::new()); }
if last.has("default") && last.get_property("default").is_object() { res.put_object("default", last.get_object("default")); } else { res.put_null("default"); }
if last.has("event") && last.get_property("event").is_object() { res.put_object("event", last.get_object("event")); } else { res.put_null("event"); }
res.put_array("events", events);
res.put_object("state", st);
res