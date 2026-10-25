// Flow step debugger P3 - debug SESSIONS over the core stepper, with a recorded TAPE.
// A session (in memory, globals.flowstep_debug.<id>) keeps: the LIVE stepper state (value handles shared, as
// flowlang does), a plain deep COPY of it (`cur`, graph bodies replaced by "$body:N" refs into `bodies`), and
// the TAPE: one entry per step = its change list (each change {p, o, n} is the step AND its inverse), the
// persistent-global changes {k, o, n}, the view after it {event, ready, default, ended, depth}, the state hash,
// and flags fx (an opaque rust/python command op ran - rollback restores the interpreter, not the world) and
// persist. A full snapshot every 64 steps makes goto cheap. Moving back/goto applies inverses (or a snapshot +
// forwards) and restores the persistent globals; stepping forward over the tape REPLAYS it (nothing
// re-executes) while the requested item is the one the tape took; picking another ready item, editing a value
// or mode reexecute FORKS: the old tail is kept as a branch record and the step executes from the restored state.
// Modes: into | over | out | run_to (pick.target) | continue (own thread; pause flag; budget; pick.wait joins)
// | reexecute | back (pick.count) | goto (pick.seq) | edit (pick.path, pick.value) | branch (pick.id: swap the
// tail with a recorded branch at its fork point) | pause | state | init (debug_start). Breakpoints: op/wire/sync
// stop BEFORE the item is picked, case after its seed, rule after the eval that fired it; stall/error end the run.
const SNAP_EVERY: i64 = 64;
const CAP_STEPS: i64 = 50000;
const CAP_NODES: i64 = 4000000;
const MAX_BRANCHES: usize = 16;
const MAX_EVENTS: usize = 400;
const DEFAULT_BUDGET: i64 = 10000;

