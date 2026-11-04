use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["body", "args", "policy", "budget"] {
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
        let arg_0: DataObject = o.get_object("body");
        let arg_1: DataObject = o.get_object("args");
        let arg_2: String = o.get_string("policy");
        let arg_3: i64 = o.get_int("budget");
        run(arg_0, arg_1, arg_2, arg_3)
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

pub fn run(body: DataObject, args: DataObject, policy: String, budget: i64) -> DataObject {
// Continue a flow to its end through step(), one event per step. policy picks among the READY items of the
// top frame: default (flowlang's sweep order - the same run as Code::execute), first, last, or random:<seed>.
// budget bounds the number of steps; running out pauses (not an event).
fn lcg(s: &mut u64) -> u64 { *s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); *s >> 33 }
let mut res = DataObject::new();
let mut state = DataObject::new();
state.put_object("body", body.clone());
state.put_object("args", args.clone());
let mut seed: u64 = 0;
let mode = if policy.starts_with("random") {
  seed = policy.split(':').nth(1).and_then(|x| x.trim().parse::<u64>().ok()).unwrap_or(1);
  "random".to_string()
} else if policy == "first" || policy == "last" { policy.clone() } else { "default".to_string() };
let max = if budget <= 0 { 10000 } else { budget };
let mut events = DataArray::new();
let mut end = DataObject::new();
let mut ended = false;
let mut steps = 0i64;
let mut user_picks = 0i64;
let mut max_depth = 1i64;
while steps < max {
  let mut pick = DataObject::new();
  if mode != "default" && state.has("frames") {
    // ask the stepper for the ready set without stepping: a refused pick returns it unchanged
    let mut probe = DataObject::new(); probe.put_string("kind", "op"); probe.put_int("index", -1);
    let pr = super::step::step(state.clone(), probe);
    let ready = if pr.has("ready") { pr.get_array("ready") } else { DataArray::new() };
    let mut cands: Vec<DataObject> = Vec::new();
    for r in ready.objects() { let r = r.object(); let k = r.get_string("kind"); if k == "wire" || k == "sync" || k == "op" { cands.push(r); } }
    if !cands.is_empty() {
      let c = if mode == "first" { cands[0].clone() } else if mode == "last" { cands[cands.len() - 1].clone() } else { let j = (lcg(&mut seed) as usize) % cands.len(); cands[j].clone() };
      pick.put_string("kind", &c.get_string("kind")); pick.put_int("index", c.get_int("index"));
      user_picks += 1;
    }
  }
  let r = super::step::step(state.clone(), pick);
  if r.get_string("status") != "ok" { res.put_string("status", "err"); res.put_string("msg", &format!("step refused: {}", r.get_string("msg"))); res.put_array("events", events); return res; }
  steps += 1;
  if r.has("depth") && r.get_int("depth") > max_depth { max_depth = r.get_int("depth"); }
  if r.has("event") && r.get_property("event").is_object() { let e = r.get_object("event"); end = e.clone(); events.push_object(e); }
  state = r.get_object("state");
  if r.get_boolean("ended") { ended = true; break; }
}
let mut env = DataObject::new();
if !ended { env.put_string("status", "paused"); env.put_string("msg", &format!("step budget of {} ran out", max)); }
else {
  let t = end.get_string("type");
  if t == "done" && !end.get_boolean("fail") { env.put_string("status", "ok"); env.put_object("data", end.get_object("out")); }
  else if t == "done" { env.put_string("status", "err"); env.put_string("msg", "fail"); }
  else if t == "stall" { env.put_string("status", "err"); env.put_string("msg", &format!("stall: {}", end.to_string())); }
  else { env.put_string("status", "err"); env.put_string("msg", &format!("error {}: {}", end.get_string("code"), if end.has("msg") { end.get_string("msg") } else { "".to_string() })); }
}
res.put_string("status", "ok");
res.put_object("result", env);
res.put_object("end", end);
res.put_boolean("ended", ended);
res.put_int("steps", steps);
res.put_int("picks", user_picks);
res.put_int("max_depth", max_depth);
res.put_string("policy", &policy);
res.put_array("events", events);
res
}
