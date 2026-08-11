use ndata::dataobject::DataObject;
use std::path::Path;
use flowlang::datastore::DataStore;
use flowlang::buildrust::build_all;
use flowlang::buildrust::rebuild_rust_api;
use crate::dev::dev::rebuild_lib::rebuild_lib;
use crate::dev::dev::compile::build_compile_command;
use crate::dev::dev::compile::execute_compile_command;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib"] {
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
        let arg_0: String = o.get_string("lib");
        activate_lib(arg_0)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
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

pub fn activate_lib(lib: String) -> String {
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
  let mut s = s;
  let mut mended = false;
  if !s.contains("serde_support") {
    s = s.replace("[features]", "[features]\nserde_support = [\"serde\", \"serde_json\", \"flowlang/serde_support\", \"ndata/serde_support\"]\npython_runtime = [\"flowlang/python_runtime\"]\njavascript_runtime = [\"flowlang/javascript_runtime\"]");
    mended = true;
  }
  // The [workspace] opt-out is load-bearing on its own: a git-imported crate
  // really lives at repositories/<lib>/<root>, which the workspace exclude
  // (written by symlink name) never matches once cargo canonicalizes paths.
  if !s.contains("[workspace]") {
    s.push_str("\n# Self-contained: not a member of the host checkout's cargo workspace\n[workspace]\n");
    mended = true;
  }
  if mended {
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
}
