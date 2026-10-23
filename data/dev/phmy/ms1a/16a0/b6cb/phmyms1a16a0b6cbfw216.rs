// The validity checker: replays an event trace against an INDEPENDENT shadow model of the language
// (sections 1.5-1.5.4), not the stepper's code, and confirms each event's preconditions held: the item
// picked was ready (data dependencies delivered, synchro sources done, nothing pending), values match
// their sources, rules follow from the op's condition, and the run ended only when it had to.
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

let mut viol = DataArray::new();
let mut note = |seq: i64, t: &str, m: String, viol: &mut DataArray| { let mut v = DataObject::new(); v.put_int("seq", seq); v.put_string("type", t); v.put_string("msg", &m); viol.push_object(v); };
let mut cidx: i64 = -1;
let mut sh: Option<Shadow> = None;
let mut out = DataObject::new();
let mut pending: Option<(String, i64)> = None;
let mut expect: Option<String> = None;   // "seed" after enter/next, "done" after terminate/fail
let mut closing: Option<String> = None;
let mut ended = false;
let mut checked = 0i64;
let evs = events.objects();
for (idx, e) in evs.iter().enumerate() {
  let e = e.object();
  let seq = idx as i64;
  let t = e.get_string("type");
  checked += 1;
  if e.has("seq") && e.get_int("seq") != seq { note(seq, &t, format!("seq {} out of order", e.get_int("seq")), &mut viol); }
  if ended { note(seq, &t, "event after the run ended".to_string(), &mut viol); continue; }
  if idx == 0 {
    if t != "enter" { note(seq, &t, "a run must begin with enter".to_string(), &mut viol); }
    else if !deq(&e.get_property("args"), &Data::DObject(args.data_ref)) { note(seq, &t, "enter args differ from the run's args".to_string(), &mut viol); }
    expect = Some("seed".to_string()); cidx = 0; continue;
  }
  if let Some(x) = expect.clone() {
    if t != x && !(t == "error") { note(seq, &t, format!("expected {} here", x), &mut viol); }
  }
  match t.as_str() {
    "seed" => {
      if expect.as_deref() != Some("seed") { note(seq, &t, "seed without a preceding enter or next".to_string(), &mut viol); }
      expect = None;
      if e.get_int("case") != cidx { note(seq, &t, format!("seed of case {} but the chain is at case {}", e.get_int("case"), cidx), &mut viol); }
      match nth_case(&body, cidx) {
        None => { note(seq, &t, format!("case {} does not exist", cidx), &mut viol); ended = true; }
        Some(c) => {
          let s = load(&c);
          // pre-delivered inputs must be exactly the unawaited ones
          let mut want: Vec<String> = Vec::new();
          for (i, g) in s.got.iter().enumerate() { for k in g { want.push(format!("{}:{}", i, k)); } }
          let mut have: Vec<String> = Vec::new();
          if e.has("pre") { for p in e.get_array("pre").objects() { let p = p.array(); have.push(format!("{}:{}", p.get_int(0), p.get_string(1))); } }
          want.sort(); have.sort();
          if want != have { note(seq, &t, format!("pre-delivered {:?} but the unawaited inputs are {:?}", have, want), &mut viol); }
          sh = Some(s);
        }
      }
    }
    "deliver" | "sync" | "eval" => {
      if pending.is_some() { note(seq, &t, format!("{} while the effect of a fired rule is pending", t), &mut viol); }
      let s = match sh.as_mut() { Some(s) => s, None => { note(seq, &t, "no case is running".to_string(), &mut viol); continue; } };
      let n = s.cmds.len();
      if t == "deliver" {
        let k = e.get_int("wire") as usize;
        if k >= s.cons.len() { note(seq, &t, format!("wire {} does not exist", k), &mut viol); continue; }
        if s.wf[k] { note(seq, &t, format!("wire {} fired twice", k), &mut viol); }
        if !src_avail(s, k) { note(seq, &t, format!("wire {} fired before its source op {} was done", k, s.cons[k].0), &mut viol); }
        let (si, sn, di, dn) = s.cons[k].clone();
        let want = if si == -1 { if args.has(&sn) { args.get_property(&sn) } else { Data::DNull } }
          else { match &s.res[si as usize] { Some(r) if r.has(&sn) => r.get_property(&sn), _ => { note(seq, &t, format!("wire {} reads '{}' which op {} did not produce", k, sn, si), &mut viol); Data::DNull } } };
        if !deq(&e.get_property("value"), &want) { note(seq, &t, format!("wire {} carried a value that is not its source's", k), &mut viol); }
        s.wf[k] = true;
        if di == -2 { out.set_property(&dn, want); }
        else if di >= 0 && (di as usize) < n {
          let d = di as usize;
          if s.cmds[d].get_string("type") == "undefined" { s.done[d] = true; s.res[d] = None; }
          else if s.done[d] { if !(e.has("ignored") && e.get_boolean("ignored")) { note(seq, &t, format!("delivery into op {} after it ran must be reported (I-1) and must not re-run it", d), &mut viol); } }
          else { if !s.got[d].contains(&dn) { s.got[d].push(dn.clone()); } s.vals[d].set_property(&dn, want); }
        }
      } else if t == "sync" {
        let k = e.get_int("sync") as usize;
        if k >= s.syncs.len() { note(seq, &t, format!("synchro {} does not exist", k), &mut viol); continue; }
        if s.sf[k] { note(seq, &t, format!("synchro {} fired twice", k), &mut viol); }
        let (a, b) = s.syncs[k];
        if sv(a, b, n) { if !s.done[a as usize] { note(seq, &t, format!("synchro {} fired before its src op {} was done", k, a), &mut viol); } }
        else if !(e.has("inert") && e.get_boolean("inert")) { note(seq, &t, format!("synchro {} has invalid endpoints and must be reported inert (S-1)", k), &mut viol); }
        s.sf[k] = true;
      } else {
        let i = e.get_int("op") as usize;
        if i >= n { note(seq, &t, format!("op {} does not exist", i), &mut viol); continue; }
        if s.done[i] { note(seq, &t, format!("op {} evaluated after it was done (re-run)", i), &mut viol); }
        for k in s.cmds[i].get_object("in").keys() { if !s.got[i].contains(&k) { note(seq, &t, format!("op {} evaluated before its input '{}' was delivered", i, k), &mut viol); } }
        for (a, b) in &s.syncs { if *b == i as i64 && sv(*a, *b, n) && !s.done[*a as usize] { note(seq, &t, format!("op {} evaluated before synchro src op {} was done", i, a), &mut viol); } }
        if e.has("in") && !deq(&e.get_property("in"), &Data::DObject(s.vals[i].data_ref)) { note(seq, &t, format!("op {} evaluated with inputs that are not the delivered values", i), &mut viol); }
        let op = s.cmds[i].clone();
        let rule = if e.has("rule") && e.get_property("rule").is_string() { Some(e.get_string("rule")) } else { None };
        let b = if e.has("b") { e.get_boolean("b") } else { true };
        let iterated = e.has("iters") && !e.get_property("iters").clone().is_null();
        let typ = op.get_string("type");
        if has_obj(&op, "condition") && typ != "constant" {
          let c = op.get_object("condition"); let (cr, cv) = (c.get_string("rule"), c.get_boolean("value"));
          let fires = cr == "next" || cr == "terminate" || cr == "fail" || cr == "finish";
          match &rule {
            Some(r) => { if *r != cr { note(seq, &t, format!("op {} reported rule {} but its condition's rule is {}", i, r, cr), &mut viol); } else if !iterated && b != cv { note(seq, &t, format!("op {} fired {} with b={} but the condition needs {}", i, r, b, cv), &mut viol); } }
            None => { if fires && !iterated && b == cv { note(seq, &t, format!("op {}'s condition {}={} held (b={}) but no rule was reported", i, cr, cv, b), &mut viol); } }
          }
        } else if rule.is_some() { note(seq, &t, format!("op {} reported a rule but has no live condition", i), &mut viol); }
        let ends = matches!(rule.as_deref(), Some("next") | Some("terminate") | Some("fail"));
        let done = if e.has("done") { e.get_boolean("done") } else { !ends };
        if done == ends { note(seq, &t, format!("op {} done={} contradicts rule {:?}", i, done, rule), &mut viol); }
        if done { s.done[i] = true; s.res[i] = Some(if has_obj(&e, "out") { e.get_object("out") } else { DataObject::new() }); }
        if let Some(r) = rule { pending = Some((r, i as i64)); }
      }
    }
    "next" | "terminate" | "fail" | "finish" => {
      match pending.clone() {
        Some((r, op)) if r == t => { if e.has("op") && e.get_int("op") != op { note(seq, &t, format!("{} names op {} but op {} fired it", t, e.get_int("op"), op), &mut viol); } }
        _ => note(seq, &t, format!("{} without an eval that fired it", t), &mut viol),
      }
      pending = None;
      if t == "next" {
        let hn = sh.as_ref().map(|s| s.has_next).unwrap_or(false);
        if !hn { note(seq, &t, "next in a case with no next case must be error I-4".to_string(), &mut viol); }
        if e.get_int("from") != cidx || e.get_int("to") != cidx + 1 { note(seq, &t, format!("next {}->{} but the chain is at {}", e.get_int("from"), e.get_int("to"), cidx), &mut viol); }
        cidx += 1; sh = None; expect = Some("seed".to_string());
      } else if t == "terminate" || t == "fail" { closing = Some(t.clone()); expect = Some("done".to_string()); }
    }
    "done" => {
      ended = true;
      let oc = e.get_string("outcome");
      if let Some(c) = closing.clone() { if oc != c { note(seq, &t, format!("done with outcome {} after {}", oc, c), &mut viol); } }
      else {
        if pending.is_some() { note(seq, &t, "done while a rule's effect is pending".to_string(), &mut viol); }
        match sh.as_ref() {
          None => note(seq, &t, "done with no case running".to_string(), &mut viol),
          Some(s) => {
            if any_ready(s) { note(seq, &t, "done while an item was still ready".to_string(), &mut viol); }
            if s.wf.iter().any(|x| !*x) || s.sf.iter().any(|x| !*x) { note(seq, &t, "done with unfired wires or synchros (that is a stall)".to_string(), &mut viol); }
          }
        }
        if oc != "ok" { note(seq, &t, format!("a normal end has outcome ok, not {}", oc), &mut viol); }
      }
      if oc != "fail" && !deq(&e.get_property("out"), &Data::DObject(out.data_ref)) { note(seq, &t, "done out differs from the values delivered to the return bar".to_string(), &mut viol); }
    }
    "stall" => {
      ended = true;
      if pending.is_some() { note(seq, &t, "stall while a rule's effect is pending".to_string(), &mut viol); }
      match sh.as_ref() {
        None => note(seq, &t, "stall with no case running".to_string(), &mut viol),
        Some(s) => {
          if any_ready(s) { note(seq, &t, "stall while an item was still ready".to_string(), &mut viol); }
          let uw: Vec<i64> = (0..s.wf.len()).filter(|k| !s.wf[*k]).map(|k| k as i64).collect();
          let us: Vec<i64> = (0..s.sf.len()).filter(|k| !s.sf[*k]).map(|k| k as i64).collect();
          if uw.is_empty() && us.is_empty() { note(seq, &t, "stall with every wire and synchro fired (that is done)".to_string(), &mut viol); }
          let mut ew: Vec<i64> = Vec::new(); if e.has("wires") { for w in e.get_array("wires").objects() { ew.push(w.int()); } }
          if ew != uw { note(seq, &t, format!("stall lists wires {:?} but {:?} are unfired", ew, uw), &mut viol); }
        }
      }
    }
    "error" => {
      ended = true;
      let code = e.get_string("code");
      if code == "I-4" {
        let ok = matches!(pending.clone(), Some((r, _)) if r == "next") && !sh.as_ref().map(|s| s.has_next).unwrap_or(true);
        if !ok { note(seq, &t, "error I-4 without a next rule fired in the last case".to_string(), &mut viol); }
      }
    }
    _ => { note(seq, &t, format!("unknown event type {}", t), &mut viol); }
  }
}
if !ended { note(checked, "end", "the trace does not end with done, stall or error".to_string(), &mut viol); }
let mut res = DataObject::new();
res.put_string("status", "ok");
res.put_boolean("ok", viol.len() == 0);
res.put_int("checked", checked);
res.put_array("violations", viol);
res