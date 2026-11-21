// Peer-push overlays: a library pushed from a peer (dev.dev.install_lib) into
// a data/<lib> that is a symlink into a git checkout is written THROUGH the
// link, so the checkout is dirty with content no commit stands behind - on
// purpose (test a tentative build on a peer, hot-swapped, outside git). The
// marker file runtime/dev/peer_overlays.json (instance-local, never in the
// repo) records it, so that
//   - the sweepers never commit it (dev.git.autocommit_sweep, agent.committer),
//   - the update verbs restore the checkout to HEAD before they pull/merge,
//   - repo_state can say what the dirt is.
fn fail(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}
fn marker_path() -> PathBuf {
    DataStore::new().root.parent().unwrap().join("runtime").join("dev").join("peer_overlays.json")
}
fn load() -> DataObject {
    match fs::read_to_string(marker_path()) {
        Ok(s) => match DataObject::try_from_string(&format!("{{\"a\":{}}}", s)) {
            Ok(w) => w.try_get_object("a").unwrap_or_else(|_| DataObject::new()),
            Err(_) => DataObject::new(),
        },
        Err(_) => DataObject::new(),
    }
}
fn save(all: &DataObject) -> Result<(), String> {
    let p = marker_path();
    if let Some(d) = p.parent() { let _ = fs::create_dir_all(d); }
    let tmp = p.with_extension("json.tmp");
    fs::write(&tmp, all.to_string()).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &p).map_err(|e| e.to_string())
}
fn git(path: &str, args: &[&str]) -> (bool, String, String) {
    match std::process::Command::new("git").arg("--no-optional-locks").arg("-C").arg(path).args(args).output() {
        Ok(o) => (o.status.success(), String::from_utf8_lossy(&o.stdout).to_string(), String::from_utf8_lossy(&o.stderr).trim().to_string()),
        Err(e) => (false, String::new(), format!("git could not be run: {}", e)),
    }
}
fn canon(p: &str) -> String {
    Path::new(p).canonicalize().map(|c| c.to_string_lossy().to_string()).unwrap_or_else(|_| p.to_string())
}
// a registered repo name, or a path
fn resolve(repo: &str) -> String {
    let reg = crate::dev::git::repos::repos();
    if let Ok(repos) = reg.try_get_object("repos") {
        if let Ok(e) = repos.try_get_object(repo) {
            if let Ok(p) = e.try_get_string("path") { return canon(&p); }
        }
    }
    canon(repo)
}
fn walk(base: &Path, dir: &Path, out: &mut Vec<String>) {
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            let is_dir = fs::symlink_metadata(&p).map(|m| m.is_dir()).unwrap_or(false);
            if is_dir { walk(base, &p, out); }
            else if let Ok(r) = p.strip_prefix(base) { out.push(r.to_string_lossy().replace('\\', "/")); }
        }
    }
}
fn safe_name(s: &str) -> bool {
    !s.is_empty() && !s.contains('/') && !s.contains('\\') && s != "." && s != ".."
}

let op = op.trim().to_string();
let lib = lib.trim().to_string();
let repo = repo.trim().to_string();
let mut all = load();
let want_path = if repo.is_empty() { String::new() } else { resolve(&repo) };
let mut selected: Vec<String> = Vec::new();
for (k, v) in all.objects() {
    if let Data::DObject(_) = v {
        let e = v.object();
        if !lib.is_empty() && k != lib { continue; }
        if !want_path.is_empty() && canon(&e.try_get_string("repo_path").unwrap_or_default()) != want_path { continue; }
        selected.push(k);
    }
}
selected.sort();

let mut o = DataObject::new();
o.put_string("status", "ok");

if op == "list" {
    let mut a = DataArray::new();
    for k in &selected { a.push_object(all.get_object(k).deep_copy()); }
    o.put_int("count", a.len() as i64);
    o.put_array("overlays", a);
    return o;
}

if op == "mark" {
    if !safe_name(&lib) { return fail("mark needs a library name"); }
    let mut e = entry.deep_copy();
    e.put_string("lib", &lib);
    let rp = canon(&e.try_get_string("repo_path").unwrap_or_default());
    let rel = e.try_get_string("rel").unwrap_or_default();
    if rp.is_empty() || rel.is_empty() || rel.starts_with('/') || rel.split('/').any(|p| p.is_empty() || p == "..") {
        return fail("mark needs entry.repo_path and a relative entry.rel");
    }
    e.put_string("repo_path", &rp);
    // a second push over a standing overlay keeps the HEAD the first one was laid over
    if let Ok(old) = all.try_get_object(&lib) {
        if let Ok(h) = old.try_get_string("head") { if !h.is_empty() { e.put_string("head", &h); } }
    }
    if !e.has("time") {
        e.put_int("time", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0));
    }
    all.put_object(&lib, e.clone());
    if let Err(x) = save(&all) { return fail(&format!("could not write the overlay marker: {}", x)); }
    o.put_object("overlay", e);
    return o;
}

