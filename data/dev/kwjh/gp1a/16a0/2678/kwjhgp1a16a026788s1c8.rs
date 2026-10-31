// Flow step debugger core - P6: DELEGATES to the flowlang crate's stepper (flowlang::stepper),
// the single source of truth for flow execution. Code::execute is a continue-to-end over the same
// crate stepper, so the debugger and the runtime share one execution semantics (spec:
// dev/_ASSETS/docs/flow-language.md 1.5.4). This command keeps only the debug-session wrapper:
// the state bootstrap, the pick validation (a not-ready pick is refused with the state unchanged),
// the seq bookkeeping, and the {state, event, ready, default, ended, depth} envelope. The step
// itself is flowlang::stepper::step_stack over the crate's frame shape (new_frame / copy_frame),
// so a saved debug state is interchangeable with a runtime frame stack.
//
// R2 repair (against flowlang 0.3.41):
//  - step_stack returns the EVENT object directly (not an {event,...} wrapper) - the old adapter
//    read out.get_object("event") and died on the first real step ("Key 'event' not found").
//  - a frame's `case` is an INTEGER index - the old pick validation read top.get_object("case")
//    (a panic); the current case comes from st::case_at(body, case_index).
//  - ready_set indices ARE graph indices, so an explicit pick validates by graph identity
//    ({kind, index} membership in the post-step top-frame ready set), never by an ordinal within
//    the ready subset of that kind; the same number is forwarded to step_stack unchanged.
//  - the envelope's post-step ready/default come from st::ready_now / st::default_pick with the
//    session's own semantics; `ended` is the root phase.
use flowlang::stepper as st;

