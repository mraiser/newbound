use ndata::dataobject::DataObject;
use std::path::Path;
use flowlang::appserver::load_config;
use flowlang::appserver::save_config;
use flowlang::appserver::init_globals;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "delete_repository"] {
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
        let arg_1: bool = o.get_boolean("delete_repository");
        remove(arg_0, arg_1)
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

pub fn remove(lib: String, delete_repository: bool) -> String {
let repodir = Path::new("repositories").join(&lib);
if !repodir.exists() { return "ERROR: No imported repository named ".to_string()+&lib+" (see dev.github.list)"; }

let mut msg = "".to_string();

// deactivate the app if config.properties lists it
let mut config = load_config();
let apps = config.get_string("apps");
let filtered: Vec<&str> = apps.split(",").map(|a| a.trim()).filter(|a| *a != lib && *a != "").collect();
let filtered = filtered.join(",");
if filtered != apps {
  config.put_string("apps", &filtered);
  save_config(config.clone());
  msg += "deactivated app; ";
}

// unlink the store and runtime symlinks - never touch a real directory
for dir in ["data", "runtime"] {
  let p = Path::new(dir).join(&lib);
  if let Ok(md) = std::fs::symlink_metadata(&p) {
    if md.file_type().is_symlink() {
      let _x = std::fs::remove_file(&p);
      msg = msg + "unlinked " + dir + "/" + &lib + "; ";
    }
    else {
      return "ERROR: ".to_string()+dir+"/"+&lib+" is not a symlink, so this library was not installed by dev.github.import - refusing to remove it";
    }
  }
}

// unlink the FFI crate dir if import linked one
if let Ok(s) = std::fs::read_to_string(repodir.join("data").join(&lib).join("meta.json")) {
  let meta = DataObject::from_string(&s);
  let root = if meta.has("root") { meta.get_string("root") } else { lib.to_owned() };
  if root != "newbound_core" && root != "." && root != "" {
    let p = Path::new(&root).to_path_buf();
    if let Ok(md) = std::fs::symlink_metadata(&p) {
      if md.file_type().is_symlink() {
        let _x = std::fs::remove_file(&p);
        msg = msg + "unlinked crate " + &root + "/; ";
      }
    }
  }
}

if delete_repository {
  let _x = std::fs::remove_dir_all(&repodir);
  msg = msg + "DELETED repositories/" + &lib + " including any local runtime state (keys, networks) that lived under it; ";
}
else {
  msg = msg + "kept repositories/" + &lib + " - local runtime state such as keys stays there until you delete it yourself; ";
}

init_globals();

"OK: ".to_string()+&msg+"restart Newbound to unload the library's compiled commands"
}
