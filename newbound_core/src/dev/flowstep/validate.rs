use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use ndata::data::Data;
use std::panic;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["body", "args", "events"] {
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
        let arg_2: DataArray = o.get_array("events");
        validate(arg_0, arg_1, arg_2)
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

pub fn validate(body: DataObject, args: DataObject, events: DataArray) -> DataObject {
// The validity checker: replays an event trace against an INDEPENDENT shadow model of the language
// (sections 1.5-1.5.4), not the stepper's code, and confirms each event's preconditions held: the item
// picked was ready (data dependencies delivered, synchro sources done, nothing pending, no other op in
// progress), values match their sources, rules follow from the op's condition, and the run ended only when
// it had to. P2: the model is a FRAME STACK - enter pushes (a local's localdata, or a flow callee's saved
// body), leave pops into the enclosing op's closing eval; list/loop ops are iter + per-iteration evals
// whose inputs, collected outputs, loop feedback and last-iteration test are re-derived here.
fn deq(a: &Data, b: &Data) -> bool {
  if a.is_object() && b.is_object() {
    let (x, y) = (a.object(), b.object());
    let (kx, ky) = (x.clone().keys(), y.clone().keys());
    if kx.len() != ky.len() { return false; }
    for k in kx { if !y.has(&k) || !deq(&x.get_property(&k), &y.get_property(&k)) { return false; } }
    return true;
  }
  if a.is_array() && b.is_array() {
    let (x, y) = (a.array(), b.array());
    if x.len() != y.len() { return false; }
    for i in 0..x.len() { if !deq(&x.get_property(i), &y.get_property(i)) { return false; } }
    return true;
  }
  if a.is_object() || b.is_object() || a.is_array() || b.is_array() { return false; }
  let mut w1 = DataObject::new(); w1.set_property("v", a.clone());
  let mut w2 = DataObject::new(); w2.set_property("v", b.clone());
  w1.to_string() == w2.to_string()
}
// 0 = equal; 1 = same container kind but different contents (an in-place primitive such as set/push
// mutated a shared handle after it was recorded - legal aliasing, noted not violated); 2 = mismatch.
fn vcmp(a: &Data, b: &Data) -> u8 {
  if deq(a, b) { 0 } else if (a.is_object() && b.is_object()) || (a.is_array() && b.is_array()) { 1 } else { 2 }
}
fn ocmp(a: &Data, b: &DataObject) -> u8 {
  if !a.is_object() { return 2; }
  let x = a.object();
  let (kx, kb) = (x.clone().keys(), b.clone().keys());
  if kx.len() != kb.len() { return 2; }
  let mut w = 0u8;
  for k in kb { if !x.has(&k) { return 2; } let c = vcmp(&x.get_property(&k), &b.get_property(&k)); if c > w { w = c; } }
  w
}
fn has_obj(o: &DataObject, k: &str) -> bool { o.has(k) && o.get_property(k).is_object() }
fn nth_case(body: &DataObject, idx: i64) -> Option<DataObject> {
  let mut c = body.clone();
  for _ in 0..idx { if c.has("nextcase") { c = c.get_object("nextcase"); } else { return None; } }
  Some(c)
}
struct Shadow {
  cmds: Vec<DataObject>, cons: Vec<(i64, String, i64, String)>, syncs: Vec<(i64, i64)>,
  wf: Vec<bool>, sf: Vec<bool>, done: Vec<bool>, res: Vec<Option<DataObject>>,
  got: Vec<Vec<String>>, vals: Vec<DataObject>, has_next: bool,
}
// an op in progress: stage iter | body | frame | closing
struct OpRun {
  op: usize, iterated: bool, stage: String, it: i64, nl: usize, count: i64,
  li: Vec<String>, lo: Vec<String>, lp: Vec<(String, String)>,
  vals: DataObject, in3: DataObject, coll: DataObject, last_rule: Option<String>, ofin: bool,
  keys: Vec<String>, child: Option<(String, DataObject, bool)>,
}
struct VFrame {
  body: DataObject, path: String, cidx: i64, sh: Option<Shadow>, out: DataObject, args: DataObject,
  pending: Option<(String, i64)>, expect: Option<String>, closing: Option<String>, fin: bool, run: Option<OpRun>,
}
fn sv(s: i64, d: i64, n: usize) -> bool { s >= 0 && d >= 0 && s != d && (s as usize) < n && (d as usize) < n }
fn load(case: &DataObject) -> Shadow {
  let mut cmds = Vec::new(); for c in case.get_array("cmds").objects() { cmds.push(c.object()); }
  let mut cons = Vec::new();
  for c in case.get_array("cons").objects() { let c = c.object(); let (s, d) = (c.get_array("src"), c.get_array("dest")); cons.push((s.get_int(0), s.get_string(1), d.get_int(0), d.get_string(1))); }
  let mut syncs = Vec::new();
  if case.has("syncs") { for s in case.get_array("syncs").objects() { let s = s.object(); syncs.push((s.get_int("src"), s.get_int("dest"))); } }
  let n = cmds.len();
  let names: Vec<String> = cons.iter().map(|c| c.3.clone()).collect();
  let mut got = Vec::new(); let mut vals = Vec::new();
  for op in &cmds {
    let mut g = Vec::new(); let mut v = DataObject::new();
    for k in op.get_object("in").keys() { if !names.contains(&k) { g.push(k.clone()); v.put_null(&k); } }
    got.push(g); vals.push(v);
  }
  Shadow { wf: vec![false; cons.len()], sf: vec![false; syncs.len()], done: vec![false; n], res: vec![None; n], cmds, cons, syncs, got, vals, has_next: case.has("nextcase") }
}
fn src_avail(sh: &Shadow, k: usize) -> bool { let s = sh.cons[k].0; s == -1 || (s >= 0 && (s as usize) < sh.cmds.len() && sh.done[s as usize]) }
fn op_ok(sh: &Shadow, i: usize) -> bool {
  if sh.done[i] { return false; }
  for k in sh.cmds[i].get_object("in").keys() { if !sh.got[i].contains(&k) { return false; } }
  let n = sh.cmds.len();
  for (s, d) in &sh.syncs { if *d == i as i64 && sv(*s, *d, n) && !sh.done[*s as usize] { return false; } }
  true
}
fn any_ready(sh: &Shadow) -> bool {
  let n = sh.cmds.len();
  for k in 0..sh.cons.len() { if !sh.wf[k] && src_avail(sh, k) { return true; } }
  for (k, (s, d)) in sh.syncs.iter().enumerate() { if !sh.sf[k] && (!sv(*s, *d, n) || sh.done[*s as usize]) { return true; } }
  for i in 0..n { if op_ok(sh, i) { return true; } }
  false
}
// list inputs, list outputs, loop outputs (output -> input it feeds)
fn op_modes(op: &DataObject) -> (Vec<String>, Vec<String>, Vec<(String, String)>) {
  let mut li = Vec::new(); let mut lo = Vec::new(); let mut lp = Vec::new();
  for (k, d) in op.get_object("in").objects() { if d.is_object() && d.object().has("mode") && d.object().get_string("mode") == "list" { li.push(k); } }
  for (k, d) in op.get_object("out").objects() {
    if !d.is_object() { continue; }
    let o = d.object();
    let m = if o.has("mode") { o.get_string("mode") } else { String::new() };
    if m == "list" { lo.push(k); } else if m == "loop" && o.has("loop") && o.get_property("loop").is_string() { lp.push((k, o.get_string("loop"))); }
  }
  (li, lo, lp)
}
fn cond_of(op: &DataObject) -> Option<(String, bool)> {
  if op.get_string("type") == "constant" || !has_obj(op, "condition") { return None; }
  let c = op.get_object("condition");
  Some((c.get_string("rule"), c.get_boolean("value")))
}
fn exits(r: &str) -> bool { r == "next" || r == "terminate" || r == "fail" }
fn path_str(e: &DataObject) -> String { if e.has("frame") && e.get_property("frame").is_array() { e.get_array("frame").to_string() } else { "[]".to_string() } }
fn child_path(parent: &str, op: i64, iter: Data) -> String {
  let mut a = DataArray::from_string(parent);
  let mut at = DataArray::new(); at.push_int(op); at.push_property(iter); a.push_array(at);
  a.to_string()
}
fn is_null(d: &Data) -> bool { matches!(d, Data::DNull) }
// a closed frame's result as the enclosing op sees it: fail = (empty, false); local = (out, true, fin);
// a flow command maps the callee's output keys onto the op's outputs BY POSITION (I-7)
fn closing_of(op: &DataObject, keys: &Vec<String>, child: &(String, DataObject, bool)) -> Option<(DataObject, bool, bool)> {
  if child.0 == "fail" { return Some((DataObject::new(), false, false)); }
  if op.get_string("type") == "local" { return Some((child.1.clone(), true, child.2)); }
  let mut o = DataObject::new();
  for (i, k) in op.get_object("out").keys().iter().enumerate() {
    if i >= keys.len() || !child.1.has(&keys[i]) { return None; }
    o.set_property(k, child.1.get_property(&keys[i]));
  }
  Some((o, true, false))
}
fn callee_body(cmd: &str) -> Option<(DataObject, Vec<String>)> {
  let sa: Vec<String> = cmd.split(':').map(|s| s.to_string()).collect();
  if sa.len() < 3 { return None; }
  let (lib, id) = (sa[0].clone(), sa[2].clone());
  panic::catch_unwind(panic::AssertUnwindSafe(move || {
    let store = DataStore::new();
    let data = store.get_data(&lib, &id).get_object("data");
    let fl = store.get_data(&lib, &data.get_string("flow")).get_object("data").get_object("flow");
    let keys = fl.get_object("output").keys();
    (fl, keys)
  })).ok()
}
fn note(viol: &mut DataArray, seq: i64, t: &str, m: String) { let mut v = DataObject::new(); v.put_int("seq", seq); v.put_string("type", t); v.put_string("msg", &m); viol.push_object(v); }

let mut viol = DataArray::new();
let mut alias = DataArray::new();
let mut stack: Vec<VFrame> = Vec::new();
let mut ended = false;
let mut checked = 0i64;
let mut max_depth = 0i64;
let evs = events.objects();
for (idx, e) in evs.iter().enumerate() {
  let e = e.object();
  let seq = idx as i64;
  let t = e.get_string("type");
  checked += 1;
  if e.has("seq") && e.get_int("seq") != seq { note(&mut viol, seq, &t, format!("seq {} out of order", e.get_int("seq"))); }
  if ended { note(&mut viol, seq, &t, "event after the run ended".to_string()); continue; }
  if idx == 0 {
    if t != "enter" { note(&mut viol, seq, &t, "a run must begin with enter".to_string()); }
    else if !deq(&e.get_property("args"), &Data::DObject(args.data_ref)) { note(&mut viol, seq, &t, "enter args differ from the run's args".to_string()); }
    if path_str(&e) != "[]" { note(&mut viol, seq, &t, "the root frame's path must be []".to_string()); }
    stack.push(VFrame { body: body.clone(), path: "[]".to_string(), cidx: 0, sh: None, out: DataObject::new(), args: args.clone(), pending: None, expect: Some("seed".to_string()), closing: None, fin: false, run: None });
    max_depth = 1;
    continue;
  }
  if stack.is_empty() { note(&mut viol, seq, &t, "no frame is open".to_string()); ended = true; continue; }
  let depth = stack.len();
  let top_path = stack[depth - 1].path.clone();
  if t != "enter" && path_str(&e) != top_path { note(&mut viol, seq, &t, format!("event in frame {} but the top frame is {}", path_str(&e), top_path)); }
  if let Some(x) = stack[depth - 1].expect.clone() {
    if t != x && t != "error" { note(&mut viol, seq, &t, format!("expected {} here", x)); }
  }
  match t.as_str() {
    "seed" => {
      let f = stack.last_mut().unwrap();
      if f.expect.as_deref() != Some("seed") { note(&mut viol, seq, &t, "seed without a preceding enter or next".to_string()); }
      f.expect = None;
      if e.get_int("case") != f.cidx { note(&mut viol, seq, &t, format!("seed of case {} but the chain is at case {}", e.get_int("case"), f.cidx)); }
      match nth_case(&f.body, f.cidx) {
        None => { note(&mut viol, seq, &t, format!("case {} does not exist", f.cidx)); ended = true; }
        Some(c) => {
          let s = load(&c);
          let mut want: Vec<String> = Vec::new();
          for (i, g) in s.got.iter().enumerate() { for k in g { want.push(format!("{}:{}", i, k)); } }
          let mut have: Vec<String> = Vec::new();
          if e.has("pre") { for p in e.get_array("pre").objects() { let p = p.array(); have.push(format!("{}:{}", p.get_int(0), p.get_string(1))); } }
          want.sort(); have.sort();
          if want != have { note(&mut viol, seq, &t, format!("pre-delivered {:?} but the unawaited inputs are {:?}", have, want)); }
          f.sh = Some(s);
        }
      }
    }
    "deliver" | "sync" => {
      let f = stack.last_mut().unwrap();
      if f.pending.is_some() { note(&mut viol, seq, &t, format!("{} while the effect of a fired rule is pending", t)); }
      if let Some(r) = &f.run { note(&mut viol, seq, &t, format!("{} while op {} is in progress (an op in progress is atomic)", t, r.op)); }
      let fargs = f.args.clone();
      let s = match f.sh.as_mut() { Some(s) => s, None => { note(&mut viol, seq, &t, "no case is running".to_string()); continue; } };
      let n = s.cmds.len();
      if t == "deliver" {
        let k = e.get_int("wire") as usize;
        if k >= s.cons.len() { note(&mut viol, seq, &t, format!("wire {} does not exist", k)); continue; }
        if s.wf[k] { note(&mut viol, seq, &t, format!("wire {} fired twice", k)); }
        if !src_avail(s, k) { note(&mut viol, seq, &t, format!("wire {} fired before its source op {} was done", k, s.cons[k].0)); }
        let (si, sn, di, dn) = s.cons[k].clone();
        let want = if si == -1 { if fargs.has(&sn) { fargs.get_property(&sn) } else { Data::DNull } }
          else { match &s.res[si as usize] { Some(r) if r.has(&sn) => r.get_property(&sn), _ => { note(&mut viol, seq, &t, format!("wire {} reads '{}' which op {} did not produce", k, sn, si)); Data::DNull } } };
        match vcmp(&e.get_property("value"), &want) { 0 => {}, 1 => { alias.push_string(&format!("seq {}: wire {} value changed in place since it was recorded", seq, k)); }, _ => note(&mut viol, seq, &t, format!("wire {} carried a value that is not its source's", k)) }
        s.wf[k] = true;
        if di == -2 { f.out.set_property(&dn, want); }
        else if di >= 0 && (di as usize) < n {
          let d = di as usize;
          if s.cmds[d].get_string("type") == "undefined" { s.done[d] = true; s.res[d] = None; }
          else if s.done[d] { if !(e.has("ignored") && e.get_boolean("ignored")) { note(&mut viol, seq, &t, format!("delivery into op {} after it ran must be reported (I-1) and must not re-run it", d)); } }
          else { if !s.got[d].contains(&dn) { s.got[d].push(dn.clone()); } s.vals[d].set_property(&dn, want); }
        }
      } else {
        let k = e.get_int("sync") as usize;
        if k >= s.syncs.len() { note(&mut viol, seq, &t, format!("synchro {} does not exist", k)); continue; }
        if s.sf[k] { note(&mut viol, seq, &t, format!("synchro {} fired twice", k)); }
        let (a, b) = s.syncs[k];
        if sv(a, b, n) { if !s.done[a as usize] { note(&mut viol, seq, &t, format!("synchro {} fired before its src op {} was done", k, a)); } }
        else if !(e.has("inert") && e.get_boolean("inert")) { note(&mut viol, seq, &t, format!("synchro {} has invalid endpoints and must be reported inert (S-1)", k)); }
        s.sf[k] = true;
      }
    }
    "iter" | "enter" | "eval" => {
      if t == "enter" { max_depth = max_depth.max(depth as i64 + 1); }
      let f = stack.last_mut().unwrap();
      if t == "eval" && f.expect.as_deref() == Some("eval") { f.expect = None; }
      if f.pending.is_some() { note(&mut viol, seq, &t, format!("{} while the effect of a fired rule is pending", t)); }
      let i = e.get_int("op") as usize;
      let fpath = f.path.clone();
      let s = match f.sh.as_mut() { Some(s) => s, None => { note(&mut viol, seq, &t, "no case is running".to_string()); continue; } };
      let n = s.cmds.len();
      if i >= n { note(&mut viol, seq, &t, format!("op {} does not exist", i)); continue; }
      let op = s.cmds[i].clone();
      let (li, lo, lp) = op_modes(&op);
      let iterated = !li.is_empty() || !lp.is_empty();
      let from_frame = e.has("from_frame") && e.get_boolean("from_frame");
      // starting an op (no op in progress): the P1 readiness checks
      let starting = f.run.is_none();
      if starting {
        if from_frame { note(&mut viol, seq, &t, format!("op {}: a closing eval with no frame open", i)); }
        if s.done[i] { note(&mut viol, seq, &t, format!("op {} evaluated after it was done (re-run)", i)); }
        for k in op.get_object("in").keys() { if !s.got[i].contains(&k) { note(&mut viol, seq, &t, format!("op {} started before its input '{}' was delivered", i, k)); } }
        for (a, b) in &s.syncs { if *b == i as i64 && sv(*a, *b, n) && !s.done[*a as usize] { note(&mut viol, seq, &t, format!("op {} started before synchro src op {} was done", i, a)); } }
      } else if f.run.as_ref().unwrap().op != i {
        note(&mut viol, seq, &t, format!("{} of op {} while op {} is in progress (an op in progress is atomic)", t, i, f.run.as_ref().unwrap().op)); continue;
      }
      // the list count of an iterated op, from its delivered inputs
      let mut count: i64 = -1;
      for k in &li { let d = if s.vals[i].has(k) { s.vals[i].get_property(k) } else { Data::DNull }; let l = if d.is_array() { d.array().len() as i64 } else { -1 }; if count < 0 || l < count { count = l; } }
      if t == "iter" {
        if starting {
          if !iterated { note(&mut viol, seq, &t, format!("iter of op {}, which has no list input and no loop output", i)); continue; }
          if lp.is_empty() && count == 0 { note(&mut viol, seq, &t, format!("op {} has zero iterations: one eval, no iter", i)); }
          let mut coll = DataObject::new(); for k in &lo { coll.put_array(k, DataArray::new()); }
          let mut vals = DataObject::new(); for (k, v) in s.vals[i].objects() { vals.set_property(&k, v); }
          f.run = Some(OpRun { op: i, iterated: true, stage: "iter".to_string(), it: 0, nl: li.len(), count, li: li.clone(), lo: lo.clone(), lp: lp.clone(), vals, in3: DataObject::new(), coll, last_rule: None, ofin: false, keys: Vec::new(), child: None });
        }
        let run = f.run.as_mut().unwrap();
        if run.stage != "iter" { note(&mut viol, seq, &t, format!("iter of op {} at stage {}", i, run.stage)); }
        if e.get_int("i") != run.it { note(&mut viol, seq, &t, format!("iter {} but iteration {} is next", e.get_int("i"), run.it)); }
        let en = e.get_property("n");
        if run.nl > 0 { if !(en.is_int() && en.int() == run.count) { note(&mut viol, seq, &t, format!("iter n must be the shortest list length {}", run.count)); } }
        else if !is_null(&en) { note(&mut viol, seq, &t, "an open loop's iter n must be null".to_string()); }
        let mut in3 = DataObject::new();
        let mut past = false;
        for (k, v) in run.vals.objects() {
          if run.li.contains(&k) { let a = if v.is_array() { v.array() } else { DataArray::new() }; if run.it as usize >= a.len() { past = true; } else { in3.set_property(&k, a.get_property(run.it as usize)); } }
          else { in3.set_property(&k, v); }
        }
        if past { note(&mut viol, seq, &t, format!("iteration {} of op {} indexes past the end of a list input", run.it, i)); }
        match ocmp(&e.get_property("in"), &in3) { 0 => {}, 1 => { alias.push_string(&format!("seq {}: op {} iteration input container changed in place", seq, i)); }, _ => note(&mut viol, seq, &t, format!("iteration {} of op {} has inputs that are not its delivered values / list elements / loop feedback", run.it, i)) }
        run.in3 = in3; run.stage = "body".to_string();
      } else if t == "enter" {
        let it = e.get_property("iter");
        if starting {
          if iterated { note(&mut viol, seq, &t, format!("op {} iterates: each iteration enters after its iter", i)); }
          if !is_null(&it) { note(&mut viol, seq, &t, "a non-iterated op's frame has iter null".to_string()); }
          match ocmp(&e.get_property("args"), &s.vals[i]) { 0 => {}, 1 => { alias.push_string(&format!("seq {}: op {} frame args changed in place", seq, i)); }, _ => note(&mut viol, seq, &t, format!("frame args of op {} are not its delivered inputs", i)) }
          f.run = Some(OpRun { op: i, iterated: false, stage: "frame".to_string(), it: 0, nl: 0, count: -1, li: Vec::new(), lo: Vec::new(), lp: Vec::new(), vals: DataObject::new(), in3: DataObject::new(), coll: DataObject::new(), last_rule: None, ofin: false, keys: Vec::new(), child: None });
        } else {
          let run = f.run.as_mut().unwrap();
          if run.stage != "body" { note(&mut viol, seq, &t, format!("enter for op {} at stage {}", i, run.stage)); }
          if !(it.is_int() && it.int() == run.it) { note(&mut viol, seq, &t, format!("enter must carry iter {}", run.it)); }
          match ocmp(&e.get_property("args"), &run.in3) { 0 => {}, 1 => { alias.push_string(&format!("seq {}: op {} frame args changed in place", seq, i)); }, _ => note(&mut viol, seq, &t, format!("frame args of op {} iteration {} are not that iteration's inputs", i, run.it)) }
          run.stage = "frame".to_string();
        }
        let want_path = child_path(&fpath, i as i64, e.get_property("iter"));
        if path_str(&e) != want_path { note(&mut viol, seq, &t, format!("enter path {} but the frame of op {} is {}", path_str(&e), i, want_path)); }
        let typ = op.get_string("type");
        let cb: Option<(DataObject, Vec<String>)> = if typ == "local" && has_obj(&op, "localdata") { Some((op.get_object("localdata"), Vec::new())) }
          else if typ == "command" && op.has("cmd") {
            if e.get_string("cmd") != op.get_string("cmd") { note(&mut viol, seq, &t, format!("enter names {} but op {} calls {}", e.get_string("cmd"), i, op.get_string("cmd"))); }
            callee_body(&op.get_string("cmd"))
          } else { None };
        match cb {
          None => { note(&mut viol, seq, &t, format!("op {} of type {} opens no frame", i, typ)); ended = true; }
          Some((cbody, keys)) => {
            f.run.as_mut().unwrap().keys = keys;
            let a = if has_obj(&e, "args") { e.get_object("args") } else { DataObject::new() };
            stack.push(VFrame { body: cbody, path: want_path, cidx: 0, sh: None, out: DataObject::new(), args: a, pending: None, expect: Some("seed".to_string()), closing: None, fin: false, run: None });
          }
        }
      } else {
        // eval: a plain op, a zero-iteration op, a closing frame's result, or one iteration
        let rule = if e.has("rule") && e.get_property("rule").is_string() { Some(e.get_string("rule")) } else { None };
        let b = if e.has("b") { e.get_boolean("b") } else { true };
        let done = if e.has("done") { e.get_boolean("done") } else { true };
        let eout = if has_obj(&e, "out") { e.get_object("out") } else { DataObject::new() };
        let cond = cond_of(&op);
        if starting || !f.run.as_ref().unwrap().iterated {
          // whole-op eval
          if starting {
            if e.has("in") { match ocmp(&e.get_property("in"), &s.vals[i]) { 0 => {}, 1 => { alias.push_string(&format!("seq {}: op {} input container changed in place since delivery", seq, i)); }, _ => note(&mut viol, seq, &t, format!("op {} evaluated with inputs that are not the delivered values", i)) } }
            if iterated {
              if !(lp.is_empty() && count == 0) { note(&mut viol, seq, &t, format!("op {} iterates but was evaluated without iter steps", i)); }
              else {
                if !(e.has("iters") && e.get_property("iters").is_int() && e.get_int("iters") == 0) { note(&mut viol, seq, &t, format!("zero-iteration op {} must report iters 0", i)); }
                let mut z = DataObject::new(); for k in op.get_object("out").keys() { if lo.contains(&k) { z.put_array(&k, DataArray::new()); } else { z.put_null(&k); } }
                if ocmp(&e.get_property("out"), &z) == 2 { note(&mut viol, seq, &t, format!("zero-iteration op {}: list outputs [] and the others null", i)); }
                if rule.is_some() { note(&mut viol, seq, &t, format!("zero-iteration op {} has no condition to fire", i)); }
              }
            } else if op.get_string("type") == "local" && has_obj(&op, "localdata") {
              note(&mut viol, seq, &t, format!("op {} is a local with localdata: it opens a frame and cannot be one eval", i));
            }
          } else {
            let run = f.run.as_ref().unwrap();
            if !from_frame || run.stage != "closing" { note(&mut viol, seq, &t, format!("op {} is in progress at stage {}: only its closing eval may follow", i, run.stage)); }
            match &run.child {
              None => note(&mut viol, seq, &t, format!("closing eval of op {} with no left frame", i)),
              Some(ch) => match closing_of(&op, &run.keys, ch) {
                None => note(&mut viol, seq, &t, format!("op {}: the callee's out lacks a positional output (that is error absent-output)", i)),
                Some((xo, xb, _)) => {
                  if xb != b { note(&mut viol, seq, &t, format!("op {} closing b={} but the frame's outcome {} means b={}", i, b, ch.0, xb)); }
                  match ocmp(&e.get_property("out"), &xo) { 0 => {}, 1 => { alias.push_string(&format!("seq {}: op {} frame out changed in place", seq, i)); }, _ => note(&mut viol, seq, &t, format!("op {} closing out is not the frame's result", i)) }
                }
              },
            }
          }
          match &cond {
            Some((cr, cv)) => {
              let fires = cr == "next" || cr == "terminate" || cr == "fail" || cr == "finish";
              match &rule {
                Some(r) => { if r != cr { note(&mut viol, seq, &t, format!("op {} reported rule {} but its condition's rule is {}", i, r, cr)); } else if b != *cv { note(&mut viol, seq, &t, format!("op {} fired {} with b={} but the condition needs {}", i, r, b, cv)); } }
                None => { if fires && b == *cv && !(iterated && starting) { note(&mut viol, seq, &t, format!("op {}'s condition {}={} held (b={}) but no rule was reported", i, cr, cv, b)); } }
              }
            }
            None => { if rule.is_some() { note(&mut viol, seq, &t, format!("op {} reported a rule but has no live condition", i)); } }
          }
          let ends = matches!(rule.as_deref(), Some("next") | Some("terminate") | Some("fail"));
          if done == ends { note(&mut viol, seq, &t, format!("op {} done={} contradicts rule {:?}", i, done, rule)); }
          if done { s.done[i] = true; s.res[i] = Some(eout.clone()); }
          if let Some(r) = rule { f.pending = Some((r, i as i64)); }
          f.run = None;
        } else {
          // one iteration's eval (its body ran, or its frame closed)
          let run = f.run.as_mut().unwrap();
          let want_stage = if from_frame { "closing" } else { "body" };
          if run.stage != want_stage { note(&mut viol, seq, &t, format!("iteration eval of op {} at stage {} (expected {})", i, run.stage, want_stage)); }
          if !(e.has("iter") && e.get_property("iter").is_int() && e.get_int("iter") == run.it) { note(&mut viol, seq, &t, format!("iteration eval must carry iter {}", run.it)); }
          match ocmp(&e.get_property("in"), &run.in3) { 0 => {}, 1 => { alias.push_string(&format!("seq {}: op {} iteration input changed in place", seq, i)); }, _ => note(&mut viol, seq, &t, format!("iteration {} of op {} evaluated with inputs other than its iter inputs", run.it, i)) }
          // the iteration's own result
          let mut ires = if done && has_obj(&e, "iter_out") { e.get_object("iter_out") } else { eout.clone() };
          let mut fin = false;
          if from_frame {
            match &run.child {
              None => note(&mut viol, seq, &t, format!("closing eval of op {} with no left frame", i)),
              Some(ch) => match closing_of(&op, &run.keys, ch) {
                None => note(&mut viol, seq, &t, format!("op {}: the callee's out lacks a positional output (that is error absent-output)", i)),
                Some((xo, xb, xf)) => { if xb != b { note(&mut viol, seq, &t, format!("op {} iteration b={} but the frame's outcome {} means b={}", i, b, ch.0, xb)); } ires = xo; fin = xf; }
              },
            }
            run.child = None;
          }
          let fires_now = match &cond { Some((cr, cv)) => *cv == b && (exits(cr) || cr == "finish"), None => false };
          let cr = cond.as_ref().map(|c| c.0.clone()).unwrap_or_default();
          if fires_now && exits(&cr) {
            if rule.as_deref() != Some(cr.as_str()) { note(&mut viol, seq, &t, format!("op {} iteration {}: condition {} held but rule {:?} was reported", i, run.it, cr, rule)); }
            if done { note(&mut viol, seq, &t, format!("op {} iteration {} fired {}: the op is not done", i, run.it, cr)); }
            if let Some(r) = rule.clone() { f.pending = Some((r, i as i64)); }
            f.run = None;
          } else {
            if let Some(r) = &rule { if exits(r) { note(&mut viol, seq, &t, format!("op {} iteration {} reported {} but its condition did not fire it", i, run.it, r)); } }
            if fires_now { run.last_rule = Some("finish".to_string()); }
            for k in op.get_object("out").keys() {
              if !ires.has(&k) { note(&mut viol, seq, &t, format!("iteration {} of op {} lacks output '{}' (that is error absent-output)", run.it, i, k)); continue; }
              let v = ires.get_property(&k);
              if run.lo.contains(&k) { if run.coll.has(&k) { run.coll.get_array(&k).push_property(v); } }
              else {
                run.coll.set_property(&k, v.clone());
                let fed: Option<String> = run.lp.iter().find(|(a, _)| *a == k).map(|(_, lf)| lf.clone());
                if let Some(lf) = fed { run.vals.set_property(&lf, v); }
              }
            }
            if fin { run.ofin = true; }
            let last = run.ofin || (run.nl > 0 && run.it + 1 == run.count);
            if done != last { note(&mut viol, seq, &t, format!("op {} iteration {}: done={} but last={}", i, run.it, done, last)); }
            if last {
              if rule != run.last_rule { note(&mut viol, seq, &t, format!("op {}'s final eval reports rule {:?} but {:?} fired across its iterations", i, rule, run.last_rule)); }
              if !(e.has("iters") && e.get_property("iters").is_int() && e.get_int("iters") == run.it + 1) { note(&mut viol, seq, &t, format!("op {}'s final eval must report iters {}", i, run.it + 1)); }
              match ocmp(&e.get_property("out"), &run.coll) { 0 => {}, 1 => { alias.push_string(&format!("seq {}: op {} collected output changed in place", seq, i)); }, _ => note(&mut viol, seq, &t, format!("op {}'s final out is not its collected outputs", i)) }
              s.done[i] = true; s.res[i] = Some(eout.clone());
              if let Some(r) = rule.clone() { f.pending = Some((r, i as i64)); }
              f.run = None;
            } else {
              if rule.is_some() { note(&mut viol, seq, &t, format!("op {} iteration {} is not the last: no rule effect may follow it", i, run.it)); }
              if fires_now && !(e.has("finish_fired") && e.get_boolean("finish_fired")) { note(&mut viol, seq, &t, format!("op {} iteration {} fired finish: report finish_fired", i, run.it)); }
              run.it += 1; run.stage = "iter".to_string();
            }
          }
        }
      }
    }
    "next" | "terminate" | "fail" | "finish" => {
      let f = stack.last_mut().unwrap();
      match f.pending.clone() {
        Some((r, op)) if r == t => { if e.has("op") && e.get_int("op") != op { note(&mut viol, seq, &t, format!("{} names op {} but op {} fired it", t, e.get_int("op"), op)); } }
        _ => note(&mut viol, seq, &t, format!("{} without an eval that fired it", t)),
      }
      f.pending = None;
      if t == "next" {
        let hn = f.sh.as_ref().map(|s| s.has_next).unwrap_or(false);
        if !hn { note(&mut viol, seq, &t, "next in a case with no next case must be error I-4".to_string()); }
        if e.get_int("from") != f.cidx || e.get_int("to") != f.cidx + 1 { note(&mut viol, seq, &t, format!("next {}->{} but the chain is at {}", e.get_int("from"), e.get_int("to"), f.cidx)); }
        f.cidx += 1; f.sh = None; f.expect = Some("seed".to_string());
      } else if t == "terminate" || t == "fail" { f.closing = Some(t.clone()); f.expect = Some(if depth == 1 { "done".to_string() } else { "leave".to_string() }); }
      else { f.fin = true; }
    }
    "done" | "leave" => {
      if t == "done" && depth != 1 { note(&mut viol, seq, &t, format!("done in a nested frame (depth {}): a nested frame ends with leave", depth)); }
      if t == "leave" && depth == 1 { note(&mut viol, seq, &t, "leave in the root frame: the root ends with done".to_string()); ended = true; continue; }
      let oc = e.get_string("outcome");
      {
        let f = stack.last().unwrap();
        if let Some(c) = f.closing.clone() { if oc != c { note(&mut viol, seq, &t, format!("{} with outcome {} after {}", t, oc, c)); } }
        else {
          if f.pending.is_some() { note(&mut viol, seq, &t, format!("{} while a rule's effect is pending", t)); }
          if f.run.is_some() { note(&mut viol, seq, &t, format!("{} while an op is in progress", t)); }
          match f.sh.as_ref() {
            None => note(&mut viol, seq, &t, format!("{} with no case running", t)),
            Some(s) => {
              if any_ready(s) { note(&mut viol, seq, &t, format!("{} while an item was still ready", t)); }
              if s.wf.iter().any(|x| !*x) || s.sf.iter().any(|x| !*x) { note(&mut viol, seq, &t, format!("{} with unfired wires or synchros (that is a stall)", t)); }
            }
          }
          if oc != "ok" { note(&mut viol, seq, &t, format!("a normal end has outcome ok, not {}", oc)); }
        }
        if oc != "fail" { match ocmp(&e.get_property("out"), &f.out) { 0 => {}, 1 => { alias.push_string(&format!("seq {}: a returned container changed in place after delivery", seq)); }, _ => note(&mut viol, seq, &t, format!("{} out differs from the values delivered to the return bar", t)) } }
      }
      if t == "done" { ended = true; continue; }
      let child = stack.pop().unwrap();
      if e.has("finish") && e.get_boolean("finish") != child.fin { note(&mut viol, seq, &t, format!("leave reports finish={} but the frame's flag is {}", e.get_boolean("finish"), child.fin)); }
      let p = stack.last_mut().unwrap();
      match p.run.as_mut() {
        Some(run) if run.stage == "frame" => {
          if e.has("op") && e.get_int("op") != run.op as i64 { note(&mut viol, seq, &t, format!("leave names op {} but op {} opened the frame", e.get_int("op"), run.op)); }
          run.child = Some((oc.clone(), child.out.clone(), child.fin)); run.stage = "closing".to_string();
          p.expect = Some("eval".to_string());
        }
        _ => note(&mut viol, seq, &t, "leave with no enclosing op waiting on a frame".to_string()),
      }
    }
    "stall" => {
      ended = true;
      let f = stack.last().unwrap();
      if f.pending.is_some() { note(&mut viol, seq, &t, "stall while a rule's effect is pending".to_string()); }
      if f.run.is_some() { note(&mut viol, seq, &t, "stall while an op is in progress".to_string()); }
      match f.sh.as_ref() {
        None => note(&mut viol, seq, &t, "stall with no case running".to_string()),
        Some(s) => {
          if any_ready(s) { note(&mut viol, seq, &t, "stall while an item was still ready".to_string()); }
          let uw: Vec<i64> = (0..s.wf.len()).filter(|k| !s.wf[*k]).map(|k| k as i64).collect();
          let us: Vec<i64> = (0..s.sf.len()).filter(|k| !s.sf[*k]).map(|k| k as i64).collect();
          if uw.is_empty() && us.is_empty() { note(&mut viol, seq, &t, "stall with every wire and synchro fired (that is done)".to_string()); }
          let mut ew: Vec<i64> = Vec::new(); if e.has("wires") { for w in e.get_array("wires").objects() { ew.push(w.int()); } }
          if ew != uw { note(&mut viol, seq, &t, format!("stall lists wires {:?} but {:?} are unfired", ew, uw)); }
        }
      }
    }
    "error" => {
      ended = true;
      let f = stack.last().unwrap();
      if e.get_string("code") == "I-4" {
        let ok = matches!(f.pending.clone(), Some((r, _)) if r == "next") && !f.sh.as_ref().map(|s| s.has_next).unwrap_or(true);
        if !ok { note(&mut viol, seq, &t, "error I-4 without a next rule fired in the last case".to_string()); }
      }
    }
    _ => { note(&mut viol, seq, &t, format!("unknown event type {}", t)); }
  }
}
if !ended { note(&mut viol, checked, "end", "the trace does not end with done, stall or error".to_string()); }
let mut res = DataObject::new();
res.put_string("status", "ok");
res.put_boolean("ok", viol.len() == 0);
res.put_int("checked", checked);
res.put_int("max_depth", max_depth);
res.put_array("violations", viol);
res.put_array("alias_notes", alias);
res
}
