use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::flowlang::system::system_call::system_call;
use flowlang::flowlang::system::unique_session_id::unique_session_id;
use std::path::Path;
use std::os::unix::fs::symlink;
use crate::dev::dev::rebuild_lib::rebuild_lib;
use flowlang::appserver::load_library;
use flowlang::buildrust::build_all;
use flowlang::buildrust::rebuild_rust_api;
use crate::dev::dev::compile::build_compile_command;
use crate::dev::dev::compile::execute_compile_command;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["url"] {
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
        let arg_0: String = o.get_string("url");
        import(arg_0)
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

pub fn import(url: String) -> String {
// FIXME - assumes Newbound folder is in working directory

let repodirx = Path::new("repositories");
if !repodirx.exists() { let _x = std::fs::create_dir_all(repodirx); }
let tempdir = repodirx.join(unique_session_id());

let mut a = DataArray::new();
a.push_string("git");
a.push_string("clone");
a.push_string(&url);
a.push_string(&tempdir.clone().into_os_string().into_string().unwrap());
system_call(a);

if !tempdir.exists() { return "ERROR: Unable to clone git repository at ".to_string()+&url; }

let datadirxx = tempdir.join("data");
let runtimedirxx = tempdir.join("runtime");
for datadirx in std::fs::read_dir(&datadirxx).unwrap() {
  let datadirx = datadirx.unwrap();
  let libid = datadirx.file_name().into_string().unwrap();
  let runtimedirx = runtimedirxx.join(libid.clone());
  if runtimedirx.exists() {
    let repodir = repodirx.join(libid.clone());
    let datadir = Path::new("data").join(libid.clone());
    let runtimedir = Path::new("runtime").join(libid.clone());
    if repodir.exists() || datadir.exists() || runtimedir.exists() { 
      let _x = std::fs::remove_dir_all(tempdir);
      return "ERROR: There is already a Library named ".to_string()+&libid; 
    }
    else {
      let _x = std::fs::rename(tempdir.clone(), repodir.clone());
      let _x = symlink(repodir.join("data").join(libid.clone()).canonicalize().unwrap(), datadir);
      let _x = symlink(repodir.join("runtime").join(libid.clone()).canonicalize().unwrap(), runtimedir);
      
      load_library(&libid);

      // An FFI library roots its own hot-reload crate. Link the repo's
      // tracked crate dir (its Cargo.toml carries the feature wiring the
      // builder's default lacks) and teach the initializer about the new
      // crate - that regeneration is what the one restart activates.
      let mut ffi_root = "".to_string();
      let meta_path = repodir.join("data").join(libid.clone()).join("meta.json");
      if let Ok(s) = std::fs::read_to_string(&meta_path) {
        let meta = DataObject::from_string(&s);
        if meta.has("cargo") {
          let cargo = meta.get_object("cargo");
          if cargo.has("ffi") && cargo.get_boolean("ffi") {
            let root = if meta.has("root") { meta.get_string("root") } else { libid.to_owned() };
            let cratesrc = repodir.join(&root);
            let cratedst = Path::new(&root).to_path_buf();
            if cratesrc.exists() && !cratedst.exists() {
              let _x = symlink(cratesrc.canonicalize().unwrap(), cratedst);
            }
            build_all();
            rebuild_rust_api();
            ffi_root = root;
          }
        }
      }

      let _x = rebuild_lib(libid.to_owned());
      println!("UPDATED LIBRARY {:?}", libid);      
      
      if ffi_root != "" {
        // Build the crate dylib unconditionally: rebuild_lib skips the build
        // when the repo's tracked generated src already matches the store,
        // which on a fresh install means no artifact was ever built.
        let ja = build_compile_command();
        let (bad, err) = execute_compile_command(ja, ffi_root.to_owned());
        if bad { return "ERROR: crate build failed: ".to_string()+&err; }

        // Rebuild the host so the next start loads the new crate.
        let ja = build_compile_command();
        let (bad, err) = execute_compile_command(ja, ".".to_string());
        if bad { return "ERROR: host rebuild failed: ".to_string()+&err; }
        return "OK: ".to_string()+&libid+" - restart Newbound once to activate the new hot-reload crate";
      }

      return "OK: ".to_string()+&libid;
    }
  }
}
"ERROR: No Newbound Library found".to_string()
}
