// Flow step debugger P1 - the core stepper for ONE frame (spec: dev/_ASSETS/docs/flow-language.md 1.5.4).
// step(state, pick) -> {state', event}: a ready-set scheduler, one event per step, pure over plain ndata
// state (the graph in state.body is never mutated; the frame is deep-copied per step). Local and command
// ops are single steps here: their inner flows run to completion inside the eval (the same machine,
// default picks), so no panic and no hang can escape. The double-wire re-run quirk is NOT reproduced:
// an op runs once and a second delivery is reported as I-1.
struct Ctx { steps: i64, budget: i64, depth: i64 }
type Fault = (String, String);
type Evald = (DataObject, bool, Option<String>, bool, Option<i64>);

fn fault(code: &str, msg: String) -> Fault { (code.to_string(), msg) }
fn panic_text(p: &Box<dyn std::any::Any + Send>) -> String {
  if let Some(s) = p.downcast_ref::<&str>() { s.to_string() }
  else if let Some(s) = p.downcast_ref::<String>() { s.clone() }
  else { "unknown panic".to_string() }
}
fn put_copy(o: &mut DataObject, k: &str, d: Data) {
  if d.is_object() { o.put_object(k, d.object().deep_copy()); }
  else if d.is_array() { o.put_array(k, d.array().deep_copy()); }
  else { o.set_property(k, d); }
}
fn case_at(body: &DataObject, idx: i64) -> Option<DataObject> {
  let mut c = body.clone();
  let mut i = 0;
  while i < idx { if c.has("nextcase") { c = c.get_object("nextcase"); i += 1; } else { return None; } }
  Some(c)
}
fn n_syncs(case: &DataObject) -> usize { if case.has("syncs") { case.get_array("syncs").len() } else { 0 } }
fn sync_valid(s: i64, d: i64, n: usize) -> bool { s >= 0 && d >= 0 && s != d && (s as usize) < n && (d as usize) < n }
fn bools(n: usize) -> DataArray { let mut a = DataArray::new(); for _ in 0..n { a.push_boolean(false); } a }
fn dest_names(case: &DataObject) -> Vec<String> {
  let mut v = Vec::new();
  for c in case.get_array("cons").objects() { v.push(c.object().get_array("dest").get_string(1)); }
  v
}
fn syncs_ok(case: &DataObject, f: &DataObject, i: usize) -> bool {
  if !case.has("syncs") { return true; }
  let n = case.get_array("cmds").len();
  let done = f.get_array("done");
  for s in case.get_array("syncs").objects() {
    let s = s.object();
    let (a, b) = (s.get_int("src"), s.get_int("dest"));
    if b == i as i64 && sync_valid(a, b, n) && !done.get_boolean(a as usize) { return false; }
  }
  true
}
fn op_ready(case: &DataObject, f: &DataObject, i: usize) -> bool {
  if f.get_array("done").get_boolean(i) { return false; }
  let dv = f.get_array("dlv").get_object(i);
  let op = case.get_array("cmds").get_object(i);
  for name in op.get_object("in").keys() { if !dv.has(&name) { return false; } }
  syncs_ok(case, f, i)
}
fn wire_ready(case: &DataObject, f: &DataObject, k: usize) -> bool {
  if f.get_array("wires").get_boolean(k) { return false; }
  let si = case.get_array("cons").get_object(k).get_array("src").get_int(0);
  if si == -1 { return true; }
  let n = case.get_array("cmds").len();
  if si < 0 || si as usize >= n { return true; }
  f.get_array("done").get_boolean(si as usize)
}
fn sync_ready(case: &DataObject, f: &DataObject, k: usize) -> bool {
  if f.get_array("syncs").get_boolean(k) { return false; }
  let s = case.get_array("syncs").get_object(k);
  let (a, b) = (s.get_int("src"), s.get_int("dest"));
  let n = case.get_array("cmds").len();
  if !sync_valid(a, b, n) { return true; }
  f.get_array("done").get_boolean(a as usize)
}
fn item(kind: &str, i: usize) -> DataObject { let mut o = DataObject::new(); o.put_string("kind", kind); o.put_int("index", i as i64); o }
fn ready_set(case: &DataObject, f: &DataObject) -> DataArray {
  let mut a = DataArray::new();
  for k in 0..case.get_array("cons").len() { if wire_ready(case, f, k) { a.push_object(item("wire", k)); } }
  for k in 0..n_syncs(case) { if sync_ready(case, f, k) { a.push_object(item("sync", k)); } }
  for i in 0..case.get_array("cmds").len() { if op_ready(case, f, i) { a.push_object(item("op", i)); } }
  a
}
fn ready_now(body: &DataObject, f: &DataObject) -> DataArray {
  let phase = f.get_string("phase");
  let mut a = DataArray::new();
  if phase == "ended" { return a; }
  if phase != "run" { let mut o = DataObject::new(); o.put_string("kind", "auto"); o.put_string("phase", &phase); a.push_object(o); return a; }
  if f.get_property("pending").is_object() {
    let p = f.get_object("pending");
    let mut o = DataObject::new(); o.put_string("kind", "effect"); o.put_string("rule", &p.get_string("rule")); o.put_int("op", p.get_int("op"));
    a.push_object(o); return a;
  }
  match case_at(body, f.get_int("case")) { Some(c) => ready_set(&c, f), None => a }
}
fn prio_front(f: &mut DataObject, i: usize) {
  let old = f.get_array("prio");
  let mut a = DataArray::new(); a.push_int(i as i64);
  for d in old.objects() { if d.int() != i as i64 { a.push_property(d); } }
  f.put_array("prio", a);
}
fn prio_remove(f: &mut DataObject, i: usize) {
  let old = f.get_array("prio");
  let mut a = DataArray::new();
  for d in old.objects() { if d.int() != i as i64 { a.push_property(d); } }
  f.put_array("prio", a);
}
fn diag_case(case: &DataObject) -> DataArray {
  let mut a = DataArray::new();
  let cmds = case.get_array("cmds");
  let mut exact: Vec<(i64, String)> = Vec::new();
  let mut names: Vec<String> = Vec::new();
  for c in case.get_array("cons").objects() { let d = c.object().get_array("dest"); exact.push((d.get_int(0), d.get_string(1))); names.push(d.get_string(1)); }
  for i in 0..cmds.len() {
    for name in cmds.get_object(i).get_object("in").keys() {
      let fan = exact.iter().filter(|(x, y)| *x == i as i64 && *y == name).count();
      if fan > 1 { a.push_string(&format!("I-1 op {} input '{}' has {} incoming wires: it runs once (flowlang would re-run it)", i, name, fan)); }
      if fan == 0 && names.contains(&name) { a.push_string(&format!("I-1 op {} input '{}' is awaited by name but no wire targets it: the op can never be ready", i, name)); }
    }
  }
  a
}
fn ev(kind: &str, f: &DataObject) -> DataObject {
  let mut e = DataObject::new();
  e.put_string("type", kind);
  e.put_array("frame", DataArray::new());
  e.put_int("case", f.get_int("case"));
  e
}
fn err_ev(f: &mut DataObject, code: &str, msg: String, op: Option<usize>) -> DataObject {
  let mut e = ev("error", f);
  e.put_string("code", code); e.put_string("msg", &msg);
  if let Some(i) = op { e.put_int("op", i as i64); }
  f.put_string("phase", "ended");
  e
}
fn new_frame(args: DataObject, kind: &str) -> DataObject {
  let mut f = DataObject::new();
  f.put_string("kind", kind);
  f.put_object("args", args);
  f.put_object("out", DataObject::new());
  f.put_int("case", 0);
  f.put_boolean("finish", false);
  f.put_string("phase", "enter");
  f.put_null("pending");
  f.put_string("outcome", "");
  f
}
// seed: fresh case state; inputs whose NAME is no wire's dest name anywhere in the case are pre-delivered (null).
fn seed_case(case: &DataObject, f: &mut DataObject) -> DataArray {
  let cmds = case.get_array("cmds");
  let n = cmds.len();
  f.put_array("wires", bools(case.get_array("cons").len()));
  f.put_array("syncs", bools(n_syncs(case)));
  f.put_array("done", bools(n));
  let dn = dest_names(case);
  let mut results = DataArray::new(); let mut inputs = DataArray::new(); let mut dlv = DataArray::new();
  let mut pre = DataArray::new();
  for i in 0..n {
    results.push_property(Data::DNull);
    let op = cmds.get_object(i);
    let mut iv = DataObject::new(); let mut dv = DataObject::new();
    for name in op.get_object("in").keys() {
      if !dn.contains(&name) {
        iv.put_null(&name); dv.put_boolean(&name, true);
        let mut p = DataArray::new(); p.push_int(i as i64); p.push_string(&name); pre.push_array(p);
      }
    }
    inputs.push_object(iv); dlv.push_object(dv);
  }
  f.put_array("results", results); f.put_array("inputs", inputs); f.put_array("dlv", dlv);
  f.put_null("pending");
  let mut cur = DataObject::new(); cur.put_string("pass", "wire"); cur.put_int("k", 0); f.put_object("cur", cur);
  f.put_array("prio", DataArray::new());
  // case-start rule: no awaited input AND no incoming synchro; flowlang runs these first, in index order
  let mut prio = DataArray::new();
  for i in 0..n { if op_ready(case, f, i) { prio.push_int(i as i64); } }
  f.put_array("prio", prio);
  pre
}
// DEFAULT pick = flowlang's sweep: case-start ops, then wire passes and synchro passes from the cursor;
// an op made ready by a delivery/synchro is picked next (flowlang runs it inside the pass).
fn default_pick(case: &DataObject, f: &mut DataObject) -> Option<(String, usize)> {
  let prio = f.get_array("prio");
  let mut keep = DataArray::new();
  let mut chosen: Option<usize> = None;
  for d in prio.objects() {
    let i = d.int() as usize;
    if op_ready(case, f, i) { if chosen.is_none() { chosen = Some(i); } else { keep.push_int(i as i64); } }
  }
  f.put_array("prio", keep);
  if let Some(i) = chosen { return Some(("op".to_string(), i)); }
  let nw = case.get_array("cons").len();
  let ns = n_syncs(case);
  let mut cur = f.get_object("cur");
  let mut pass = cur.get_string("pass");
  let mut k = cur.get_int("k") as usize;
  for _round in 0..3 {
    if pass == "wire" {
      let mut j = k;
      while j < nw { if wire_ready(case, f, j) { cur.put_string("pass", "wire"); cur.put_int("k", (j + 1) as i64); return Some(("wire".to_string(), j)); } j += 1; }
      pass = "sync".to_string(); k = 0;
    } else {
      let mut j = k;
      while j < ns { if sync_ready(case, f, j) { cur.put_string("pass", "sync"); cur.put_int("k", (j + 1) as i64); return Some(("sync".to_string(), j)); } j += 1; }
      pass = "wire".to_string(); k = 0;
    }
  }
  cur.put_string("pass", &pass); cur.put_int("k", k as i64);
  let n = case.get_array("cmds").len();
  for i in 0..n { if op_ready(case, f, i) { return Some(("op".to_string(), i)); } }
  None
}
fn end_of_case(f: &mut DataObject) -> DataObject {
  let wires = f.get_array("wires"); let syncs = f.get_array("syncs"); let done = f.get_array("done");
  let mut uw = DataArray::new(); for k in 0..wires.len() { if !wires.get_boolean(k) { uw.push_int(k as i64); } }
  let mut us = DataArray::new(); for k in 0..syncs.len() { if !syncs.get_boolean(k) { us.push_int(k as i64); } }
  let mut nr = DataArray::new(); for i in 0..done.len() { if !done.get_boolean(i) { nr.push_int(i as i64); } }
  f.put_string("phase", "ended");
  if uw.len() == 0 && us.len() == 0 {
    let mut e = ev("done", f);
    e.put_string("outcome", "ok"); put_copy(&mut e, "out", f.get_property("out")); e.put_boolean("fail", false);
    e.put_array("never_ready", nr);
    f.put_string("outcome", "ok");
    e
  } else {
    let mut e = ev("stall", f);
    e.put_array("wires", uw); e.put_array("syncs", us); e.put_array("ops", nr);
    e
  }
}
fn deliver(case: &DataObject, f: &mut DataObject, k: usize) -> DataObject {
  let cmds = case.get_array("cmds"); let n = cmds.len();
  let con = case.get_array("cons").get_object(k);
  let (src, dst) = (con.get_array("src"), con.get_array("dest"));
  let (si, sn, di, dn) = (src.get_int(0), src.get_string(1), dst.get_int(0), dst.get_string(1));
  let val: Data;
  if si == -1 { let a = f.get_object("args"); val = if a.has(&sn) { a.get_property(&sn) } else { Data::DNull }; }
  else if si < 0 || si as usize >= n { return err_ev(f, "panic", format!("wire {} has src index {} out of range", k, si), None); }
  else {
    let r = f.get_array("results").get_property(si as usize);
    if !r.is_object() || !r.object().has(&sn) {
      return err_ev(f, "absent-output", format!("wire {} reads output '{}' of op {}, which its result lacks (flowlang panics in get_property)", k, sn, si), Some(si as usize));
    }
    val = r.object().get_property(&sn);
  }
  if di != -2 && (di < 0 || di as usize >= n) { return err_ev(f, "panic", format!("wire {} has dest index {} out of range", k, di), None); }
  f.get_array("wires").put_boolean(k, true);
  let mut e = ev("deliver", f);
  e.put_int("wire", k as i64);
  put_copy(&mut e, "value", val.clone());
  let mut d = DataArray::new(); d.push_int(di); d.push_string(&dn); e.put_array("dest", d);
  if di == -2 { f.get_object("out").set_property(&dn, val); return e; }
  let du = di as usize;
  let op = cmds.get_object(du);
  if op.get_string("type") == "undefined" {
    f.get_array("done").put_boolean(du, true);
    f.get_array("results").set_property(du, Data::DNull);
    e.put_boolean("marked_done", true);
    return e;
  }
  if !op.get_object("in").has(&dn) { return err_ev(f, "panic", format!("wire {} targets input '{}', which op {} does not have", k, dn, du), Some(du)); }
  if f.get_array("done").get_boolean(du) {
    e.put_boolean("ignored", true);
    e.put_string("diag", &format!("I-1: op {} already ran; this second delivery to '{}' does not re-run it (flowlang would run it again)", du, dn));
    return e;
  }
  let mut dv = f.get_array("dlv").get_object(du);
  if dv.has(&dn) { e.put_string("diag", &format!("I-1: input '{}' of op {} was delivered twice before the op ran; the last value wins", dn, du)); }
  f.get_array("inputs").get_object(du).set_property(&dn, val);
  dv.put_boolean(&dn, true);
  if op_ready(case, f, du) { prio_front(f, du); e.put_int("ready_op", du as i64); }
  e
}
fn fire_sync(case: &DataObject, f: &mut DataObject, k: usize) -> DataObject {
  let n = case.get_array("cmds").len();
  let s = case.get_array("syncs").get_object(k);
  let (a, b) = (s.get_int("src"), s.get_int("dest"));
  let valid = sync_valid(a, b, n);
  f.get_array("syncs").put_boolean(k, true);
  let mut e = ev("sync", f);
  e.put_int("sync", k as i64); e.put_int("src", a); e.put_int("dest", b); e.put_boolean("inert", !valid);
  if valid && op_ready(case, f, b as usize) { prio_front(f, b as usize); e.put_int("ready_op", b); }
  e
}
fn match_flag(ctype: &str, v: &str, d: Data) -> Result<bool, Fault> {
  let bad = |t: &str| fault("panic", format!("match literal '{}' does not parse as {}", v, t));
  Ok(match ctype {
    "int" => { if !d.is_int() { false } else { match v.parse::<i64>() { Ok(x) => d.int() == x, Err(_) => return Err(bad("int")) } } }
    "decimal" => { if !d.is_float() { false } else { match v.parse::<f64>() { Ok(x) => d.float() == x, Err(_) => return Err(bad("decimal")) } } }
    "boolean" => { if !d.is_boolean() { false } else { match v.parse::<bool>() { Ok(x) => d.boolean() == x, Err(_) => return Err(bad("boolean")) } } }
    "string" => { if !d.is_string() { false } else { d.string() == v } }
    "null" => d.clone().is_null(),
    _ => false,
  })
}
fn run_nested(case0: &DataObject, args: DataObject, ctx: &mut Ctx) -> Result<(String, DataObject, bool), Fault> {
  if ctx.depth >= 64 { return Err(fault("depth", "frames nested more than 64 deep (recursive flow?)".to_string())); }
  ctx.depth += 1;
  let mut f = new_frame(args, "nested");
  let pick = DataObject::new();
  let r = loop {
    ctx.steps += 1;
    if ctx.steps > ctx.budget { break Err(fault("budget", format!("nested frames exceeded the step budget of {} (an open loop without finish?)", ctx.budget))); }
    let e = step_frame(case0, &mut f, &pick, ctx);
    let t = e.get_string("type");
    if t == "done" { break Ok((e.get_string("outcome"), f.get_object("out"), f.get_boolean("finish"))); }
    if t == "stall" { break Err(fault("stall", format!("a nested frame stalled: {}", e.to_string()))); }
    if t == "error" { break Err((e.get_string("code"), format!("in a nested frame: {}", e.get_string("msg")))); }
  };
  ctx.depth -= 1;
  r
}
// One evaluation of an op body + its condition (flowlang evaluate_operation).
fn eval_operation(op: &DataObject, in1: DataObject, ctx: &mut Ctx, ffin: &mut bool, ofin: &mut bool) -> Result<(DataObject, bool, Option<String>), Fault> {
  let typ = op.get_string("type");
  let v = op.get_string("name");
  let outs: Vec<String> = op.get_object("out").keys();
  let mut out = DataObject::new();
  let mut b = true;
  if typ == "primitive" {
    let a = in1.clone(); let vv = v.clone();
    match panic::catch_unwind(panic::AssertUnwindSafe(move || Primitive::new(&vv).execute(a))) {
      Ok(o) => { out = o; }
      Err(p) => { return Err(fault("panic", format!("primitive '{}' panicked: {}", v, panic_text(&p)))); }
    }
  } else if typ == "local" {
    if !op.get_property("localdata").is_object() { for k in &outs { out.put_null(k); } }
    else {
      let (oc, o, fin) = run_nested(&op.get_object("localdata"), in1, ctx)?;
      if oc == "fail" { b = false; } else { out = o; *ofin = fin; }
    }
  } else if typ == "constant" {
    if !op.has("ctype") { return Err(fault("panic", "constant op has no ctype".to_string())); }
    let ctype = op.get_string("ctype");
    for k in &outs {
      let bad = |e: String| fault("panic", format!("constant '{}' does not parse as {}: {}", v, ctype, e));
      match ctype.as_str() {
        "int" => match v.parse::<i64>() { Ok(x) => out.put_int(k, x), Err(e) => return Err(bad(e.to_string())) },
        "decimal" => match v.parse::<f64>() { Ok(x) => out.put_float(k, x), Err(e) => return Err(bad(e.to_string())) },
        "boolean" => match v.parse::<bool>() { Ok(x) => out.put_boolean(k, x), Err(e) => return Err(bad(e.to_string())) },
        "string" => match DataObject::try_from_string(&format!("{{\"v\":\"{}\"}}", v)) { Ok(o) => out.put_string(k, &o.get_string("v")), Err(_) => return Err(bad("bad string literal".to_string())) },
        "object" => { let vv = v.clone(); match panic::catch_unwind(panic::AssertUnwindSafe(move || DataObject::from_string(&vv))) { Ok(o) => out.put_object(k, o), Err(p) => return Err(bad(panic_text(&p))) } },
        "array" => { let vv = v.clone(); match panic::catch_unwind(panic::AssertUnwindSafe(move || DataArray::from_string(&vv))) { Ok(o) => out.put_array(k, o), Err(p) => return Err(bad(panic_text(&p))) } },
        _ => out.put_null(k),
      }
    }
  } else if typ == "command" {
    if !op.has("cmd") { return Err(fault("panic", "command op has no cmd".to_string())); }
    let cmdstr = op.get_string("cmd");
    let sa: Vec<String> = cmdstr.split(':').map(|s| s.to_string()).collect();
    if sa.len() < 3 { return Err(fault("panic", format!("command op cmd '{}' is not lib:ctl:cmd", cmdstr))); }
    let lib = sa[0].clone(); let id = sa[2].clone();
    let (l2, i2) = (lib.clone(), id.clone());
    let sub = match panic::catch_unwind(panic::AssertUnwindSafe(move || Command::new(&l2, &i2))) {
      Ok(c) => c,
      Err(p) => return Err(fault("panic", format!("command '{}' could not be loaded: {}", cmdstr, panic_text(&p)))),
    };
    let mut params = DataObject::new();
    for (k, d) in in1.objects() { params.set_property(&k, d); }
    let mut keys: Vec<String> = Vec::new();
    let res: Option<DataObject>;
    if sub.lang == "flow" {
      // a flow callee runs as a nested frame (raw args: no cast_params, no auth - the parent call is the gate)
      let store = DataStore::new();
      let data = store.get_data(&lib, &id).get_object("data");
      let codename = data.get_string("flow");
      let fl = store.get_data(&lib, &codename).get_object("data").get_object("flow");
      keys = fl.get_object("output").keys();
      let (oc, o, _fin) = run_nested(&fl, params, ctx)?;
      res = if oc == "fail" { None } else { Some(o) };
    } else {
      keys.push("a".to_string());
      let s2 = &sub; let p2 = params.clone();
      res = match panic::catch_unwind(panic::AssertUnwindSafe(move || s2.execute(p2))) {
        Ok(Ok(o)) => Some(o),
        Ok(Err(_)) => None,
        Err(p) => return Err(fault("panic", format!("command '{}' panicked: {}", cmdstr, panic_text(&p)))),
      };
    }
    match res {
      None => { b = false; }
      Some(r) => {
        for (i, key1) in outs.iter().enumerate() {
          if i >= keys.len() { return Err(fault("absent-output", format!("command op output '{}' has no positional counterpart among the callee's {} output(s) (I-7)", key1, keys.len()))); }
          let key2 = &keys[i];
          if !r.has(key2) { return Err(fault("absent-output", format!("the callee's result lacks '{}' (flowlang panics in get_property)", key2))); }
          out.set_property(key1, r.get_property(key2));
        }
      }
    }
  } else if typ == "persistent" {
    let mut g = DataStore::globals();
    let ks = in1.clone().keys();
    if ks.len() > 0 { g.set_property(&v, in1.get_property(&ks[0])); }
    let value = if g.has(&v) { g.get_property(&v) } else { Data::DNull };
    for k in &outs { out.set_property(k, value.clone()); }
  } else if typ == "match" {
    let ks = in1.clone().keys();
    if ks.is_empty() { return Err(fault("panic", "a match op needs one input (I-5)".to_string())); }
    if !op.has("ctype") { return Err(fault("panic", "match op has no ctype".to_string())); }
    b = match_flag(&op.get_string("ctype"), &v, in1.get_property(&ks[0]))?;
  }
  // undefined and unknown types: flowlang prints UNIMPLEMENTED and the op yields {}
  let mut rule: Option<String> = None;
  if typ != "constant" && op.get_property("condition").is_object() {
    let c = op.get_object("condition");
    let r = c.get_string("rule");
    if c.get_boolean("value") == b {
      if r == "next" || r == "terminate" || r == "fail" { rule = Some(r); }
      else if r == "finish" { *ffin = true; rule = Some(r); }
    }
  }
  Ok((out, b, rule))
}
// The whole op (flowlang evaluate): list/loop iterations run inside this one step in P1.
fn eval_op(op: &DataObject, inputs: &DataObject, ctx: &mut Ctx, ffin: &mut bool) -> Result<Evald, Fault> {
  let mut in1 = DataObject::new();
  for (k, d) in inputs.objects() { in1.set_property(&k, d); }
  let mut list_in: Vec<String> = Vec::new();
  for (k, d) in op.get_object("in").objects() { if d.is_object() && d.object().has("mode") && d.object().get_string("mode") == "list" { list_in.push(k); } }
  let mut list_out: Vec<String> = Vec::new();
  let mut loop_out: Vec<(String, String)> = Vec::new();
  for (k, d) in op.get_object("out").objects() {
    if !d.is_object() { continue; }
    let nd = d.object();
    let mode = if nd.has("mode") { nd.get_string("mode") } else { "".to_string() };
    if mode == "list" { list_out.push(k); }
    else if mode == "loop" {
      if !nd.get_property("loop").is_string() { return Err(fault("panic", format!("loop output '{}' names no input (I-8)", k))); }
      loop_out.push((k, nd.get_string("loop")));
    }
  }
  let outs: Vec<String> = op.get_object("out").keys();
  let mut ofin = false;
  if list_in.is_empty() && loop_out.is_empty() {
    let (o, b, r) = eval_operation(op, in1, ctx, ffin, &mut ofin)?;
    let done = !matches!(r.as_deref(), Some("next") | Some("terminate") | Some("fail"));
    return Ok((o, b, r, done, None));
  }
  let mut out3 = DataObject::new();
  for k in &list_out { out3.put_array(k, DataArray::new()); }
  let n = list_in.len();
  let mut count = 0usize;
  for (j, k) in list_in.iter().enumerate() {
    let d = in1.get_property(k);
    if !d.is_array() { return Err(fault("panic", format!("list input '{}' is not an array", k))); }
    let l = d.array().len();
    if j == 0 || l < count { count = l; }
  }
  if loop_out.is_empty() && count == 0 {
    for k in &outs { if !out3.has(k) { out3.put_null(k); } }
    return Ok((out3, true, None, true, Some(0)));
  }
  let mut i = 0usize;
  let mut iters = 0i64;
  let mut last_rule: Option<String> = None;
  let mut lastb = true;
  loop {
    let mut in3 = DataObject::new();
    for (k, d) in in1.objects() {
      if !list_in.contains(&k) { in3.set_property(&k, d); }
      else {
        let a = d.array();
        if i >= a.len() { return Err(fault("panic", format!("iteration {} indexes past the end of list input '{}' (a loop output with an empty list input panics flowlang)", i, k))); }
        in3.set_property(&k, a.get_property(i));
      }
    }
    iters += 1;
    ctx.steps += 1;
    if ctx.steps > ctx.budget { return Err(fault("budget", format!("op iterations exceeded the step budget of {} (an open loop without finish?)", ctx.budget))); }
    let (res, b, r) = eval_operation(op, in3, ctx, ffin, &mut ofin)?;
    lastb = b;
    if let Some(rr) = &r {
      if rr == "next" || rr == "terminate" || rr == "fail" { return Ok((res, b, r, false, Some(iters))); }
      last_rule = r.clone();
    }
    for k in &outs {
      if !res.has(k) { return Err(fault("absent-output", format!("iteration {} result lacks output '{}' (flowlang panics in get_property)", iters - 1, k))); }
      let dp = res.get_property(k);
      if list_out.contains(k) { out3.get_array(k).push_property(dp); }
      else {
        out3.set_property(k, dp.clone());
        if let Some((_, lf)) = loop_out.iter().find(|(a, _)| a == k) { in1.set_property(lf, dp); }
      }
    }
    if ofin { break; }
    if n > 0 { i += 1; if i == count { break; } }
  }
  Ok((out3, lastb, last_rule, true, Some(iters)))
}
fn eval_step(case: &DataObject, f: &mut DataObject, i: usize, ctx: &mut Ctx) -> DataObject {
  prio_remove(f, i);
  let op = case.get_array("cmds").get_object(i);
  let inputs = f.get_array("inputs").get_object(i);
  let mut e = ev("eval", f);
  e.put_int("op", i as i64);
  e.put_string("optype", &op.get_string("type"));
  e.put_object("in", inputs.deep_copy());
  let mut ffin = false;
  let s0 = ctx.steps;
  match eval_op(&op, &inputs, ctx, &mut ffin) {
    Err((code, msg)) => err_ev(f, &code, format!("op {}: {}", i, msg), Some(i)),
    Ok((out, b, rule, done, iters)) => {
      e.put_object("out", out.deep_copy());
      e.put_boolean("b", b);
      match &rule { Some(r) => e.put_string("rule", r), None => e.put_null("rule") }
      e.put_boolean("done", done);
      match iters { Some(n) => e.put_int("iters", n), None => e.put_null("iters") }
      e.put_int("sub", ctx.steps - s0);
      if done { f.get_array("done").put_boolean(i, true); f.get_array("results").put_object(i, out); }
      if let Some(r) = &rule { let mut p = DataObject::new(); p.put_string("rule", r); p.put_int("op", i as i64); f.put_object("pending", p); }
      if ffin && rule.as_deref() != Some("finish") { f.put_boolean("finish", true); e.put_boolean("finish_set", true); }
      e
    }
  }
}
fn step_frame(body: &DataObject, f: &mut DataObject, pick: &DataObject, ctx: &mut Ctx) -> DataObject {
  let phase = f.get_string("phase");
  if phase == "enter" {
    let mut e = ev("enter", f);
    e.put_string("kind", &f.get_string("kind"));
    put_copy(&mut e, "args", f.get_property("args"));
    f.put_string("phase", "seed");
    return e;
  }
  if phase == "closing" {
    let mut e = ev("done", f);
    let oc = f.get_string("outcome");
    e.put_string("outcome", &oc); put_copy(&mut e, "out", f.get_property("out")); e.put_boolean("fail", oc == "fail");
    f.put_string("phase", "ended");
    return e;
  }
  if phase == "ended" { return err_ev(f, "ended", "the run has already ended".to_string(), None); }
  let cidx = f.get_int("case");
  let case = match case_at(body, cidx) { Some(c) => c, None => { return err_ev(f, "panic", format!("case {} is not in the chain", cidx), None); } };
  if phase == "seed" {
    let mut e = ev("seed", f);
    let pre = seed_case(&case, f);
    e.put_array("pre", pre);
    e.put_array("ready", ready_set(&case, f));
    e.put_array("diag", diag_case(&case));
    f.put_string("phase", "run");
    return e;
  }
  // a fired rule's effect is the step after the eval that reports it
  if f.get_property("pending").is_object() {
    let p = f.get_object("pending");
    let rule = p.get_string("rule"); let op = p.get_int("op");
    f.put_null("pending");
    if rule == "next" {
      if case.has("nextcase") {
        let mut e = ev("next", f); e.put_int("op", op); e.put_int("from", cidx); e.put_int("to", cidx + 1);
        f.put_int("case", cidx + 1); f.put_string("phase", "seed");
        return e;
      }
      return err_ev(f, "I-4", format!("a next rule fired on op {} in case {} but the chain has no next case (flowlang panics: nextcase.unwrap())", op, cidx), Some(op as usize));
    }
    if rule == "terminate" || rule == "fail" {
      let mut e = ev(&rule, f); e.put_int("op", op);
      f.put_string("outcome", &rule); f.put_string("phase", "closing");
      return e;
    }
    let mut e = ev("finish", f); e.put_int("op", op);
    f.put_boolean("finish", true);
    return e;
  }
  let chosen = if pick.has("kind") { Some((pick.get_string("kind"), pick.get_int("index") as usize)) } else { default_pick(&case, f) };
  match chosen {
    None => end_of_case(f),
    Some((k, i)) => {
      let mut e = if k == "wire" { deliver(&case, f, i) } else if k == "sync" { fire_sync(&case, f, i) } else { eval_step(&case, f, i, ctx) };
      e.put_string("pick", if pick.has("kind") { "user" } else { "default" });
      e
    }
  }
}

