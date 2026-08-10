let store = DataStore::new();
let meta_path = store.root.join(&lib).join("meta.json");
let mut ffi = false;
let mut root = lib.to_owned();
if let Ok(s) = std::fs::read_to_string(&meta_path) {
  let meta = DataObject::from_string(&s);
  if meta.has("root") { root = meta.get_string("root"); }
  if meta.has("cargo") {
    let cargo = meta.get_object("cargo");
    if cargo.has("ffi") && cargo.get_boolean("ffi") { ffi = true; }
  }
}

if !ffi {
  // static or rootless library: the existing rebuild path is the whole story
  return rebuild_lib(lib);
}

// FFI library: teach the initializer and the watcher about the crate
// (build_all also writes the workspace exclude), regenerate the typed api.
build_all();
rebuild_rust_api();

// The builder's default crate manifest omits the feature wiring the host's
// feature flags require; a git-imported repo ships a tracked manifest that
// already has it, but a peer-streamed install gets the default. Mend it in
// place - idempotent, keyed on the missing feature name.
let manifest = Path::new(&root).join("Cargo.toml");
if let Ok(s) = std::fs::read_to_string(&manifest) {
  if !s.contains("serde_support") {
    let s = s.replace("[features]", "[features]\nserde_support = [\"serde\", \"serde_json\", \"flowlang/serde_support\", \"ndata/serde_support\"]\npython_runtime = [\"flowlang/python_runtime\"]\njavascript_runtime = [\"flowlang/javascript_runtime\"]");
    let s = if s.contains("[workspace]") { s } else { s + "\n# Self-contained: not a member of the host checkout's cargo workspace\n[workspace]\n" };
    let _x = std::fs::write(&manifest, &s);
  }
}

// Build the crate unconditionally (rebuild_lib would skip when generated
// src already matches the store), then the host so a restart loads it.
let ja = build_compile_command();
let (bad, err) = execute_compile_command(ja, root.to_owned());
if bad { return "ERROR: crate build failed: ".to_string()+&err; }

let ja = build_compile_command();
let (bad, err) = execute_compile_command(ja, ".".to_string());
if bad { return "ERROR: host rebuild failed: ".to_string()+&err; }

"RESTART: ".to_string()+&lib+" roots a hot-reload crate - restart Newbound once to activate it"