// Bring runtime/<app> in line with the bundle a library ships in
// data/<lib>/_APPS/<app>. The update twin of materialize_apps (which only
// sets up an app that is missing):
//   - app not in runtime/ yet      -> copied whole (installed, NOT activated)
//   - runtime/<app> is a symlink   -> left alone (it already is the source)
//   - app already set up           -> every shipped file overwrites its
//                                     counterpart, app.properties included
// botd.properties is the app's local state: an existing one is never
// overwritten and never deleted. Files in runtime/<app> the bundle does not
// ship are left alone, except those named in `removed` ("<app>/<rel>" - the
// files an update deleted from the bundle). config.properties apps= is never
// touched: activating an app stays the user's act.
fn safe_rel(s: &str) -> bool {
    !s.is_empty() && !s.starts_with('/') && !s.contains('\\') && !s.split('/').any(|p| p.is_empty() || p == "." || p == "..")
}
// returns files written
fn sync(src: &Path, dest: &Path, top: bool, fresh: bool) -> Result<i64, String> {
    fs::create_dir_all(dest).map_err(|e| format!("{}: {}", dest.display(), e))?;
    let mut n = 0i64;
    let mut ents: Vec<std::path::PathBuf> = fs::read_dir(src).map_err(|e| format!("{}: {}", src.display(), e))?.flatten().map(|e| e.path()).collect();
    ents.sort();
    for p in ents {
        let name = p.file_name().unwrap().to_string_lossy().to_string();
        let d = dest.join(&name);
        if p.is_dir() {
            if d.exists() && !d.is_dir() { let _ = fs::remove_file(&d); }
            n += sync(&p, &d, false, fresh)?;
        } else if p.is_file() {
            if top && !fresh && name == "botd.properties" && d.exists() { continue; }
            let new = fs::read(&p).map_err(|e| format!("{}: {}", p.display(), e))?;
            if let Ok(old) = fs::read(&d) { if old == new { continue; } }
            if d.is_dir() { let _ = fs::remove_dir_all(&d); }
            fs::write(&d, &new).map_err(|e| format!("{}: {}", d.display(), e))?;
            n += 1;
        }
    }
    Ok(n)
}
fn fail(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}

if lib.is_empty() || !safe_rel(&lib) || lib.contains('/') { return fail(&format!("Invalid library name: '{}'", lib)); }
let store = DataStore::new();
let appdata = store.root.join(&lib).join("_APPS");
if !store.root.join(&lib).is_dir() { return fail(&format!("No library named '{}' on this device", lib)); }
let appruntime = store.root.parent().unwrap().join("runtime");

let mut names: Vec<String> = Vec::new();
for a in apps.objects() { if let Data::DString(s) = a { names.push(s); } }
if names.is_empty() && appdata.is_dir() {
    if let Ok(rd) = fs::read_dir(&appdata) {
        for e in rd.flatten() { if e.path().is_dir() { names.push(e.file_name().to_string_lossy().to_string()); } }
    }
}
names.sort();
names.dedup();

let mut installed = DataArray::new();
let mut refreshed = DataArray::new();
let mut linked = DataArray::new();
let mut missing = DataArray::new();
let mut errors = DataArray::new();
let mut files = 0i64;
let mut live: Vec<String> = Vec::new(); // apps whose runtime copy this call may edit
for name in &names {
    if !safe_rel(name) || name.contains('/') { errors.push_string(&format!("{}: not a usable app name", name)); continue; }
    let src = appdata.join(name);
    if !src.join("app.properties").is_file() { missing.push_string(name); continue; }
    let dest = appruntime.join(name);
    let is_link = fs::symlink_metadata(&dest).map(|m| m.file_type().is_symlink()).unwrap_or(false);
    if is_link { linked.push_string(name); continue; }
    let fresh = !dest.join("app.properties").exists();
    match sync(&src, &dest, true, fresh) {
        Ok(n) => {
            files += n;
            live.push(name.clone());
            if fresh { installed.push_string(name); } else { refreshed.push_string(name); }
        }
        Err(e) => errors.push_string(&format!("{}: {}", name, e)),
    }
}

// files the update removed from the bundle
let mut deleted = DataArray::new();
for r in removed.objects() {
    let r = match r { Data::DString(s) => s, _ => continue };
    if !safe_rel(&r) { continue; }
    let (app, rel) = match r.split_once('/') { Some(x) => x, None => continue };
    if !live.iter().any(|a| a == app) { continue; }
    if rel == "botd.properties" { continue; }
    if appdata.join(app).join(rel).exists() { continue; } // still shipped
    let dest = appruntime.join(app);
    let target = dest.join(rel);
    let is_file = fs::symlink_metadata(&target).map(|m| !m.is_dir()).unwrap_or(false);
    if !is_file { continue; }
    if fs::remove_file(&target).is_ok() {
        deleted.push_string(&r);
        // prune directories the deletion emptied, never runtime/<app> itself
        let mut dir = target.parent().map(|p| p.to_path_buf());
        while let Some(d) = dir {
            if d == dest || !d.starts_with(&dest) { break; }
            if fs::remove_dir(&d).is_err() { break; }
            dir = d.parent().map(|p| p.to_path_buf());
        }
    }
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("lib", &lib);
o.put_array("installed", installed);
o.put_array("refreshed", refreshed);
o.put_array("linked", linked);
o.put_array("missing", missing);
o.put_int("files", files);
o.put_array("deleted", deleted);
o.put_array("errors", errors);
o