fn panic_text(p: &Box<dyn std::any::Any + Send>) -> String {
  if let Some(s) = p.downcast_ref::<&str>() { s.to_string() }
  else if let Some(s) = p.downcast_ref::<String>() { s.clone() }
  else { "unknown panic".to_string() }
}
fn end_state(frames: &DataArray) -> DataObject {
  let mut d = DataObject::new();
  d.put_boolean("ended", frames.get_object(0).get_string("phase") == "ended");
  d.put_int("depth", frames.len() as i64);
  d
}
// Readiness is a VIEW, never extra execution state. Both successful steps and refused picks report
// the current top frame's real ready set and default; default_pick touches only a throwaway frame copy.
fn ready_view(top: &DataObject) -> (DataArray, Option<DataObject>) {
  if top.get_string("phase") != "run" { return (DataArray::new(), None); }
  let ready = st::ready_now(top);
  // R6: a pending rule effect ({kind: effect, op, rule}) or an op in progress ({kind: auto, op, stage}) is
  // not pickable - the pick validation below refuses everything but wire/sync/op, and step_stack performs
  // that item next whatever the pick - so IT is the default. default_pick only sweeps wires/syncs/ops and
  // named an item that does not run (a wire, while the next rule fired or a list op iterated), which made
  // breakpoints and run_to targets on that wire stop falsely and the editor's "next" lie.
  for r in ready.objects() {
    if !r.is_object() { continue; }
    let o = r.object();
    if o.has("kind") && o.get_property("kind").is_string() {
      let k = o.get_string("kind");
      if k != "wire" && k != "sync" && k != "op" { return (ready.clone(), Some(o.deep_copy())); }
    }
  }
  let dflt = match st::case_at(&top.get_object("body"), top.get_int("case")) {
    Some(c) => {
      let mut peek = st::copy_frame(top);
      st::default_pick(&c, &mut peek).map(|(k, i)| {
        let mut o = DataObject::new(); o.put_string("kind", &k); o.put_int("index", i as i64); o
      })
    },
    None => None,
  };
  (ready, dflt)
}
fn put_ready_view(res: &mut DataObject, ready: DataArray, dflt: Option<DataObject>) {
  res.put_array("ready", ready);
  match dflt { Some(d) => res.put_object("default", d), None => res.put_null("default") };
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
  // Values enter by handle, exactly as in Code::execute. A plain deep_copy here splits mutual aliases
    // between parameters before the first step (R3), changing every later in-place mutation.
    let args = if st::is_obj(&state, "args") { state.get_object("args") } else { DataObject::new() };
  frames.push_object(st::new_frame(args, "root", body.clone(), DataArray::new()));
}
let seq = if state.has("seq") { state.get_int("seq") } else { 0 };
let mut ns = DataObject::new();
ns.put_object("body", body.clone());
let mut root = frames.get_object(0);
// R6 (nested fatal): a top frame that is "ended" above a live root is the residual stack of a nested
// error/stall. The run is over - apply step_stack's terminal frame-stack invariant (its `ended` arm ends
// the root) WITHOUT emitting that arm's "the run has already ended" event, which is not a flow event.
if frames.len() > 1 && root.get_string("phase") != "ended" && frames.get_object(frames.len() - 1).get_string("phase") == "ended" {
  root.put_string("phase", "ended");
}
if root.get_string("phase") == "ended" {
  ns.put_array("frames", frames.clone()); ns.put_int("seq", seq);
  res.put_string("status", "ok"); res.put_object("state", ns); res.put_null("event");
  res.put_boolean("ended", true); res.put_array("ready", DataArray::new());
  res.put_null("default"); res.put_int("depth", frames.len() as i64);
  return res;
}
// Validate an explicit pick against the CURRENT top frame by graph identity before stepping, so a
// bad pick leaves the state untouched. kind/index are required ints/strings; anything not in the
// current ready set is refused with status err (never a panic, never a forced execution).
let mut pk = DataObject::new();
if pick.has("kind") {
  if !pick.get_property("kind").is_string() || !pick.has("index") || !pick.get_property("index").is_int() {
    res.put_string("status", "err");
    res.put_string("msg", "pick needs kind wire|sync|op and an integer index");
    res.put_object("state", state.clone());
    let (ready, dflt) = ready_view(&frames.get_object(frames.len() - 1));
    put_ready_view(&mut res, ready, dflt);
    return res;
  }
  let kind = pick.get_string("kind");
  if !(kind == "wire" || kind == "sync" || kind == "op") || !pick.has("index") || !pick.get_property("index").is_int() {
    res.put_string("status", "err");
    res.put_string("msg", "pick needs kind wire|sync|op and an integer index");
    res.put_object("state", state.clone());
    let (ready, dflt) = ready_view(&frames.get_object(frames.len() - 1));
    put_ready_view(&mut res, ready, dflt);
    return res;
  }
  let idx = pick.get_int("index");
  let top = frames.get_object(frames.len() - 1);
  if top.get_string("phase") != "run" {
    res.put_string("status", "err");
    res.put_string("msg", "no ready pick is available before the top frame is running (mid enter/seed); take the default step");
    res.put_object("state", state.clone());
    let (ready, dflt) = ready_view(&top);
    put_ready_view(&mut res, ready, dflt);
    return res;
  }
  let cur = st::ready_now(&top);
  let mut found = false;
  for r in cur.objects() {
    let r = r.object();
    if r.has("kind") && r.get_string("kind") == kind && r.has("index") && r.get_property("index").is_int() && r.get_int("index") == idx { found = true; break; }
  }
  if !found {
    res.put_string("status", "err");
    res.put_string("msg", &format!("pick {} {} is not READY in the top frame; state unchanged", kind, idx));
    res.put_object("state", state.clone());
    let (ready, dflt) = ready_view(&top);
    put_ready_view(&mut res, ready, dflt);
    return res;
  }
  pk.put_string("kind", &kind);
  pk.put_int("index", idx);
}
let stepped = panic::catch_unwind(panic::AssertUnwindSafe(|| st::step_stack(&mut frames, &pk)));
let event = match stepped {
  Ok(e) => e,
  Err(e) => {
    res.put_string("status", "err");
    res.put_string("msg", &format!("step panic: {}", panic_text(&e)));
    res.put_object("state", state.clone());
    return res;
  }
};
// R6 (nested fatal): the crate's own terminal rule, mirrored EXACTLY from flowlang::stepper::run's
// terminal-event break - an error or stall event is terminal for the whole run even when a NESTED frame
// emitted it (err_ev / stall_ev end only that frame). End the root on THIS step, as step_stack's `ended`
// arm would on the next one, so `ended` is true on the fatal event's own reply and no residual step
// (a synthetic error "ended") is ever executed or recorded by run / drive / debug_step.
{
  let et = if event.has("type") && event.get_property("type").is_string() { event.get_string("type") } else { String::new() };
  let mut root = frames.get_object(0);
  if root.get_string("phase") != "ended" && (et == "error" || et == "stall") { root.put_string("phase", "ended"); }
}
// Post-step view: ready/default from the NEW top frame with the session's semantics, ended from
// the root phase, depth = frames. default_pick mutates only the cursor of a throwaway copy. A top
// frame not yet in `run` (mid enter/seed) carries no ready arrays - report an empty ready and a
// null default rather than dereference state seed has not built yet.
let top = frames.get_object(frames.len() - 1);
let (ready, dflt) = ready_view(&top);
let es = end_state(&frames);
ns.put_array("frames", frames);
ns.put_int("seq", seq + 1);
res.put_string("status", "ok");
res.put_object("state", ns);
res.put_object("event", event);
put_ready_view(&mut res, ready, dflt);
res.put_boolean("ended", es.get_boolean("ended"));
res.put_int("depth", es.get_int("depth"));
res