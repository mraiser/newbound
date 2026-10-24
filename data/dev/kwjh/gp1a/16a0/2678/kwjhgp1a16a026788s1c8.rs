// Flow step debugger core - P6: DELEGATES to the flowlang crate's stepper (flowlang::stepper),
// the single source of truth for flow execution. The stepper used to be a copy here (P2); now
// Code::execute is a continue-to-end over the same crate stepper, so the debugger and the runtime
// share one execution semantics (spec: dev/_ASSETS/docs/flow-language.md 1.5.4). This command keeps
// only the debug-session wrapper: the state bootstrap, the pick validation (a not-ready pick is
// refused with the state unchanged), the seq bookkeeping, and the {state, event, ready, default,
// ended, depth} envelope. The step itself is flowlang::stepper::step_stack over the crate's frame
// shape (flowlang::stepper::new_frame / copy_frame), so a saved debug state is interchangeable with
// a runtime frame stack.
use flowlang::stepper as st;

fn panic_text(p: &Box<dyn std::any::Any + Send>) -> String {
  if let Some(s) = p.downcast_ref::<&str>() { s.to_string() }
  else if let Some(s) = p.downcast_ref::<String>() { s.clone() }
  else { "unknown panic".to_string() }
}

let mut res = DataObject::new();
if !st::is_obj(&state, "body") {
  res.put_string("status", "err");
  res.put_string("msg", "state needs body (the flow's root Case JSON) and args; pass {body, args} to start a run");
  return res;
}
let body = state.get_object("body");
let mut frames = DataArray::new();
if st::is_arr(&state, "frames") && state.get_array("frames").len() > 0 {
  for fr in state.get_array("frames").objects() { frames.push_object(st::copy_frame(&fr.object())); }
} else if st::is_obj(&state, "frame") {
  // a P1-shaped state (one root frame)
  let mut f0 = st::copy_frame(&state.get_object("frame"));
  if !st::is_obj(&f0, "body") { f0.put_object("body", body.clone()); }
  if !st::is_arr(&f0, "path") { f0.put_array("path", DataArray::new()); }
  frames.push_object(f0);
} else {
  let args = if st::is_obj(&state, "args") { state.get_object("args").deep_copy() } else { DataObject::new() };
  frames.push_object(st::new_frame(args, "root", body.clone(), DataArray::new()));
}
let seq = if state.has("seq") { state.get_int("seq") } else { 0 };
let mut ns = DataObject::new();
ns.put_object("body", body.clone());
let root = frames.get_object(0);
if root.get_string("phase") == "ended" {
  let depth = frames.len() as i64;
  ns.put_array("frames", frames); ns.put_int("seq", seq);
  res.put_string("status", "ok"); res.put_object("state", ns); res.put_null("event");
  res.put_boolean("ended", true); res.put_array("ready", DataArray::new()); res.put_int("depth", depth);
  return res;
}
let top = frames.get_object(frames.len() - 1);
let mut pk = DataObject::new();
if pick.has("kind") {
  let kind = pick.get_string("kind");
  let ready = st::ready_set(&top.get_object("case"), &top);
  let idx = if pick.has("index") { pick.get_int("index") } else { -1 };
  let mut found = false;
  let mut k = 0;
  for r in ready.objects() {
    let r = r.object();
    if r.get_string("kind") == kind && k == idx { found = true; break; }
    if r.get_string("kind") == kind { k += 1; }
  }
  if !found {
    res.put_string("status", "err");
    res.put_string("msg", "pick is not READY in the top frame; state unchanged");
    res.put_object("state", state.clone());
    return res;
  }
  pk.put_string("kind", &kind);
  pk.put_int("index", idx);
}
let stepped = panic::catch_unwind(panic::AssertUnwindSafe(|| st::step_stack(&mut frames, &pk)));
let out = match stepped {
  Ok(o) => o,
  Err(e) => {
    res.put_string("status", "err");
    res.put_string("msg", &format!("step panic: {}", panic_text(&e)));
    res.put_object("state", state.clone());
    return res;
  }
};
ns.put_array("frames", frames);
ns.put_int("seq", seq + 1);
res.put_string("status", "ok");
res.put_object("state", ns);
res.put_object("event", out.get_object("event"));
res.put_array("ready", out.get_array("ready"));
res.put_object("default", out.get_object("default"));
res.put_boolean("ended", out.get_boolean("ended"));
res.put_int("depth", out.get_int("depth"));
res