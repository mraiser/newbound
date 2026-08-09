let repodir = Path::new("repositories").join(&lib);
if !repodir.exists() { return "ERROR: No imported repository named ".to_string()+&lib+" (see dev.github.list)"; }

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

let r = rebuild_lib(lib.to_owned());
if r != "OK" { return r; }

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