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

// Restore first: a library pushed here from a peer (dev.git.overlay) is
// discarded - its files go back to the checked-out commit - before the pull.
// This is the "switch the test peer back to git" step.
let ov = crate::dev::git::overlay::overlay("restore".to_string(), repodir.to_string_lossy().to_string(), String::new(), DataObject::new());
if ov.try_get_string("status").unwrap_or_default() != "ok" {
  return "ERROR: could not discard the push from a peer: ".to_string()+&ov.try_get_string("msg").unwrap_or_default()+" - nothing pulled";
}
let restored = ov.try_get_array("restored").unwrap_or_else(|_| DataArray::new());
let mut ovlines: Vec<String> = Vec::new();
if let Ok(a) = ov.try_get_array("steps") {
  for s in a.objects() { if let ndata::data::Data::DString(x) = s { ovlines.push(x); } }
}
// forced re-install of the restored libraries; `built` = libraries the install step already rebuilt
let reinstall = |built: &Vec<String>, lines: &mut Vec<String>| -> bool {
  let mut restart = false;
  for r in restored.objects() {
    let r = r.object();
    let l = r.get_string("lib");
    let mut e = DataObject::new();
    e.put_array("removed", r.try_get_array("removed").unwrap_or_else(|_| DataArray::new()));
    e.put_boolean("rust", r.try_get_boolean("rust").unwrap_or(false));
    e.put_boolean("activate", !built.contains(&l));
    let i = crate::dev::git::overlay::overlay("install".to_string(), String::new(), l, e);
    if i.try_get_boolean("restart").unwrap_or(false) { restart = true; }
    if let Ok(a) = i.try_get_array("steps") {
      for s in a.objects() { if let ndata::data::Data::DString(x) = s { lines.push(x); } }
    }
  }
  restart
};

let mut a = DataArray::new();
a.push_string("git");
a.push_string("-C");
a.push_string(&repodir.to_owned().into_os_string().into_string().unwrap());
a.push_string("pull");
a.push_string("--ff-only");
let res = system_call(a);
let out = res.get_string("out") + &res.get_string("err");

let moved = out.contains("Updating") || out.contains("Fast-forward");
if !moved {
  // nothing pulled (already current, no upstream, or refused): the restored
  // libraries still have to be put back in line with the checkout
  if restored.len() > 0 {
    let restart = reinstall(&Vec::new(), &mut ovlines);
    let failed = ovlines.iter().any(|l| l.contains("FAILED"));
    let current = out.contains("Already up to date");
    return format!("{}: {} restored to the checked-out commit{}.{}\n{}\n{}", if failed || !current { "ERROR" } else { "OK" }, lib,
      if current { "; already up to date" } else { ", but git pull did not fast-forward" },
      if restart { " Restart Newbound to load the changed Rust." } else { "" }, ovlines.join("\n"), out);
  }
}
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
  let mut lines: Vec<String> = ovlines.clone();
  if let Ok(a) = ins.try_get_array("steps") {
    for s in a.objects() { if let ndata::data::Data::DString(x) = s { lines.push(x); } }
  }
  let mut restart = ins.try_get_boolean("restart").unwrap_or(false);
  // libraries restored from a peer push: re-install them even where the pull did not touch them
  let mut built: Vec<String> = Vec::new();
  if let Ok(a) = ins.try_get_array("libs") {
    for l in a.objects() { let l = l.object(); if l.has("activate") { built.push(l.try_get_string("lib").unwrap_or_default()); } }
  }
  if reinstall(&built, &mut lines) { restart = true; }
  let failed = lines.iter().any(|l| l.contains("FAILED"));
  return format!("{}: {} updated.{}\n{}\n{}", if failed { "ERROR" } else { "OK" }, lib,
    if restart { " Restart Newbound to load the changed Rust." } else { "" }, lines.join("\n"), out);
}

// Unregistered repo: the old path, plus a whole-bundle app refresh.
{
  let mut l: Vec<String> = Vec::new();
  let _ = reinstall(&Vec::new(), &mut l);
}
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