if op == "forget" {
    let mut n = 0i64;
    for k in &selected { all.remove_property(k); n += 1; }
    if n > 0 { if let Err(x) = save(&all) { return fail(&format!("could not write the overlay marker: {}", x)); } }
    o.put_int("forgotten", n);
    return o;
}

if op == "restore" {
    if repo.is_empty() && lib.is_empty() { return fail("restore needs a repo or a library"); }
    let mut restored = DataArray::new();
    let mut steps = DataArray::new();
    let mut errors = DataArray::new();
    for k in &selected {
        let e = all.get_object(k);
        let rp = e.try_get_string("repo_path").unwrap_or_default();
        let rel = e.try_get_string("rel").unwrap_or_default();
        let peer = { let n = e.try_get_string("peer_name").unwrap_or_default(); if n.is_empty() { e.try_get_string("peer").unwrap_or_default() } else { n } };
        if !Path::new(&rp).join(".git").exists() || rel.is_empty() {
            // the checkout is gone: nothing to restore, drop the marker
            all.remove_property(k);
            steps.push_string(&format!("{}: overlay marker dropped - its checkout {} is gone", k, rp));
            continue;
        }
        let libdir = Path::new(&rp).join(&rel);
        // what the overlay changed, before it is undone
        let (_, st, _) = git(&rp, &["status", "--porcelain", "-uall", "--", &rel]);
        let mut rust = st.lines().any(|l| l.trim_end().ends_with(".rs"));
        let mut before: Vec<String> = Vec::new();
        walk(&libdir.join("_APPS"), &libdir.join("_APPS"), &mut before);

        let (ok, _, err) = git(&rp, &["checkout", "HEAD", "--", &rel]);
        if !ok {
            errors.push_string(&format!("{}: checkout HEAD -- {} failed: {}", k, rel, err));
            continue;
        }
        let (ok2, _, err2) = git(&rp, &["clean", "-fd", "--", &rel]);
        if !ok2 { errors.push_string(&format!("{}: clean {} failed: {}", k, rel, err2)); }

        // A runtime/<app> that is a link into this checkout was written
        // through by the push (dev.dev.refresh_apps): put its tracked shipped
        // files back to HEAD too, so the pull/merge that follows is not
        // refused. botd.properties is local state and is never touched; files
        // the push added are removed by the install step (`removed`).
        let rtroot = DataStore::new().root.parent().unwrap().join("runtime");
        let rpc = Path::new(&rp).canonicalize().unwrap_or_else(|_| PathBuf::from(&rp));
        let mut shipped: Vec<String> = before.clone();
        walk(&libdir.join("_APPS"), &libdir.join("_APPS"), &mut shipped);
        shipped.sort();
        shipped.dedup();
        let mut rt_apps: Vec<String> = Vec::new();
        for r in &shipped {
            let (app, relf) = match r.split_once('/') { Some(x) => x, None => continue };
            if relf == "botd.properties" { continue; }
            let rt = rtroot.join(app);
            if !fs::symlink_metadata(&rt).map(|m| m.file_type().is_symlink()).unwrap_or(false) { continue; }
            let rtc = match rt.canonicalize() { Ok(c) => c, Err(_) => continue };
            let relrt = match rtc.strip_prefix(&rpc) { Ok(x) => x.to_string_lossy().replace('\\', "/"), Err(_) => continue };
            if relrt.is_empty() { continue; }
            let spec = format!("{}/{}", relrt, relf);
            if spec.starts_with(&format!("{}/", rel)) { continue; }
            let (okr, _, _) = git(&rp, &["checkout", "HEAD", "--", &spec]);
            if okr && !rt_apps.iter().any(|a| a == app) { rt_apps.push(app.to_string()); }
        }
        if !rt_apps.is_empty() {
            steps.push_string(&format!("{}: runtime files of {} in the checkout put back to the checked-out commit", k, rt_apps.join(", ")));
        }

        // the crate sources the overlay's rebuild regenerated inside the repo
        let mut root = k.clone();
        if let Ok(s) = fs::read_to_string(libdir.join("meta.json")) {
            if let Ok(w) = DataObject::try_from_string(&format!("{{\"a\":{}}}", s)) {
                if let Ok(m) = w.try_get_object("a") { if let Ok(r) = m.try_get_string("root") { if safe_name(&r) { root = r; } } }
            }
        }
        if Path::new(&rp).join(&root).join("Cargo.toml").is_file() {
            let src = format!("{}/src/{}", root, k);
            let (_, st2, _) = git(&rp, &["status", "--porcelain", "-uall", "--", &src]);
            if !st2.trim().is_empty() { rust = true; }
            let (c1, _, _) = git(&rp, &["checkout", "HEAD", "--", &src]);
            if c1 { let _ = git(&rp, &["clean", "-fd", "--", &src]); }
            let _ = git(&rp, &["checkout", "HEAD", "--", &format!("{}/src/cmdinit.rs", root)]);
            let _ = git(&rp, &["checkout", "HEAD", "--", &format!("{}/src/lib.rs", root)]);
        }

        let removed: Vec<String> = before.into_iter().filter(|r| r.contains('/') && !libdir.join("_APPS").join(r).exists()).collect();
        let mut ro = DataObject::new();
        ro.put_string("lib", k);
        ro.put_string("peer", &peer);
        ro.put_boolean("rust", rust);
        let mut ra = DataArray::new();
        for r in &removed { ra.push_string(r); }
        ro.put_array("removed", ra);
        restored.push_object(ro);
        steps.push_string(&format!("{}: the push from peer {} was discarded - {} restored to the checked-out commit", k, peer, rel));
        all.remove_property(k);
    }
    if let Err(x) = save(&all) { errors.push_string(&format!("could not write the overlay marker: {}", x)); }
    if errors.len() > 0 { o.put_string("status", "err"); o.put_string("msg", &errors.get_string(0)); }
    o.put_array("restored", restored);
    o.put_array("steps", steps);
    o.put_array("errors", errors);
    return o;
}

