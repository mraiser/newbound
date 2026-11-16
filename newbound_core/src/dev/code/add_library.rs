use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::datastore::DataStore;
use flowlang::flowlang::system::system_call::system_call;
#[cfg(unix)]
use std::os::unix::fs::symlink;
// Windows: these links are always directories. A real directory symlink
// needs Developer Mode or an elevated process, so fall back to a junction
// (mklink /J), which any user may create. Junction targets must be plain
// absolute paths, so the \?\ prefix canonicalize() adds is stripped.
#[cfg(windows)]
fn symlink<P: AsRef<std::path::Path>, Q: AsRef<std::path::Path>>(src: P, dst: Q) -> std::io::Result<()> {
  let s = src.as_ref().to_string_lossy().to_string();
  let s = s.strip_prefix(r"\?\").unwrap_or(&s).to_string();
  if std::os::windows::fs::symlink_dir(&s, dst.as_ref()).is_ok() { return Ok(()); }
  let out = std::process::Command::new("cmd").arg("/C").arg("mklink").arg("/J")
    .arg(dst.as_ref()).arg(&s).stdin(std::process::Stdio::null()).output()?;
  if out.status.success() { Ok(()) }
  else { Err(std::io::Error::new(std::io::ErrorKind::Other, String::from_utf8_lossy(&out.stderr).trim().to_string())) }
}

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
        add_library(arg_0)
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

pub fn add_library(lib: String) -> String {
let store = DataStore::new();
if store.exists(&lib, "controls") {
    return format!("OK (library `{}` already exists; unchanged)", &lib);
}
let msg = crate::api::new().app.app.newlib(lib.clone(), DataArray::new(), DataArray::new());

// Birth repo (frictionless git): a brand-new library gets its own git repo
// under repositories/<lib> from day one - the exact layout
// dev.github.import produces (repo's data/<lib>, symlinked into the
// instance) - so its history starts at creation, the autocommit sweeper
// tracks it, and canon never sees it (the /data/* ignore rule). Without
// git on PATH this whole block is skipped and the library is a plain
// data/<lib> directory, exactly as before.
// split_paths: PATH is ';'-separated on Windows, and git there is git.exe
let gitok = std::env::var_os("PATH").map(|p| std::env::split_paths(&p)
    .any(|d| !d.as_os_str().is_empty() && (d.join("git").is_file() || d.join("git.exe").is_file())))
    .unwrap_or(false);
if gitok {
    let root = store.root.parent().unwrap().to_path_buf();
    let datadir = root.join("data").join(&lib);
    let repodir = root.join("repositories").join(&lib);
    let is_symlink = std::fs::symlink_metadata(&datadir)
        .map(|m| m.file_type().is_symlink()).unwrap_or(true);
    if !is_symlink && datadir.exists() && !repodir.exists() {
        let dst = repodir.join("data").join(&lib);
        let _ = std::fs::create_dir_all(repodir.join("data"));
        if std::fs::rename(&datadir, &dst).is_ok() {
            match dst.canonicalize().map_err(|_| ()).and_then(|c| symlink(c, &datadir).map_err(|_| ())) {
                Ok(_) => {
                    let mut a = DataArray::new();
                    for s in ["git", "init", "-q", repodir.to_str().unwrap()] { a.push_string(s); }
                    let r = system_call(a);
                    if r.try_get_string("status").unwrap_or_default() == "ok" {
                        let _ = crate::dev::git::set_repo::set_repo(
                            lib.clone(), repodir.to_string_lossy().to_string(), String::new(),
                            "library".to_string(), true, "system".to_string(), String::new());
                        return format!("{} (tracked in repositories/{})", msg, &lib);
                    }
                    // git init failed: leave the moved+symlinked layout - it
                    // still works, and init re-registers nothing untracked.
                    return format!("{} (repositories/{} created; git init failed)", msg, &lib);
                }
                Err(_) => {
                    // undo the move so the library stays usable in place
                    let _ = std::fs::rename(&dst, &datadir);
                    let _ = std::fs::remove_dir_all(&repodir);
                }
            }
        } else {
            let _ = std::fs::remove_dir_all(&repodir);
        }
    }
}
msg
}
