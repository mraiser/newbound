use ndata::dataobject::DataObject;
use std::path::Path;
use ndata::dataarray::DataArray;
use flowlang::flowlang::system::system_call::system_call;
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
        update(arg_0)
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

pub fn update(lib: String) -> String {
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
}