if op == "install" {
    // make the running instance match the restored tree, HEAD moved or not
    if !safe_name(&lib) { return fail("install needs a library name"); }
    let removed = entry.try_get_array("removed").unwrap_or_else(|_| DataArray::new());
    let activate = entry.try_get_boolean("activate").unwrap_or(true);
    let rust = entry.try_get_boolean("rust").unwrap_or(false);
    let mut steps = DataArray::new();
    let mut restart = false;
    let l2 = lib.clone();
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| crate::dev::dev::refresh_apps::refresh_apps(l2, DataArray::new(), removed))) {
        Ok(r) => {
            let n = r.try_get_int("files").unwrap_or(0);
            let d = r.try_get_array("deleted").map(|a| a.len()).unwrap_or(0);
            if n > 0 || d > 0 { steps.push_string(&format!("{}: app files put back ({} written, {} deleted)", lib, n, d)); }
            o.put_object("apps", r);
        }
        Err(_) => steps.push_string(&format!("{}: app refresh FAILED", lib)),
    }
    if activate {
        let l3 = lib.clone();
        let r = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| crate::dev::dev::activate_lib::activate_lib(l3))) {
            Ok(r) => r,
            Err(_) => "ERROR: activation panicked".to_string(),
        };
        let mut ffi = false;
        if let Ok(s) = fs::read_to_string(DataStore::new().root.join(&lib).join("meta.json")) {
            if let Ok(w) = DataObject::try_from_string(&format!("{{\"a\":{}}}", s)) {
                if let Ok(m) = w.try_get_object("a") { if let Ok(c) = m.try_get_object("cargo") { ffi = c.try_get_boolean("ffi").unwrap_or(false); } }
            }
        }
        restart = r.starts_with("RESTART") || (rust && !ffi && !r.starts_with("ERROR"));
        let first = r.lines().next().unwrap_or("").to_string();
        steps.push_string(&if r.starts_with("ERROR") { format!("{}: rebuild FAILED: {}", lib, first) }
            else if restart { format!("{}: rebuilt - restart Newbound to load its Rust", lib) }
            else { format!("{}: rebuilt, live", lib) });
        o.put_string("activate", &r);
    }
    o.put_boolean("restart", restart);
    o.put_array("steps", steps);
    return o;
}

fail("op must be list, mark, forget, restore or install")