// Runs a saved flow command through flowlang's Code::execute and through the stepper (run, given policy)
// and compares OUTCOMES - the result envelope and the persistent globals the flow can touch - not event
// order. The stepper's trace is also checked by validate. A body with a static I-1/I-2/I-4 finding is
// NEVER run under Code::execute (it would hang or panic the thread); only the stepper runs it.
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
fn panic_text(p: &Box<dyn std::any::Any + Send>) -> String {
  if let Some(s) = p.downcast_ref::<&str>() { s.to_string() } else if let Some(s) = p.downcast_ref::<String>() { s.clone() } else { "unknown panic".to_string() }
}
fn load_flow(lib: &str, id: &str) -> Option<DataObject> {
  let (l, i) = (lib.to_string(), id.to_string());
  panic::catch_unwind(move || {
    let store = DataStore::new();
    let data = store.get_data(&l, &i).get_object("data");
    if data.get_string("type") != "flow" { return None; }
    let codename = data.get_string("flow");
    Some(store.get_data(&l, &codename).get_object("data").get_object("flow"))
  }).unwrap_or(None)
}
fn has_cycle(adj: &Vec<Vec<usize>>) -> bool {
  fn dfs(u: usize, adj: &Vec<Vec<usize>>, st: &mut Vec<u8>) -> bool {
    st[u] = 1;
    for &v in &adj[u] { if st[v] == 1 { return true; } if st[v] == 0 && dfs(v, adj, st) { return true; } }
    st[u] = 2; false
  }
  let mut st = vec![0u8; adj.len()];
  for u in 0..adj.len() { if st[u] == 0 && dfs(u, adj, &mut st) { return true; } }
  false
}
// static scan: I-1 (awaited by name, no wire targets it), I-2 (wire+synchro cycle), I-4 (next in the last case);
// also collects every persistent name reachable (locals, chain, flow callees) for the globals snapshot.
fn scan(case: &DataObject, path: &str, f: &mut Vec<String>, keys: &mut Vec<String>, seen: &mut Vec<String>, depth: usize) {
  let cmds = case.get_array("cmds"); let n = cmds.len();
  let mut names: Vec<String> = Vec::new(); let mut exact: Vec<(i64, String)> = Vec::new();
  let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
  for c in case.get_array("cons").objects() {
    let c = c.object(); let (s, d) = (c.get_array("src"), c.get_array("dest"));
    names.push(d.get_string(1)); exact.push((d.get_int(0), d.get_string(1)));
    let (si, di) = (s.get_int(0), d.get_int(0));
    if si >= 0 && di >= 0 && (si as usize) < n && (di as usize) < n { adj[si as usize].push(di as usize); }
  }
  if case.has("syncs") { for s in case.get_array("syncs").objects() {
    let s = s.object(); let (si, di) = (s.get_int("src"), s.get_int("dest"));
    if si >= 0 && di >= 0 && si != di && (si as usize) < n && (di as usize) < n { adj[si as usize].push(di as usize); }
  } }
  for i in 0..n {
    let op = cmds.get_object(i);
    for name in op.get_object("in").keys() {
      if names.contains(&name) && !exact.contains(&(i as i64, name.clone())) { f.push(format!("I-1 {} op {} input '{}' is awaited by name but no wire targets it", path, i, name)); }
    }
    if op.has("condition") && op.get_property("condition").is_object() && op.get_object("condition").get_string("rule") == "next" && !case.has("nextcase") {
      f.push(format!("I-4 {} op {} has a next rule in the last case", path, i));
    }
    let typ = op.get_string("type");
    if typ == "persistent" { let k = op.get_string("name"); if !keys.contains(&k) { keys.push(k); } }
    if op.has("localdata") && op.get_property("localdata").is_object() { scan(&op.get_object("localdata"), &format!("{}/op{}", path, i), f, keys, seen, depth); }
    if typ == "command" && op.has("cmd") && depth < 8 {
      let sa: Vec<String> = op.get_string("cmd").split(':').map(|s| s.to_string()).collect();
      if sa.len() >= 3 {
        let key = format!("{}:{}", sa[0], sa[2]);
        if !seen.contains(&key) { seen.push(key.clone()); if let Some(fl) = load_flow(&sa[0], &sa[2]) { scan(&fl, &format!("{}/op{}={}", path, i, key), f, keys, seen, depth + 1); } }
      }
    }
  }
  if has_cycle(&adj) { f.push(format!("I-2 {} wires plus synchros form a cycle", path)); }
  if case.has("nextcase") { scan(&case.get_object("nextcase"), &format!("{}>next", path), f, keys, seen, depth); }
}
fn snapshot(keys: &Vec<String>) -> DataObject {
  let g = DataStore::globals();
  let mut o = DataObject::new();
  for k in keys { if g.has(k) { let d = g.get_property(k); if d.is_object() { o.put_object(k, d.object().deep_copy()); } else if d.is_array() { o.put_array(k, d.array().deep_copy()); } else { o.set_property(k, d); } } }
  o
}
fn apply(keys: &Vec<String>, base: &DataObject, presets: &DataObject) {
  let mut g = DataStore::globals();
  for k in keys {
    let src = if presets.has(k) { Some(presets.get_property(k)) } else if base.has(k) { Some(base.get_property(k)) } else { None };
    match src {
      Some(d) => { if d.is_object() { g.put_object(k, d.object().deep_copy()); } else if d.is_array() { g.put_array(k, d.array().deep_copy()); } else { g.set_property(k, d); } }
      None => { if g.has(k) { g.remove_property(k); } }
    }
  }
}

