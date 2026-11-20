let repodir = Path::new("repositories").join(&lib);
if !repodir.exists() { return "ERROR: No imported repository named ".to_string()+&lib+" (see dev.github.list)"; }

// where the tree is before the pull - the install step diffs against it
let old_head = {
  let mut h = DataArray::new();
  h.push_string("git");
  h.push_string("-C");
  h.push_string(&repodir.to_owned().into_os_string().into_string().unwrap());
  h.push_string("rev-parse");
  h.push_string("HEAD");
  system_call(h).get_string("out").trim().to_string()
};

let mut a = DataArray::new();
a.push_string("git");
a.push_string("-C");
a.push_string(&repodir.to_owned().into_os_string().into_string().unwrap());
a.push_string("pull");
a.push_string("--ff-only");
let res = system_call(a);
let out = res.get_string("out") + &res.get_string("err");

if out.contains("Already up to date") {
  return "OK: ".to_string()+&lib+" is already up to date";
}
if !out.contains("Updating") && !out.contains("Fast-forward") {
  return "ERROR: git pull did not fast-forward:\n".to_string()+&out;
}

// A registered repo gets the shared install step (dev.git.after_update):
// it diffs old..new HEAD, refreshes the apps each changed library ships
// (runtime/<app> replaced from _APPS, botd.properties kept, new apps copied
// in inactive) and rebuilds every library in the repo whose store changed.
let mut regname = String::new();
if let Ok(want) = repodir.canonicalize() {
  let reg = crate::dev::git::repos::repos();
  if let Ok(repos) = reg.try_get_object("repos") {
    for k in repos.clone().keys() {
      if let Ok(e) = repos.try_get_object(&k) {
        let p = e.try_get_string("path").unwrap_or_default();
        if Path::new(&p).canonicalize().map(|c| c == want).unwrap_or(false) { regname = k; break; }
      }
    }
  }
}
if !regname.is_empty() && !old_head.is_empty() {
  let ins = crate::dev::git::after_update::after_update(regname, old_head, String::new());
  if ins.try_get_string("status").unwrap_or_default() != "ok" {
    return "ERROR: pulled, but the install step failed: ".to_string()+&ins.try_get_string("msg").unwrap_or_default();
  }
  let mut lines: Vec<String> = Vec::new();
  if let Ok(a) = ins.try_get_array("steps") {
    for s in a.objects() { if let ndata::data::Data::DString(x) = s { lines.push(x); } }
  }
  let failed = lines.iter().any(|l| l.contains("FAILED"));
  let restart = ins.try_get_boolean("restart").unwrap_or(false);
  return format!("{}: {} updated.{}\n{}\n{}", if failed { "ERROR" } else { "OK" }, lib,
    if restart { " Restart Newbound to load the changed Rust." } else { "" }, lines.join("\n"), out);
}

// Unregistered repo: the old path, plus a whole-bundle app refresh.
let r = rebuild_lib(lib.to_owned());
if r != "OK" { return r; }
let lid = lib.to_owned();
let _ = std::panic::catch_unwind(move || crate::dev::dev::refresh_apps::refresh_apps(lid, DataArray::new(), DataArray::new()));

// For an FFI library, build the crate unconditionally: rebuild_lib skips
// the build when the pulled tracked src already matches the pulled store,
// and the hot-reload watcher only fires on a fresh artifact.
if let Ok(s) = std::fs::read_to_string(repodir.join("data").join(&lib).join("meta.json")) {
  let meta = DataObject::from_string(&s);
  if meta.has("cargo") {
    let cargo = meta.get_object("cargo");
    if cargo.has("ffi") && cargo.get_boolean("ffi") {
      let root = if meta.has("root") { meta.get_string("root") } else { lib.to_owned() };
      let ja = build_compile_command();
      let (bad, err) = execute_compile_command(ja, root);
      if bad { return "ERROR: crate build failed: ".to_string()+&err; }
    }
  }
}

"OK: ".to_string()+&lib+" updated. Store changes are live now; updated Rust hot-reloads on an FFI library (a static library needs a restart).\n"+&out