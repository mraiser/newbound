use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::flowlang::system::system_call::system_call;
use flowlang::flowlang::system::unique_session_id::unique_session_id;
use std::path::Path;
use std::os::unix::fs::symlink;
use crate::dev::dev::activate_lib::activate_lib;
use flowlang::appserver::load_library;

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
// The bare `exec` path does not initialize globals, and load_library needs
// them; init_globals is safe to rerun (same posture as dev.dev.install_lib).
flowlang::appserver::init_globals();

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

// A library repo carries data/<lib> at its root; runtime/<lib> is OPTIONAL
// (app html/properties - many libraries have none). One repo may carry
// SEVERAL libraries (newbound-agent: agent + kb + scratch), so collect them
// all, check every collision BEFORE moving anything, then install each.
let datadirxx = tempdir.join("data");
if !datadirxx.exists() {
    let _x = std::fs::remove_dir_all(&tempdir);
    return "ERROR: No Newbound Library found (repo has no data/ directory)".to_string();
}
let mut libids: Vec<String> = Vec::new();
for d in std::fs::read_dir(&datadirxx).unwrap() {
    let d = d.unwrap();
    if d.path().is_dir() { libids.push(d.file_name().into_string().unwrap()); }
}
libids.sort();
if libids.is_empty() {
    let _x = std::fs::remove_dir_all(&tempdir);
    return "ERROR: No Newbound Library found (data/ is empty)".to_string();
}

// The repo's name on disk: the URL basename (stripped of .git), falling
// back to the first library - for the common one-lib repo the two agree,
// which keeps the historical repositories/<lib> layout.
let mut reponame = url.trim().trim_end_matches('/').rsplit('/').next().unwrap_or("").trim_end_matches(".git").trim().to_string();
if reponame.is_empty() { reponame = libids[0].clone(); }
let repodir = repodirx.join(&reponame);
if repodir.exists() {
    let _x = std::fs::remove_dir_all(&tempdir);
    return "ERROR: There is already a repository named ".to_string()+&reponame;
}
for libid in &libids {
    let datadir = Path::new("data").join(libid);
    let runtimedir = Path::new("runtime").join(libid);
    if datadir.exists() || runtimedir.exists() {
        let _x = std::fs::remove_dir_all(&tempdir);
        return "ERROR: There is already a Library named ".to_string()+libid;
    }
}

let _x = std::fs::rename(tempdir.clone(), repodir.clone());

// Register in the dev.git registry (role library, autocommit on) so the
// memory-hygiene shipped test, the git_state sensor, and the autocommit
// sweeper all see it from the first moment. Registration failure is not
// fatal to the install - dev.code.init re-registers at next boot.
let _r = crate::dev::git::set_repo::set_repo(
    reponame.clone(),
    repodir.to_string_lossy().to_string(),
    url.trim().to_string(),
    "library".to_string(), true,
    "system".to_string(), String::new());

let mut oks: Vec<String> = Vec::new();
let mut errs: Vec<String> = Vec::new();
let mut restart = false;
for libid in &libids {
    let datadir = Path::new("data").join(libid);
    let runtimedir = Path::new("runtime").join(libid);
    let _x = symlink(repodir.join("data").join(libid).canonicalize().unwrap(), &datadir);
    let rsrc = repodir.join("runtime").join(libid);
    if rsrc.exists() {
        let _x = symlink(rsrc.canonicalize().unwrap(), &runtimedir);
    }

    load_library(libid);

    // For an FFI library the repo may carry its tracked crate dir
    // (reviewable src, manifest with the feature wiring) - link it
    // before activation so the build uses it.
    let meta_path = repodir.join("data").join(libid).join("meta.json");
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
            }
        }
    }

    // Shared activation: rebuild for static libs, initializer + crate +
    // host build for FFI libs (dev.dev.activate_lib).
    // Activation must never abort the loop: rebuild_lib now returns ERROR
    // strings on compile failure, and any residual panic deeper in the
    // build path is caught here and collected like any other error.
    let r = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| activate_lib(libid.to_owned()))) {
        Ok(r) => r,
        Err(e) => {
            let why = if let Some(s) = e.downcast_ref::<String>() { s.clone() }
                else if let Some(s) = e.downcast_ref::<&str>() { s.to_string() }
                else { "unknown panic".to_string() };
            format!("ERROR: activation panicked: {}", why)
        }
    };
    println!("UPDATED LIBRARY {:?}", libid);
    if r.starts_with("ERROR") { errs.push(format!("{}: {}", libid, r)); }
    else {
        if r.starts_with("RESTART") { restart = true; }
        oks.push(libid.to_owned());
    }
}

let mut msg = if errs.is_empty() {
    format!("OK: {} (repo {})", oks.join(", "), reponame)
} else if oks.is_empty() {
    format!("ERROR: {}", errs.join("; "))
} else {
    format!("OK: {} (repo {}); FAILED: {}", oks.join(", "), reponame, errs.join("; "))
};
if restart {
    msg += " - restart Newbound once to activate the new hot-reload crate";
}
msg
}