fn now() -> i64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0) }
fn is_o(o: &DataObject, k: &str) -> bool { o.has(k) && o.get_property(k).is_object() }
fn is_a(o: &DataObject, k: &str) -> bool { o.has(k) && o.get_property(k).is_array() }
fn gs(o: &DataObject, k: &str) -> String { if o.has(k) && o.get_property(k).is_string() { o.get_string(k) } else { String::new() } }
fn gb(o: &DataObject, k: &str) -> bool { o.has(k) && o.get_property(k).is_boolean() && o.get_boolean(k) }
fn gi(o: &DataObject, k: &str) -> i64 { if o.has(k) && o.get_property(k).is_int() { o.get_int(k) } else { 0 } }
fn go(o: &DataObject, k: &str) -> DataObject { if is_o(o, k) { o.get_object(k) } else { DataObject::new() } }
fn ga(o: &DataObject, k: &str) -> DataArray { if is_a(o, k) { o.get_array(k) } else { DataArray::new() } }
fn err(msg: &str) -> DataObject { let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", msg); o }
fn panic_text(p: &Box<dyn std::any::Any + Send>) -> String {
  if let Some(s) = p.downcast_ref::<&str>() { s.to_string() } else if let Some(s) = p.downcast_ref::<String>() { s.clone() } else { "unknown panic".to_string() }
}
fn sessions() -> DataObject {
  let mut g = DataStore::globals();
  if !is_o(&g, "flowstep_debug") { g.put_object("flowstep_debug", DataObject::new()); }
  g.get_object("flowstep_debug")
}
// ---- deep copy that keeps aliasing (one memo per copy; the memo keeps the new handles alive) ----
struct Memo { o: HashMap<usize, DataObject>, a: HashMap<usize, DataArray> }
fn cp(d: &Data, m: &mut Memo) -> Data {
  if d.is_object() {
    let src = d.object();
    if let Some(x) = m.o.get(&src.data_ref) { return Data::DObject(x.data_ref); }
    let mut n = DataObject::new();
    m.o.insert(src.data_ref, n.clone());
    for (k, v) in src.objects() { let c = cp(&v, m); n.set_property(&k, c); }
    Data::DObject(n.data_ref)
  } else if d.is_array() {
    let src = d.array();
    if let Some(x) = m.a.get(&src.data_ref) { return Data::DArray(x.data_ref); }
    let mut n = DataArray::new();
    m.a.insert(src.data_ref, n.clone());
    for v in src.objects() { let c = cp(&v, m); n.push_property(c); }
    Data::DArray(n.data_ref)
  } else { d.clone() }
}
fn copy_obj(o: &DataObject) -> DataObject { let mut m = Memo { o: HashMap::new(), a: HashMap::new() }; let d = cp(&Data::DObject(o.data_ref), &mut m); d.object() }
// a copied value parked in a holder object {v} so its handle stays alive until it is inserted somewhere
fn copy_val(d: &Data) -> DataObject { let mut m = Memo { o: HashMap::new(), a: HashMap::new() }; let mut w = DataObject::new(); let c = cp(d, &mut m); w.set_property("v", c); w }
fn nodes(d: &Data) -> i64 {
  if d.is_object() { let mut n = 1; for (_, v) in d.object().objects() { n += nodes(&v); } n }
  else if d.is_array() { let mut n = 1; for v in d.array().objects() { n += nodes(&v); } n }
  else { 1 }
}
// ---- the plain copy of a stepper state: graph bodies (never mutated) become "$body:N" refs ----
fn body_key(f: &DataObject, b: &DataObject) -> String {
  if gs(f, "kind") == "command" && f.has("cmd") { format!("cmd:{}", gs(f, "cmd")) } else { format!("ref:{}", b.data_ref) }
}
fn body_ref(key: &str, b: &DataObject, bodies: &mut DataArray, keys: &mut DataArray) -> String {
  for i in 0..keys.len() { if keys.get_string(i) == key { return format!("$body:{}", i); } }
  bodies.push_object(b.clone()); keys.push_string(key);
  format!("$body:{}", bodies.len() - 1)
}
fn snap(st: &DataObject, bodies: &mut DataArray, keys: &mut DataArray) -> DataObject {
  let mut m = Memo { o: HashMap::new(), a: HashMap::new() };
  let mut n = DataObject::new();
  for (k, v) in st.objects() {
    if k == "body" && v.is_object() { let b = v.object(); n.put_string("body", &body_ref(&format!("ref:{}", b.data_ref), &b, bodies, keys)); }
    else if k == "frames" && v.is_array() {
      let mut fa = DataArray::new();
      for f in v.array().objects() {
        if !f.is_object() { let c = cp(&f, &mut m); fa.push_property(c); continue; }
        let fo = f.object();
        let mut nf = DataObject::new();
        for (fk, fv) in fo.objects() {
          if fk == "body" && fv.is_object() { let b = fv.object(); nf.put_string("body", &body_ref(&body_key(&fo, &b), &b, bodies, keys)); }
          else { let c = cp(&fv, &mut m); nf.set_property(&fk, c); }
        }
        fa.push_object(nf);
      }
      n.put_array("frames", fa);
    } else { let c = cp(&v, &mut m); n.set_property(&k, c); }
  }
  n
}
fn resolve(o: &mut DataObject, bodies: &DataArray) {
  if o.has("body") && o.get_property("body").is_string() {
    let s = o.get_string("body");
    if let Some(i) = s.strip_prefix("$body:") { if let Ok(i) = i.parse::<usize>() { if i < bodies.len() { o.put_object("body", bodies.get_object(i)); } } }
  }
}
fn unsnap(c: &DataObject, bodies: &DataArray) -> DataObject {
  let mut n = copy_obj(c);
  resolve(&mut n, bodies);
  if is_a(&n, "frames") { for f in n.get_array("frames").objects() { if f.is_object() { let mut fo = f.object(); resolve(&mut fo, bodies); } } }
  n
}
// ---- canonical hash (sorted keys) ----
fn canon(d: &Data, s: &mut String) {
  if d.is_object() {
    let mut ks = d.object().objects(); ks.sort_by(|a, b| a.0.cmp(&b.0));
    s.push('{'); for (k, v) in ks { s.push_str(&format!("{:?}:", k)); canon(&v, s); s.push(','); } s.push('}');
  } else if d.is_array() {
    s.push('['); for v in d.array().objects() { canon(&v, s); s.push(','); } s.push(']');
  } else {
    match d {
      Data::DInt(i) => s.push_str(&i.to_string()),
      Data::DFloat(f) => s.push_str(&format!("{:?}f", f)),
      Data::DBoolean(b) => s.push_str(if *b { "true" } else { "false" }),
      Data::DString(t) => s.push_str(&format!("{:?}", t)),
      Data::DNull => s.push_str("null"),
      _ => { let mut w = DataObject::new(); w.set_property("v", d.clone()); s.push_str(&w.to_string()); }
    }
  }
}
fn canon_str(d: &Data) -> String { let mut s = String::new(); canon(d, &mut s); s }
fn hash_obj(o: &DataObject) -> String {
  let s = canon_str(&Data::DObject(o.data_ref));
  let mut h: u64 = 0xcbf29ce484222325;
  for b in s.as_bytes() { h ^= *b as u64; h = h.wrapping_mul(0x100000001b3); }
  format!("{:016x}", h)
}
// ---- structural diff: every change {p, o, n} carries both directions; absent o/n = the key/element is absent ----
#[derive(Clone)]
enum P { K(String), I(usize) }
fn emit(path: &Vec<P>, o: Option<Data>, n: Option<Data>, out: &mut DataArray, size: &mut i64) {
  let mut pa = DataArray::new();
  for e in path { match e { P::K(s) => pa.push_string(s), P::I(i) => pa.push_int(*i as i64) } }
  let mut c = DataObject::new(); c.put_array("p", pa);
  if let Some(o) = o { *size += nodes(&o); c.set_property("o", o); }
  if let Some(n) = n { *size += nodes(&n); c.set_property("n", n); }
  *size += 1;
  out.push_object(c);
}
fn same_scalar(a: &Data, b: &Data) -> bool {
  match (a, b) {
    (Data::DInt(x), Data::DInt(y)) => x == y,
    (Data::DFloat(x), Data::DFloat(y)) => x.to_bits() == y.to_bits(),
    (Data::DBoolean(x), Data::DBoolean(y)) => x == y,
    (Data::DString(x), Data::DString(y)) => x == y,
    (Data::DNull, Data::DNull) => true,
    _ => if a.is_object() || a.is_array() || b.is_object() || b.is_array() { false } else { canon_str(a) == canon_str(b) },
  }
}
fn diff(a: &Data, b: &Data, path: &mut Vec<P>, out: &mut DataArray, size: &mut i64) {
  if a.is_object() && b.is_object() {
    let (x, y) = (a.object(), b.object());
    if x.data_ref == y.data_ref { return; }
    for (k, v) in x.objects() {
      path.push(P::K(k.clone()));
      if y.has(&k) { diff(&v, &y.get_property(&k), path, out, size); } else { emit(path, Some(v), None, out, size); }
      path.pop();
    }
    for (k, v) in y.objects() { if !x.has(&k) { path.push(P::K(k.clone())); emit(path, None, Some(v), out, size); path.pop(); } }
    return;
  }
  if a.is_array() && b.is_array() {
    let (x, y) = (a.array(), b.array());
    if x.data_ref == y.data_ref { return; }
    let (lx, ly) = (x.len(), y.len());
    let m = if lx < ly { lx } else { ly };
    for i in 0..m { path.push(P::I(i)); diff(&x.get_property(i), &y.get_property(i), path, out, size); path.pop(); }
    for i in m..ly { path.push(P::I(i)); emit(path, None, Some(y.get_property(i)), out, size); path.pop(); }
    for i in (m..lx).rev() { path.push(P::I(i)); emit(path, Some(x.get_property(i)), None, out, size); path.pop(); }
    return;
  }
  if same_scalar(a, b) { return; }
  emit(path, Some(a.clone()), Some(b.clone()), out, size);
}
// apply one change forward (n) or backward (o); the inserted value is a fresh copy so the tape stays immutable
fn apply(root: &DataObject, ch: &DataObject, fwd: bool) {
  let p = ch.get_array("p");
  let n = p.len();
  if n == 0 { return; }
  let key = if fwd { "n" } else { "o" };
  let holder = if ch.has(key) { Some(copy_val(&ch.get_property(key))) } else { None };
  let mut cur = Data::DObject(root.data_ref);
  for j in 0..n - 1 {
    let e = p.get_property(j);
    cur = if e.is_int() { cur.array().get_property(e.int() as usize) } else { cur.object().get_property(&e.string()) };
  }
  let last = p.get_property(n - 1);
  if last.is_int() {
    let mut a = cur.array(); let i = last.int() as usize;
    match &holder { Some(h) => { let v = h.get_property("v"); if i >= a.len() { a.push_property(v); } else { a.set_property(i, v); } }, None => { if i < a.len() { a.remove_property(i); } } }
  } else {
    let mut o = cur.object(); let k = last.string();
    match &holder { Some(h) => { o.set_property(&k, h.get_property("v")); }, None => { if o.has(&k) { o.remove_property(&k); } } }
  }
}
// ---- alias topology (R3) ----
// cp/diff preserve identity WITHIN one copy but apply necessarily copies each changed path separately.
// Record every reachable alias group from the LIVE interpreter graph and re-link those paths at the
// cursor. Graph bodies are immutable graph references, not values, and never participate in diff.
// The map is tape data (with real size accounting), not an assertion based on the canonical hash.
fn ref_at(d: &Data) -> usize { if d.is_object() { d.object().data_ref } else { d.array().data_ref } }
fn graph_body_key(path: &Vec<P>) -> bool {
  // Only the interpreter's root/frame graph slots are excluded. A user value or persistent
  // global is allowed to have an ordinary property named "body".
  if path.len() == 0 { return true; }
  if path.len() == 1 { if let P::K(s) = &path[0] { return s == "s"; } }
  if path.len() == 2 {
    if let (P::K(a), P::I(_)) = (&path[0], &path[1]) { return a == "frames"; }
  }
  if path.len() == 3 {
    if let (P::K(s), P::K(f), P::I(_)) = (&path[0], &path[1], &path[2]) { return s == "s" && f == "frames"; }
  }
  false
}
fn alias_walk(d: &Data, path: &mut Vec<P>, seen: &mut HashMap<usize, DataArray>, groups: &mut DataArray) {
  if !(d.is_object() || d.is_array()) { return; }
  let id = ref_at(d);
  if seen.contains_key(&id) {
    if seen.get(&id).unwrap().len() > 0 { groups.push_array(seen.get(&id).unwrap().clone()); }
    let mut p = DataArray::new();
    for e in path.iter() { match e { P::K(s) => p.push_string(s), P::I(i) => p.push_int(*i as i64) } }
    groups.push_array(p);
    return;
  }
  let mut p = DataArray::new();
  for e in path.iter() { match e { P::K(s) => p.push_string(s), P::I(i) => p.push_int(*i as i64) } }
  seen.insert(id, p);
  if d.is_object() { for (k, v) in d.object().objects() { if k == "body" && graph_body_key(path) { continue; } path.push(P::K(k)); alias_walk(&v, path, seen, groups); path.pop(); } }
  else { for (i, v) in d.array().objects().iter().enumerate() { path.push(P::I(i)); alias_walk(v, path, seen, groups); path.pop(); } }
}
fn aliases(st: &DataObject) -> DataArray {
  let mut seen = HashMap::new(); let mut pairs = DataArray::new(); let mut path = Vec::new();
  alias_walk(&Data::DObject(st.data_ref), &mut path, &mut seen, &mut pairs);
  // alias_walk emits (first path, repeated path) pairs. Group by the FIRST path, not by
  // adjacent pairs: with three references the pairs are (a,b),(a,c), and b must not be lost.
  let mut grouped: HashMap<String, DataArray> = HashMap::new(); let mut order: Vec<String> = Vec::new();
  let mut i = 0;
  while i + 1 < pairs.len() {
    let first = pairs.get_array(i); let second = pairs.get_array(i + 1);
    let key = canon_str(&Data::DArray(first.data_ref));
    if !grouped.contains_key(&key) {
      let mut paths = DataArray::new(); paths.push_array(first);
      grouped.insert(key.clone(), paths); order.push(key.clone());
    }
    grouped.get_mut(&key).unwrap().push_array(second);
    i += 2;
  }
  let mut out = DataArray::new();
  for key in order { let paths = grouped.get(&key).unwrap(); if paths.len() > 1 { out.push_array(paths.clone()); } }
  out
}
fn alias_size(a: &DataArray) -> i64 { let mut n = 0; for p in a.objects() { n += 1 + p.array().len() as i64; } n }
// Bring external global references back into the live interpreter graph before it executes.
// This is intentionally NOT debug isolation: the global handle is shared, exactly as in an
// ordinary flow run, so a later in-place set/push mutates both the flow value and the global.
fn relink_live(s: &mut DataObject, live: &DataObject) {
  let groups = ga(s, "xcur"); if groups.len() == 0 { return; }
  let g = DataStore::globals(); let mut roots = DataObject::new();
  roots.put_object("s", live.clone()); roots.put_object("g", g); link_aliases(&roots, &groups);
}
// Alias groups which cross the interpreter/persistent boundary. Paths are rooted at
// {s: stepper state, g: the REAL process globals}; global_refs deliberately does not copy.
fn global_refs(names: &DataArray) -> DataObject {
  let g = DataStore::globals(); let mut named = DataObject::new();
  for i in 0..names.len() { let k = names.get_string(i); if g.has(&k) { named.set_property(&k, g.get_property(&k)); } }
  named
}
fn cross_aliases(st: &DataObject, names: &DataArray) -> DataArray {
  let mut roots = DataObject::new(); roots.put_object("s", st.clone()); roots.put_object("g", global_refs(names));
  let mut out = DataArray::new();
  for group in aliases(&roots).objects() {
    let paths = group.array(); let (mut has_s, mut has_g) = (false, false);
    for p in paths.objects() {
      let path = p.array();
      if path.len() > 1 && path.get_property(0).is_string() {
        let root = path.get_string(0); if root == "s" { has_s = true; } else if root == "g" { has_g = true; }
      }
    }
    if has_s && has_g { out.push_array(paths); }
  }
  out
}
fn link_aliases(root: &DataObject, groups: &DataArray) {
  let mut i = 0;
  while i < groups.len() {
    let paths = groups.get_array(i); i += 1;
    if paths.len() < 2 { continue; }
    let mut shared: Option<Data> = None;
    for p in paths.objects() {
      let pa = p.array(); let mut cur = Data::DObject(root.data_ref); let mut ok = pa.len() > 0;
      for j in 0..pa.len() {
        let e = pa.get_property(j);
        if e.is_int() { if cur.is_array() && (e.int() as usize) < cur.array().len() { cur = cur.array().get_property(e.int() as usize); } else { ok = false; break; } }
        else if cur.is_object() && cur.object().has(&e.string()) { cur = cur.object().get_property(&e.string()); } else { ok = false; break; }
      }
      if !ok { break; }
      if let Some(v) = &shared {
        if ref_at(&cur) == ref_at(v) { continue; }
        let parent = pa.get_property(pa.len() - 1);
        // Re-resolve the parent (cur is the child). Paths never address the root itself.
        let mut par = Data::DObject(root.data_ref);
        for j in 0..pa.len() - 1 { let e = pa.get_property(j); par = if e.is_int() { par.array().get_property(e.int() as usize) } else { par.object().get_property(&e.string()) }; }
        if parent.is_int() { par.array().set_property(parent.int() as usize, v.clone()); }
        else { par.object().set_property(&parent.string(), v.clone()); }
      } else { shared = Some(cur); }
    }
  }
}
fn cursor_aliases(s: &DataObject) -> DataArray {
  let (c, base) = (gi(s, "cursor"), gi(s, "base"));
  if c == base { ga(&go(&s.get_object("snaps"), &base.to_string()), "a") } else { ga(&s.get_array("tape").get_object((c - 1 - base) as usize), "a") }
}
fn restore_aliases(s: &mut DataObject) {
  let a = cursor_aliases(s);
  if a.len() > 0 { unshare(s); let cur = s.get_object("cur"); link_aliases(&cur, &a); }
}
fn path_prefix(p: &DataArray, prefix: &DataArray) -> bool {
  if prefix.len() > p.len() { return false; }
  for i in 0..prefix.len() { if !same_scalar(&p.get_property(i), &prefix.get_property(i)) { return false; } }
  true
}
fn aliases_after_edit(before: &DataArray, edited: &DataArray) -> DataArray {
  let mut out = DataArray::new();
  for g in before.objects() {
    let paths = g.array(); let mut keep = DataArray::new();
    for p in paths.objects() { if !path_prefix(&p.array(), edited) { keep.push_property(p); } }
    if keep.len() > 1 { out.push_array(keep); }
  }
  out
}
// ---- persistent globals ----
fn scan(body: &DataObject, names: &mut DataArray) {
  let mut c = Some(body.clone());
  while let Some(case) = c {
    if is_a(&case, "cmds") {
      for op in case.get_array("cmds").objects() {
        if !op.is_object() { continue; }
        let op = op.object();
        let t = gs(&op, "type");
        if t == "persistent" && op.has("name") {
          let nm = gs(&op, "name");
          let mut have = false; for i in 0..names.len() { if names.get_string(i) == nm { have = true; } }
          if !have { names.push_string(&nm); }
        }
        if t == "local" && is_o(&op, "localdata") { scan(&op.get_object("localdata"), names); }
      }
    }
    c = if is_o(&case, "nextcase") { Some(case.get_object("nextcase")) } else { None };
  }
}
fn capture(names: &DataArray) -> DataObject {
  // ONE memo for the whole named global set: aliases within AND BETWEEN persistent keys survive.
  // Missing keys stay missing; an explicitly present null is a real value.
  let g = DataStore::globals(); let mut named = DataObject::new();
  for i in 0..names.len() { let k = names.get_string(i); if g.has(&k) { named.set_property(&k, g.get_property(&k)); } }
  copy_obj(&named)
}
fn gdiff(pre: &DataObject, names: &DataArray, state: &DataObject) -> DataObject {
  let post = capture(names); let mut out = DataArray::new();
  for (k, _) in pre.objects() {
    let had = true; let has = post.has(&k);
    let changed = if has { canon_str(&pre.get_property(&k)) != canon_str(&post.get_property(&k)) } else { true };
    if !changed { continue; }
    let mut c = DataObject::new(); c.put_string("k", &k);
    if had { c.set_property("o", pre.get_property(&k)); }
    if has { c.set_property("n", post.get_property(&k)); }
    out.push_object(c);
  }
  for (k, _) in post.objects() {
    if pre.has(&k) { continue; }
    let mut c = DataObject::new(); c.put_string("k", &k); c.set_property("n", post.get_property(&k)); out.push_object(c);
  }
  let mut r = DataObject::new(); r.put_array("changes", out);
  r.put_array("before_aliases", aliases(pre)); r.put_array("after_aliases", aliases(&post));
  r.put_array("xafter", cross_aliases(state, names));
  r
}
fn apply_g(e: &DataObject, fwd: bool) {
  let gl = ga(e, "g"); let n = gl.len(); let mut g = DataStore::globals();
  // Copy every changed value through one memo, then restore topology to unchanged named keys too.
  let mut memo = Memo { o: HashMap::new(), a: HashMap::new() };
  for j in 0..n {
    let c = gl.get_object(if fwd { j } else { n - 1 - j }); let k = gs(&c, "k"); let key = if fwd { "n" } else { "o" };
    if c.has(key) { let v = cp(&c.get_property(key), &mut memo); g.set_property(&k, v); } else if g.has(&k) { g.remove_property(&k); }
  }
  let topology = ga(e, if fwd { "gafter" } else { "gbefore" });
  link_aliases(&g, &topology);
}
// ---- views and frame helpers (on the plain copy) ----
fn item(kind: &str, i: i64) -> DataObject { let mut o = DataObject::new(); o.put_string("kind", kind); o.put_int("index", i); o }
fn item_eq(a: &Option<DataObject>, b: &Option<DataObject>) -> bool {
  match (a, b) { (None, None) => true, (Some(x), Some(y)) => gs(x, "kind") == gs(y, "kind") && gi(x, "index") == gi(y, "index"), _ => false }
}
fn mkview(r: &DataObject) -> DataObject {
  let mut v = DataObject::new();
  if is_o(r, "event") { v.put_object("event", r.get_object("event")); } else { v.put_null("event"); }
  v.put_array("ready", ga(r, "ready"));
  if is_o(r, "default") { v.put_object("default", r.get_object("default")); } else { v.put_null("default"); }
  v.put_boolean("ended", gb(r, "ended"));
  v.put_int("depth", gi(r, "depth"));
  copy_obj(&v)
}
fn top_of(s: &DataObject) -> Option<DataObject> { if is_a(s, "frames") { let a = s.get_array("frames"); if a.len() > 0 { return Some(a.get_object(a.len() - 1)); } } None }
fn depth_of(s: &DataObject) -> i64 { if is_a(s, "frames") { s.get_array("frames").len() as i64 } else { 0 } }
fn top_inprog(s: &DataObject) -> bool { match top_of(s) { Some(t) => is_o(&t, "inprog"), None => false } }
fn top_stage(s: &DataObject) -> String { if top_inprog(s) { gs(&top_of(s).unwrap().get_object("inprog"), "stage") } else { String::new() } }
fn top_path(s: &DataObject) -> String { match top_of(s) { Some(t) => ga(&t, "path").to_string(), None => "[]".to_string() } }
fn top_case(s: &DataObject) -> i64 { match top_of(s) { Some(t) => gi(&t, "case"), None => 0 } }
fn tape_len(s: &DataObject) -> i64 { gi(s, "base") + s.get_array("tape").len() as i64 }
fn cur_view(s: &DataObject) -> DataObject {
  let (c, base) = (gi(s, "cursor"), gi(s, "base"));
  if c == base { go(&go(&s.get_object("snaps"), &base.to_string()), "v") } else { s.get_array("tape").get_object((c - 1 - base) as usize).get_object("v") }
}
fn tape_hash(s: &DataObject) -> String {
  let (c, base) = (gi(s, "cursor"), gi(s, "base"));
  if c == base { gs(&go(&s.get_object("snaps"), &base.to_string()), "h") } else { gs(&s.get_array("tape").get_object((c - 1 - base) as usize), "h") }
}
fn in_ready(v: &DataObject, it: &DataObject) -> bool {
  for r in ga(v, "ready").objects() { if r.is_object() { let r = r.object(); if gs(&r, "kind") == gs(it, "kind") && gi(&r, "index") == gi(it, "index") { return true; } } }
  false
}
// ---- tape mechanics ----
fn unshare(s: &mut DataObject) { if gb(s, "shared") { let c = copy_obj(&s.get_object("cur")); s.put_object("cur", c); s.put_boolean("shared", false); } }
fn apply_entry(s: &mut DataObject, e: &DataObject, fwd: bool) {
  unshare(s);
  let cur = s.get_object("cur");
  let ch = ga(e, "c");
  let n = ch.len();
  for j in 0..n { apply(&cur, &ch.get_object(if fwd { j } else { n - 1 - j }), fwd); }
}
// move the cursor to k (base <= k <= tape end); returns the seqs of side-effecting steps crossed backwards
fn goto(s: &mut DataObject, k: i64) -> DataArray {
  let (c, base) = (gi(s, "cursor"), gi(s, "base"));
  let tape = s.get_array("tape");
  let mut fx = DataArray::new();
  if k == c { return fx; }
  if k < c { for q in (k..c).rev() { let e = tape.get_object((q - base) as usize); apply_g(&e, false); if gb(&e, "fx") { fx.push_int(q); } } }
  else { for q in c..k { apply_g(&tape.get_object((q - base) as usize), true); } }
  let sb = (k / SNAP_EVERY) * SNAP_EVERY;
  let snaps = s.get_object("snaps");
  let dist = if k > c { k - c } else { c - k };
  if sb >= base && snaps.has(&sb.to_string()) && (k - sb) < dist {
    let sn = snaps.get_object(&sb.to_string());
    s.put_object("cur", copy_obj(&sn.get_object("s"))); s.put_boolean("shared", false);
    for q in sb..k { apply_entry(s, &tape.get_object((q - base) as usize), true); }
  } else if k < c { for q in (k..c).rev() { apply_entry(s, &tape.get_object((q - base) as usize), false); } }
  else { for q in c..k { apply_entry(s, &tape.get_object((q - base) as usize), true); } }
  s.put_int("cursor", k); s.put_boolean("live_ok", false);
  restore_aliases(s);
  fx
}
fn replay_fwd(s: &mut DataObject) {
  let (c, base) = (gi(s, "cursor"), gi(s, "base"));
  let e = s.get_array("tape").get_object((c - base) as usize);
  apply_g(&e, true);
  apply_entry(s, &e, true);
  s.put_int("cursor", c + 1); s.put_boolean("live_ok", false);
  restore_aliases(s);
}
// the tape from c on becomes a branch record; returns its id
fn fork(s: &mut DataObject, c: i64) -> i64 {
  let base = gi(s, "base");
  let tape = s.get_array("tape");
  let mut keep = DataArray::new(); let mut tail = DataArray::new(); let mut tsize = 0;
  for (i, e) in tape.objects().iter().enumerate() { let eo = e.object(); if (i as i64) + base < c { keep.push_object(eo); } else { tsize += gi(&eo, "size"); tail.push_object(eo); } }
  let mut snaps = s.get_object("snaps"); let mut tsn = DataObject::new();
  for (k, v) in snaps.objects() { if k.parse::<i64>().unwrap_or(0) > c { tsn.set_property(&k, v); } }
  for k in tsn.clone().keys() { snaps.remove_property(&k); }
  let id = gi(s, "next_branch"); s.put_int("next_branch", id + 1);
  let mut b = DataObject::new();
  b.put_int("id", id); b.put_int("at", c); b.put_int("steps", tail.len() as i64); b.put_int("size", tsize);
  if tail.len() > 0 {
    let f = tail.get_object(0); if is_o(&f, "took") { b.put_object("took", f.get_object("took")); } else { b.put_null("took"); }
    let l = tail.get_object(tail.len() - 1); b.put_object("end", go(&l, "v"));
  }
  b.put_array("tape", tail); b.put_object("snaps", tsn);
  let mut br = s.get_array("branches");
  br.push_object(b);
  while br.len() > MAX_BRANCHES { br.remove_property(0); }
  s.put_array("tape", keep); s.put_int("size", gi(s, "size") - tsize);
  id
}
// drop the oldest steps (whole 64-step blocks, never past the cursor) while the tape is over its cap
fn trim(s: &mut DataObject) {
  loop {
    let base = gi(s, "base"); let n = tape_len(s);
    if !(n - base > CAP_STEPS || gi(s, "size") > CAP_NODES) { break; }
    let nb = (base / SNAP_EVERY + 1) * SNAP_EVERY;
    let mut snaps = s.get_object("snaps");
    if nb > gi(s, "cursor") || nb > n || !snaps.has(&nb.to_string()) { break; }
    let tape = s.get_array("tape");
    let mut keep = DataArray::new(); let mut drop = 0;
    for (i, e) in tape.objects().iter().enumerate() { let eo = e.object(); if (i as i64) + base < nb { drop += gi(&eo, "size"); } else { keep.push_object(eo); } }
    for k in snaps.clone().keys() { if k.parse::<i64>().unwrap_or(0) < nb { snaps.remove_property(&k); } }
    s.put_array("tape", keep); s.put_int("size", gi(s, "size") - drop); s.put_int("base", nb);
    s.put_int("trimmed", gi(s, "trimmed") + (nb - base));
  }
}
fn call_core(core: &Command, args: DataObject) -> DataObject {
  match panic::catch_unwind(panic::AssertUnwindSafe(|| core.execute(args))) {
    Ok(Ok(r)) => { if r.has("a") && r.clone().keys().len() == 1 && r.get_property("a").is_object() { r.get_object("a") } else { r } }
    Ok(Err(e)) => err(&format!("the stepper failed: {:?}", e)),
    Err(p) => err(&format!("the stepper panicked: {}", panic_text(&p))),
  }
}
fn core_cmd() -> Result<Command, String> {
  match panic::catch_unwind(|| Command::lookup("dev", "flowstep", "step")) { Ok(c) => Ok(c), Err(p) => Err(format!("dev.flowstep.step not found: {}", panic_text(&p))) }
}
// execute one step from the cursor (which is the tape end) and record it
fn exec(s: &mut DataObject, core: &Command, pick: &DataObject, took: Option<DataObject>) -> Result<DataObject, String> {
  if !gb(s, "live_ok") { let live = unsnap(&s.get_object("cur"), &s.get_array("bodies")); s.put_object("live", live); s.put_boolean("live_ok", true); }
  let mut pn = s.get_array("pnames");
  let pre = capture(&pn);
  let mut pk = DataObject::new();
  if pick.has("kind") { pk.put_string("kind", &gs(pick, "kind")); pk.put_int("index", gi(pick, "index")); }
  let mut a = DataObject::new(); a.put_object("state", s.get_object("live")); a.put_object("pick", pk);
  let r = call_core(core, a);
  if gs(&r, "status") != "ok" { return Err(gs(&r, "msg")); }
  let ns = r.get_object("state");
  let ev = go(&r, "event");
  let et = gs(&ev, "type");
  if et == "enter" { if let Some(t) = top_of(&ns) { if is_o(&t, "body") { scan(&t.get_object("body"), &mut pn); } } }
  let grecord = gdiff(&pre, &pn);
  let g = ga(&grecord, "changes");
  let mut bodies = s.get_array("bodies"); let mut keys = s.get_array("bodykeys");
  let nc = snap(&ns, &mut bodies, &mut keys);
  let alias = aliases(&ns);
  let cur = s.get_object("cur");
  let mut ch = DataArray::new(); let mut size = 0i64; let mut path: Vec<P> = Vec::new();
  diff(&Data::DObject(cur.data_ref), &Data::DObject(nc.data_ref), &mut path, &mut ch, &mut size);
  size += nodes(&Data::DObject(grecord.data_ref));
  let h = hash_obj(&nc);
  let view = mkview(&r);
  let seq = gi(s, "cursor");
  // Events acquire their session tape ordinal here, at the session boundary (R3), not in the UI.
  if is_o(&view, "event") { view.get_object("event").put_int("seq", seq); }
  let mut e = DataObject::new();
  e.put_int("seq", seq);
  match &took { Some(t) => e.put_object("took", t.clone()), None => e.put_null("took") }
  e.put_boolean("user", pick.has("kind"));
  e.put_array("c", ch); e.put_array("g", g.clone());
  e.put_array("gbefore", ga(&grecord, "before_aliases")); e.put_array("gafter", ga(&grecord, "after_aliases"));
  size += alias_size(&alias); e.put_array("a", alias);
  e.put_object("v", view.clone()); e.put_string("h", &h);
  e.put_boolean("fx", et == "eval" && gs(&ev, "optype") == "command" && !gb(&ev, "from_frame"));
  e.put_boolean("persist", g.len() > 0);
  e.put_int("size", size);
  s.get_array("tape").push_object(e);
  s.put_int("size", gi(s, "size") + size);
  s.put_int("cursor", seq + 1);
  s.put_object("cur", nc.clone()); s.put_boolean("shared", true);
  s.put_object("live", ns); s.put_boolean("live_ok", true);
  if (seq + 1) % SNAP_EVERY == 0 {
    let mut sn = DataObject::new(); sn.put_object("s", nc); sn.put_object("v", view.clone()); sn.put_string("h", &h); sn.put_array("a", ga(&s.get_array("tape").get_object(s.get_array("tape").len() - 1), "a"));
    s.get_object("snaps").put_object(&(seq + 1).to_string(), sn);
  }
  trim(s);
  Ok(view)
}
// one step forward from the cursor: replay the tape while the requested item is the one it took, else fork and execute
fn advance(s: &mut DataObject, core: &Command, pick: &DataObject, force: bool, out: &mut DataObject) -> Result<DataObject, String> {
  let (c, base) = (gi(s, "cursor"), gi(s, "base"));
  let n = tape_len(s);
  let v = cur_view(s);
  let explicit = pick.has("kind");
  let req: Option<DataObject> = if explicit { Some(item(&gs(pick, "kind"), gi(pick, "index"))) } else if is_o(&v, "default") { Some(v.get_object("default")) } else { None };
  if c < n {
    let e = s.get_array("tape").get_object((c - base) as usize);
    let took = if is_o(&e, "took") { Some(e.get_object("took")) } else { None };
    let is_edit = match &took { Some(t) => gs(t, "kind") == "edit", None => false };
    if !force && ((is_edit && !explicit) || item_eq(&req, &took)) {
      replay_fwd(s);
      out.put_int("replayed", gi(out, "replayed") + 1);
      return Ok(cur_view(s));
    }
    if explicit && !in_ready(&v, req.as_ref().unwrap()) { return Err(format!("pick {}:{} is not ready", gs(pick, "kind"), gi(pick, "index"))); }
    let id = fork(s, c);
    out.put_boolean("forked", true); out.put_int("branch", id);
  } else if gb(&v, "ended") {
    return Err("the run has ended - go back (back/goto) or stop the session".to_string());
  }
  let r = exec(s, core, pick, req);
  if r.is_ok() { out.put_int("executed", gi(out, "executed") + 1); }
  r
}
// a breakpoint's place: frame = the exact path [[op, iter], ...], where an element [op, "*"] matches ANY
// iteration of that op (an editor breakpoint lives in a local's BODY, not in one iteration of it); cases =
// the frames' current cases from the root down (cases[i] must equal frames[i].case), which tells a local's
// body apart per parent case (a path names ops only). Absent = any.
fn frame_ok(b: &DataObject, at: &(DataArray, DataObject)) -> bool {
  let (path, cur) = (&at.0, &at.1);
  if is_a(b, "frame") {
    let f = b.get_array("frame");
    if f.len() != path.len() { return false; }
    for i in 0..f.len() {
      let (x, y) = (f.get_property(i), path.get_property(i));
      if !x.is_array() || !y.is_array() { return false; }
      let (x, y) = (x.array(), y.array());
      let op = |a: &DataArray| if a.len() > 0 && a.get_property(0).is_int() { Some(a.get_int(0)) } else { None };
      let it = |a: &DataArray| if a.len() > 1 && a.get_property(1).is_int() { Some(a.get_int(1)) } else { None };
      if op(&x).is_none() || op(&x) != op(&y) { return false; }
      let wild = x.len() > 1 && x.get_property(1).is_string() && x.get_string(1) == "*";
      if !wild && it(&x) != it(&y) { return false; }
    }
  }
  if is_a(b, "cases") {
    let (cs, fr) = (b.get_array("cases"), ga(cur, "frames"));
    for i in 0..cs.len() {
      if i >= fr.len() || !cs.get_property(i).is_int() || !fr.get_property(i).is_object() || gi(&fr.get_object(i), "case") != cs.get_int(i) { return false; }
    }
  }
  true
}
fn bp_before(s: &DataObject, v: &DataObject) -> Option<DataObject> {
  if !is_o(v, "default") { return None; }
  let d = v.get_object("default"); let cur = s.get_object("cur");
  let at = (match top_of(&cur) { Some(t) => ga(&t, "path"), None => DataArray::new() }, cur.clone());
  for b in ga(s, "bps").objects() {
    if !b.is_object() { continue; }
    let b = b.object(); let k = gs(&b, "kind");
    if (k == "op" || k == "wire" || k == "sync") && k == gs(&d, "kind") && gi(&b, "index") == gi(&d, "index") && frame_ok(&b, &at) && (!b.has("case") || gi(&b, "case") == top_case(&cur)) { return Some(b); }
  }
  None
}
fn bp_after(s: &DataObject, ev: &DataObject) -> Option<DataObject> {
  let t = gs(ev, "type"); let fp = (ga(ev, "frame"), s.get_object("cur"));
  for b in ga(s, "bps").objects() {
    if !b.is_object() { continue; }
    let b = b.object(); let k = gs(&b, "kind");
    if k == "case" && t == "seed" && gi(&b, "case") == gi(ev, "case") && frame_ok(&b, &fp) { return Some(b); }
    if k == "rule" && t == "eval" && ev.has("rule") && ev.get_property("rule").is_string()
      && (!b.has("rule") || gs(&b, "rule") == gs(ev, "rule")) && (!b.has("op") || gi(&b, "op") == gi(ev, "op"))
      && (!b.has("case") || gi(&b, "case") == gi(ev, "case")) && frame_ok(&b, &fp) { return Some(b); }
  }
  None
}
fn hits(v: &DataObject, cur: &DataObject, target: &DataObject) -> bool {
  if !is_o(v, "default") { return false; }
  let d = v.get_object("default");
  if !target.has("kind") || gs(&d, "kind") != gs(target, "kind") { return false; }
  if !target.has("index") || gi(&d, "index") != gi(target, "index") { return false; }
  if is_a(target, "frame") && target.get_array("frame").to_string() != top_path(cur) { return false; }
  if target.has("case") && target.get_property("case").is_int() && gi(target, "case") != top_case(cur) { return false; }
  true
}
// the stepping loop shared by into/over/out/run_to/reexecute and the continue thread (P2 drive's stop rules + breakpoints)
fn run_loop(s: &mut DataObject, core: &Command, mode: &str, pick: &DataObject, target: &DataObject, budget: i64) -> DataObject {
  let mut out = DataObject::new();
  out.put_int("replayed", 0); out.put_int("executed", 0); out.put_boolean("forked", false);
  let cur0 = s.get_object("cur");
  let (d0, ip0) = (depth_of(&cur0), top_inprog(&cur0));
  let mut steps = 0i64; let mut stopped = "budget".to_string(); let mut unit = 0;
  let mut events = DataArray::new();
  while steps < budget {
    if steps > 0 {
      if gb(s, "pause") { stopped = "paused".to_string(); break; }
      let v = cur_view(s);
      if let Some(b) = bp_before(s, &v) { stopped = "breakpoint".to_string(); out.put_object("hit", b); break; }
    }
    let pk = if steps == 0 { pick.clone() } else { DataObject::new() };
    let v = match advance(s, core, &pk, mode == "reexecute" && steps == 0, &mut out) {
      Ok(v) => v,
      Err(m) => { if steps == 0 { out.put_string("status", "err"); out.put_string("msg", &m); return out; } stopped = format!("refused: {}", m); break; }
    };
    steps += 1;
    let ev = go(&v, "event");
    if events.len() < MAX_EVENTS { events.push_object(ev.clone()); }
    if gb(&v, "ended") { stopped = "ended".to_string(); break; }
    let cur = s.get_object("cur");
    let (d, ip, stage) = (depth_of(&cur), top_inprog(&cur), top_stage(&cur));
    if steps == 1 && mode == "over" {
      let et = gs(&ev, "type");
      if d > d0 { unit = 1; } else if d == d0 && !ip0 && ip { unit = 2; } else if d == d0 && ip0 && et == "iter" { unit = 3; }
    }
    let ok = match mode {
      "into" | "reexecute" => true,
      "over" => match unit { 1 => d <= d0 && stage != "closing", 2 => d <= d0 && !ip, 3 => d <= d0 && (!ip || stage == "iter"), _ => true },
      "out" => if ip0 { d <= d0 && !ip } else if d0 > 1 { d < d0 && stage != "closing" } else { false },
      "run_to" => hits(&v, &cur, target),
      _ => false,
    };
    if ok { stopped = if mode == "run_to" { "reached".to_string() } else { "stepped".to_string() }; break; }
    if let Some(b) = bp_after(s, &ev) { stopped = "breakpoint".to_string(); out.put_object("hit", b); break; }
  }
  out.put_string("status", "ok"); out.put_string("stopped", &stopped); out.put_int("steps", steps);
  out.put_boolean("events_truncated", steps as usize > MAX_EVENTS);
  out.put_array("events", events);
  out
}
// the common response: where the cursor is and what the debugger shows there
fn respond(s: &DataObject, mut out: DataObject, full: bool) -> DataObject {
  let v = cur_view(s);
  let cur = s.get_object("cur");
  out.put_string("session", &gs(s, "id"));
  out.put_int("cursor", gi(s, "cursor")); out.put_int("base", gi(s, "base")); out.put_int("length", tape_len(s));
  out.set_property("event", v.get_property("event"));
  out.put_array("ready", ga(&v, "ready"));
  out.set_property("default", v.get_property("default"));
  out.put_boolean("ended", gb(&v, "ended"));
  out.put_int("depth", depth_of(&cur));
  out.put_boolean("running", gb(s, "running"));
  out.put_string("hash", &hash_obj(&cur));
  out.put_string("tape_hash", &tape_hash(s));
  out.put_int("branches", ga(s, "branches").len() as i64);
  if full {
    out.put_string("lib", &gs(s, "lib")); out.put_string("ctl", &gs(s, "ctl")); out.put_string("cmd", &gs(s, "cmd"));
    out.put_string("last_stop", &gs(s, "stopped"));
    if is_o(s, "last_run") { let mut lr = s.get_object("last_run").clone(); out.put_object("last_run", copy_obj(&lr)); lr = DataObject::new(); let _ = lr; }
    out.put_array("breakpoints", ga(s, "bps"));
    let mut bl = DataArray::new();
    for b in ga(s, "branches").objects() {
      let b = b.object(); let mut x = DataObject::new();
      x.put_int("id", gi(&b, "id")); x.put_int("at", gi(&b, "at")); x.put_int("steps", gi(&b, "steps"));
      x.set_property("took", if b.has("took") { b.get_property("took") } else { Data::DNull });
      let end = go(&b, "end"); x.set_property("end_event", if end.has("event") { end.get_property("event") } else { Data::DNull });
      bl.push_object(x);
    }
    out.put_array("branch_list", bl);
    let mut fxs = DataArray::new(); let base = gi(s, "base");
    for (i, e) in s.get_array("tape").objects().iter().enumerate() { if gb(&e.object(), "fx") { fxs.push_int(base + i as i64); } }
    out.put_array("side_effects", fxs);
    let pn = ga(s, "pnames"); out.put_array("persistent", pn.clone());
    let g = DataStore::globals(); let mut gv = DataObject::new();
    for i in 0..pn.len() { let k = pn.get_string(i); if g.has(&k) { let h = copy_val(&g.get_property(&k)); gv.set_property(&k, h.get_property("v")); } }
    out.put_object("globals", gv);
    out.put_int("tape_nodes", gi(s, "size")); out.put_int("trimmed", gi(s, "trimmed"));
    out.put_object("state", copy_obj(&cur));
  }
  out
}

// ================= dispatch =================
let all = sessions();
if mode == "init" {
  let mut body = go(&pick, "body");
  let args = go(&pick, "args");
  let id = format!("fsd{:x}{:04x}", now(), (std::process::id() as i64 + all.clone().keys().len() as i64 * 7919) & 0xffff);
  let mut s = DataObject::new();
  s.put_string("id", &id);
  for k in ["lib", "ctl", "cmd"] { s.put_string(k, &gs(&pick, k)); }
  s.put_int("created", now()); s.put_int("touched", now());
  let mut bodies = DataArray::new(); let mut keys = DataArray::new();
  let mut st = DataObject::new(); st.put_object("body", body.clone()); st.put_object("args", copy_obj(&args));
  let c = snap(&st, &mut bodies, &mut keys);
  let mut pn = DataArray::new(); scan(&body, &mut pn);
  let h = hash_obj(&c);
  let alias = aliases(&st);
  let mut v0 = DataObject::new(); v0.put_null("event"); v0.put_array("ready", DataArray::new()); v0.put_null("default"); v0.put_boolean("ended", false); v0.put_int("depth", 0);
  let mut sn = DataObject::new(); sn.put_object("s", c.clone()); sn.put_object("v", v0); sn.put_string("h", &h); sn.put_array("a", alias);
  let mut snaps = DataObject::new(); snaps.put_object("0", sn);
  s.put_array("bodies", bodies); s.put_array("bodykeys", keys);
  s.put_object("cur", c); s.put_boolean("shared", true);
  s.put_object("live", st); s.put_boolean("live_ok", true);
  s.put_int("cursor", 0); s.put_int("base", 0); s.put_int("size", 0); s.put_int("trimmed", 0);
  s.put_array("tape", DataArray::new()); s.put_object("snaps", snaps);
  s.put_array("pnames", pn); s.put_array("bps", DataArray::new());
  s.put_array("branches", DataArray::new()); s.put_int("next_branch", 0);
  s.put_boolean("running", false); s.put_boolean("pause", false); s.put_string("stopped", "");
  body = DataObject::new(); let _ = body;
  let mut all2 = all.clone(); all2.put_object(&id, s.clone());
  let mut o = DataObject::new(); o.put_string("status", "ok"); o.put_string("mode", "init");
  return respond(&s, o, false);
}
if !is_o(&all, &session) { return err(&format!("no debug session '{}' (stopped or reaped?)", session)); }
let mut s = all.get_object(&session);
s.put_int("touched", now());
if mode == "state" { let mut o = DataObject::new(); o.put_string("status", "ok"); o.put_string("mode", "state"); return respond(&s, o, true); }
if mode == "pause" {
  let was = gb(&s, "running");
  if was { s.put_boolean("pause", true); }
  let mut o = DataObject::new(); o.put_string("status", "ok"); o.put_string("mode", "pause"); o.put_boolean("was_running", was);
  return respond(&s, o, false);
}
if gb(&s, "running") { let mut o = err("a continue is running - pause it first (mode pause)"); o.put_string("session", &session); return o; }
let mut out = DataObject::new();
match mode.as_str() {
  "back" | "goto" => {
    let (c, base, n) = (gi(&s, "cursor"), gi(&s, "base"), tape_len(&s));
    let k = if mode == "back" { c - if gi(&pick, "count") > 0 { gi(&pick, "count") } else { 1 } } else { if pick.has("seq") && pick.get_property("seq").is_int() { gi(&pick, "seq") } else { return err("goto needs pick {seq}"); } };
    if k < base { return err(&format!("seq {} is before the start of the tape ({}{})", k, base, if base > 0 { ", older steps were trimmed" } else { "" })); }
    if k > n { return err(&format!("seq {} is past the end of the tape ({})", k, n)); }
    let fx = goto(&mut s, k);
    out.put_string("status", "ok"); out.put_string("mode", &mode); out.put_int("from", c);
    out.put_array("crossed_side_effects", fx);
  }
  "edit" => {
    // edit a VALUE (frames.<i>.inputs|results|out|args...) at the cursor: forks, and is itself a tape step (undoable)
    let p = ga(&pick, "path");
    if p.len() < 3 || !p.get_property(0).is_string() || p.get_string(0) != "frames" || !p.get_property(2).is_string() || !["inputs", "results", "out", "args"].contains(&p.get_string(2).as_str()) {
      return err("edit needs pick {path: [\"frames\", i, \"inputs\"|\"results\"|\"out\"|\"args\", ...], value}");
    }
    if !pick.has("value") { return err("edit needs pick.value"); }
    let (c, n) = (gi(&s, "cursor"), tape_len(&s));
    let v = cur_view(&s);
    if gb(&v, "ended") { return err("the run has ended - go back first"); }
    if c < n { let id = fork(&mut s, c); out.put_boolean("forked", true); out.put_int("branch", id); }
    restore_aliases(&mut s);
    unshare(&mut s);
    let old_aliases = cursor_aliases(&s);
    let cur = s.get_object("cur");
    // resolve the old value (the container must exist)
    let mut d = Data::DObject(cur.data_ref);
    for j in 0..p.len() - 1 {
      let e = p.get_property(j);
      let ok = if e.is_int() { d.is_array() && (e.int() as usize) < d.array().len() } else { d.is_object() && d.object().has(&e.string()) };
      if !ok { return err("edit path does not exist in the state"); }
      d = if e.is_int() { d.array().get_property(e.int() as usize) } else { d.object().get_property(&e.string()) };
    }
    let last = p.get_property(p.len() - 1);
    let old: Option<Data> = if last.is_int() { if d.is_array() && (last.int() as usize) < d.array().len() { Some(d.array().get_property(last.int() as usize)) } else { None } } else if d.is_object() && d.object().has(&last.string()) { Some(d.object().get_property(&last.string())) } else { None };
    let mut ch = DataObject::new(); ch.put_array("p", p.clone());
    if let Some(o) = old { let h = copy_val(&o); ch.set_property("o", h.get_property("v")); }
    let hv = copy_val(&pick.get_property("value")); ch.set_property("n", hv.get_property("v"));
    apply(&cur, &ch, true);
    // An edit replaces one path: other aliases of the old value stay linked, but the edited path
    // deliberately detaches (the normal assignment semantics of the editor's value edit).
    let next_aliases = aliases_after_edit(&old_aliases, &p);
    let cur = s.get_object("cur");
    link_aliases(&cur, &next_aliases);
    let mut cl = DataArray::new(); cl.push_object(ch);
    let mut ev = DataObject::new(); ev.put_string("type", "edit"); ev.put_int("seq", c); ev.put_array("path", p.clone()); let hv2 = copy_val(&pick.get_property("value")); ev.set_property("value", hv2.get_property("v"));
    let mut view = copy_obj(&v); view.put_object("event", ev);
    let h = hash_obj(&cur);
    let mut e = DataObject::new();
    e.put_int("seq", c); e.put_object("took", item("edit", 0)); e.put_boolean("user", true);
    e.put_array("c", cl); e.put_array("g", DataArray::new()); e.put_array("a", next_aliases.clone()); e.put_object("v", view.clone()); e.put_string("h", &h);
    e.put_boolean("fx", false); e.put_boolean("persist", false); e.put_int("size", 4 + alias_size(&next_aliases));
    s.get_array("tape").push_object(e);
    s.put_int("cursor", c + 1); s.put_boolean("live_ok", false);
    if (c + 1) % SNAP_EVERY == 0 { let mut sn = DataObject::new(); sn.put_object("s", copy_obj(&cur)); sn.put_object("v", view); sn.put_string("h", &h); sn.put_array("a", next_aliases); s.get_object("snaps").put_object(&(c + 1).to_string(), sn); }
    out.put_string("status", "ok"); out.put_string("mode", "edit");
  }
  "branch" => {
    // swap the tape tail with a recorded branch; the cursor must be at that branch's fork point
    let id = gi(&pick, "id");
    let mut br = s.get_array("branches");
    let mut at: Option<usize> = None;
    for i in 0..br.len() { if gi(&br.get_object(i), "id") == id { at = Some(i); } }
    let i = match at { Some(i) => i, None => return err(&format!("no branch {}", id)) };
    let b = br.get_object(i);
    if gi(&s, "cursor") != gi(&b, "at") { return err(&format!("goto {} (the branch's fork point) first", gi(&b, "at"))); }
    br.remove_property(i);
    let c = gi(&s, "cursor");
    let newid = if tape_len(&s) > c { fork(&mut s, c) } else { -1 };
    let mut tape = s.get_array("tape");
    for e in ga(&b, "tape").objects() { tape.push_property(e); }
    let mut snaps = s.get_object("snaps");
    for (k, v) in go(&b, "snaps").objects() { snaps.set_property(&k, v); }
    s.put_int("size", gi(&s, "size") + gi(&b, "size"));
    out.put_string("status", "ok"); out.put_string("mode", "branch"); out.put_int("restored", id); out.put_int("saved_as", newid);
  }
  "into" | "over" | "out" | "run_to" | "reexecute" => {
    let core = match core_cmd() { Ok(c) => c, Err(m) => return err(&m) };
    let budget = if gi(&pick, "budget") > 0 { gi(&pick, "budget") } else { DEFAULT_BUDGET };
    let target = go(&pick, "target");
    if mode == "run_to" && !(target.has("kind") && target.has("index")) { return err("run_to needs pick.target {kind: wire|sync|op, index} (frame and case optional)"); }
    let mut pk = DataObject::new();
    if pick.has("kind") { pk.put_string("kind", &gs(&pick, "kind")); pk.put_int("index", gi(&pick, "index")); }
    out = run_loop(&mut s, &core, &mode, &pk, &target, budget);
    if gs(&out, "status") != "ok" { out.put_string("session", &session); return out; }
    out.put_string("mode", &mode);
  }
  "continue" => {
    let budget = if gi(&pick, "budget") > 0 { gi(&pick, "budget") } else { DEFAULT_BUDGET };
    let mut pk = DataObject::new();
    if pick.has("kind") { pk.put_string("kind", &gs(&pick, "kind")); pk.put_int("index", gi(&pick, "index")); }
    if gb(&cur_view(&s), "ended") && gi(&s, "cursor") == tape_len(&s) { return err("the run has ended - go back (back/goto) or stop the session"); }
    s.put_boolean("running", true); s.put_boolean("pause", false); s.put_string("stopped", "running");
    let mut s2 = s.clone();
    let h = std::thread::spawn(move || {
      let res = match core_cmd() {
        Err(m) => err(&m),
        Ok(core) => {
          let mut s3 = s2.clone();
          match panic::catch_unwind(panic::AssertUnwindSafe(move || run_loop(&mut s3, &core, "continue", &pk, &DataObject::new(), budget))) {
            Ok(o) => o,
            Err(p) => err(&format!("continue panicked: {}", panic_text(&p))),
          }
        }
      };
      let stop = if gs(&res, "status") == "ok" { gs(&res, "stopped") } else { format!("error: {}", gs(&res, "msg")) };
      s2.put_string("stopped", &stop);
      s2.put_object("last_run", res);
      s2.put_int("touched", now());
      s2.put_boolean("pause", false);
      s2.put_boolean("running", false);
    });
    out.put_string("status", "ok"); out.put_string("mode", "continue");
    if gb(&pick, "wait") {
      let _ = h.join();
      out.put_boolean("waited", true);
      let lr = go(&s, "last_run");
      for k in ["stopped", "steps", "replayed", "executed", "forked", "hit", "events", "events_truncated"] { if lr.has(k) { out.set_property(k, lr.get_property(k)); } }
      if gs(&lr, "status") != "ok" { out.put_string("status", "err"); out.put_string("msg", &gs(&lr, "msg")); }
    } else { out.put_boolean("waited", false); }
  }
  _ => return err(&format!("mode '{}' is not one of into, over, out, run_to, continue, reexecute, back, goto, edit, branch, pause, state", mode)),
}
s.put_int("touched", now());
respond(&s, out, false)