let mut res = DataObject::new();
let store = DataStore::new();
let id = store.lookup_cmd_id(&lib, &ctl, &cmd);
if id.is_empty() { res.put_string("status", "err"); res.put_string("msg", &format!("command {}:{}:{} not found", lib, ctl, cmd)); return res; }
let body = match load_flow(&lib, &id) { Some(b) => b, None => { res.put_string("status", "err"); res.put_string("msg", &format!("{} is not a flow command", cmd)); return res; } };
let mut findings: Vec<String> = Vec::new();
let mut keys: Vec<String> = Vec::new();
let mut seen: Vec<String> = vec![format!("{}:{}", lib, id)];
scan(&body, "root", &mut findings, &mut keys, &mut seen, 0);
for (k, _) in presets.objects() { if !keys.contains(&k) { keys.push(k); } }
let safe = findings.is_empty();
let base = snapshot(&keys);
let mut fl_env = DataObject::new();
let mut fl_glob = DataObject::new();
if safe {
  apply(&keys, &base, &presets);
  let (l2, i2, a2) = (lib.clone(), id.clone(), args.deep_copy());
  match panic::catch_unwind(panic::AssertUnwindSafe(move || Command::new(&l2, &i2).execute(a2))) {
    Ok(Ok(o)) => { fl_env.put_string("status", "ok"); fl_env.put_object("data", o); }
    Ok(Err(e)) => { fl_env.put_string("status", "err"); fl_env.put_string("msg", if format!("{:?}", e) == "Fail" { "fail".to_string() } else { format!("{:?}", e) }.as_str()); }
    Err(p) => { fl_env.put_string("status", "err"); fl_env.put_string("msg", &format!("panic: {}", panic_text(&p))); }
  }
  fl_glob = snapshot(&keys);
} else { fl_env.put_string("status", "skipped"); fl_env.put_string("msg", "static findings: never run under Code::execute"); }
apply(&keys, &base, &presets);
let pol = if policy.is_empty() { "default".to_string() } else { policy.clone() };
let r = super::run::run(body.clone(), args.deep_copy(), pol.clone(), 10000);
let st_env = if r.has("result") { r.get_object("result") } else { r.clone() };
let st_glob = snapshot(&keys);
let evs = if r.has("events") { r.get_array("events") } else { DataArray::new() };
let v = super::validate::validate(body.clone(), args.deep_copy(), evs.clone());
let env_match = safe && deq(&Data::DObject(fl_env.data_ref), &Data::DObject(st_env.data_ref));
let glob_match = safe && deq(&Data::DObject(fl_glob.data_ref), &Data::DObject(st_glob.data_ref));
res.put_string("status", "ok");
res.put_boolean("ok", env_match && glob_match && v.get_boolean("ok"));
res.put_boolean("safe", safe);
res.put_string("findings", &findings.join("; "));
res.put_object("flowlang", fl_env);
res.put_object("stepper", st_env);
res.put_boolean("envelope_match", env_match);
res.put_object("globals_flowlang", fl_glob);
res.put_object("globals_stepper", st_glob);
res.put_boolean("globals_match", glob_match);
res.put_boolean("valid", v.get_boolean("ok"));
res.put_array("violations", v.get_array("violations"));
res.put_int("steps", r.get_int("steps"));
res.put_string("policy", &pol);
if r.has("end") { res.put_object("end", r.get_object("end")); }
if r.has("max_depth") { res.put_int("max_depth", r.get_int("max_depth")); }
res