// ---- the command ----
let mut res = DataObject::new();
if !state.get_property("body").is_object() {
  res.put_string("status", "err");
  res.put_string("msg", "state needs body (the flow's root Case JSON) and args; pass {body, args} to start a run");
  return res;
}
let body = state.get_object("body");
let mut f = if state.get_property("frame").is_object() { state.get_object("frame").deep_copy() }
  else { new_frame(if state.get_property("args").is_object() { state.get_object("args").deep_copy() } else { DataObject::new() }, "root") };
let seq = if state.has("seq") { state.get_int("seq") } else { 0 };
let mut ns = DataObject::new();
ns.put_object("body", body.clone());
if f.get_string("phase") == "ended" {
  ns.put_object("frame", f); ns.put_int("seq", seq);
  res.put_string("status", "ok"); res.put_object("state", ns); res.put_null("event");
  res.put_boolean("ended", true); res.put_array("ready", DataArray::new());
  return res;
}
let mut pk = DataObject::new();
if pick.has("kind") {
  let kind = pick.get_string("kind");
  if kind == "wire" || kind == "sync" || kind == "op" {
    let idx = if pick.has("index") { pick.get_int("index") } else { -1 };
    let ready = ready_now(&body, &f);
    let mut ok = false;
    for r in ready.objects() { let r = r.object(); if r.get_string("kind") == kind && r.has("index") && r.get_int("index") == idx { ok = true; } }
    if !ok {
      res.put_string("status", "err");
      res.put_string("msg", &format!("pick {}:{} is not ready", kind, idx));
      res.put_array("ready", ready);
      res.put_object("state", state.clone());
      return res;
    }
    pk.put_string("kind", &kind); pk.put_int("index", idx);
  }
}
let mut ctx = Ctx { steps: 0, budget: 100000, depth: 0 };
let fb = body.clone();
let pk2 = pk.clone();
let mut f2 = f.clone();
let r = panic::catch_unwind(panic::AssertUnwindSafe(move || { let mut c = ctx; step_frame(&fb, &mut f2, &pk2, &mut c) }));
let mut e = match r {
  Ok(e) => e,
  Err(p) => err_ev(&mut f, "panic", format!("the stepper panicked: {}", panic_text(&p)), None),
};
e.put_int("seq", seq);
let ready = ready_now(&body, &f);
let ended = f.get_string("phase") == "ended";
if !ended {
  if let Some(c) = case_at(&body, f.get_int("case")) {
    if f.get_string("phase") == "run" && !f.get_property("pending").is_object() {
      let mut fc = f.deep_copy();
      match default_pick(&c, &mut fc) { Some((k, i)) => res.put_object("default", item(&k, i)), None => res.put_null("default") }
    }
  }
}
ns.put_object("frame", f); ns.put_int("seq", seq + 1);
res.put_string("status", "ok");
res.put_object("event", e);
res.put_array("ready", ready);
res.put_boolean("ended", ended);
res.put_object("state", ns);
res