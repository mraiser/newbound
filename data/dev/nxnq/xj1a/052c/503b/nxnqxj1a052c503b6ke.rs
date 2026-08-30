let store = DataStore::new();
let base = store.root.canonicalize().unwrap();
let base = base.parent().unwrap().to_path_buf();
let rundir = base.join("runtime").join("dev").join("update_crates");

let mut out = DataObject::new();
out.put_string("status", "ok");

let status_path = rundir.join("status.json");
if !status_path.exists() {
  out.put_string("state", "none");
  out.put_string("msg", "no crate update has been run on this instance");
  return out;
}

let mut state = String::from("unknown");
let mut verdict = String::new();
match fs::read_to_string(&status_path) {
  Ok(s) => {
    match DataObject::try_from_string(&s) {
      Ok(o) => {
        state = if o.has("state") { o.get_string("state") } else { "unknown".to_string() };
        verdict = if o.has("verdict") { o.get_string("verdict") } else { String::new() };
        let pid = if o.has("pid") { o.get_int("pid") } else { 0 };
        // A runner that died without writing a failure (OOM, kill -9) must not
        // report "running" forever: the pid is the truth.
        if state == "running" && pid > 0 && !std::path::Path::new(&format!("/proc/{}", pid)).exists() {
          state = "stalled".to_string();
        }
        out.put_int("step", if o.has("step") { o.get_int("step") } else { 0 });
        // hard_reset runs share this status file; it stamps its own step count
        // and kind so pollers can label the run without knowing who launched it
        if o.has("steps") { out.put_int("steps", o.get_int("steps")); }
        if o.has("kind") { out.put_string("kind", &o.get_string("kind")); }
        out.put_string("label", &(if o.has("label") { o.get_string("label") } else { String::new() }));
        out.put_int("pid", pid);
        out.put_int("time", if o.has("time") { o.get_int("time") } else { 0 });
      },
      Err(_) => {
        // mid-rename read; report transient rather than lying
        state = "running".to_string();
        out.put_string("label", "status file mid-write");
      }
    }
  },
  Err(e) => {
    out.put_string("label", &format!("cannot read status: {}", e));
  }
}
out.put_string("state", &state);
out.put_string("verdict", &verdict);

// The hot-reload gate: cleared ONLY on a clean no-restart finish. A restart
// verdict keeps it set until the restart clears it inherently (in-memory);
// a failed/stalled run keeps it set because step 3 may have built new-ABI
// dylibs that must not load into this host.
let mut paused = false;
let mut g = DataStore::globals();
if g.has("system") {
  let mut sys = g.get_object("system");
  if sys.has("hotswap_paused") { paused = sys.get_boolean("hotswap_paused"); }
  if paused && state == "done" && verdict == "no-restart" {
    sys.put_boolean("hotswap_paused", false);
    paused = false;
  }
}
out.put_boolean("hotswap_paused", paused);

let log = fs::read_to_string(rundir.join("run.log")).unwrap_or_default();
let chars: Vec<char> = log.chars().collect();
let start = chars.len().saturating_sub(4000);
out.put_string("log_tail", &chars[start..].iter().collect::<String>());
out