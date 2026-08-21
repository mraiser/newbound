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
let gitok = std::env::var("PATH").unwrap_or_default().split(':')
    .any(|d| !d.is_empty() && std::path::Path::new(d).join("git").is_file());
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