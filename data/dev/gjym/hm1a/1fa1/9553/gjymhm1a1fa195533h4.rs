// The "install library" step for a repo whose HEAD was moved from outside
// (merge from master, pull, branch switch). Looks at what changed under
// data/ between old_head and new_head and makes the running instance match:
//   data/<lib>/_APPS/<app>/...  -> dev.dev.refresh_apps (replace shipped files,
//                                  keep botd.properties, copy a new app in
//                                  INACTIVE; apps= is never written)
//   data/<lib>/<anything else>  -> dev.dev.activate_lib (rebuild / hot-load)
// Only libraries whose data/<lib> on this instance IS the repo's data/<lib>
// are touched; the core libraries and the instance's own checkout are
// reported and skipped. Never fails the calling verb: every problem is
// reported in the result.
fn sargs(v: &[&str]) -> DataArray {
    let mut a = DataArray::new();
    for s in v { a.push_string(s); }
    a
}
fn okr(r: &DataObject) -> bool { r.try_get_string("status").unwrap_or_default() == "ok" }
fn outs(r: &DataObject) -> String { r.try_get_string("out").unwrap_or_default() }
fn sarr(v: &[String]) -> DataArray {
    let mut a = DataArray::new();
    for s in v { a.push_string(s); }
    a
}
fn panic_text(e: Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = e.downcast_ref::<String>() { s.clone() }
    else if let Some(s) = e.downcast_ref::<&str>() { s.to_string() }
    else { "unknown panic".to_string() }
}
#[derive(Default)]
struct LibDiff { store: bool, rust: bool, apps: Vec<String>, removed: Vec<String> }

fn run(repo: String, old_head: String, new_head: String) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "ok");
    o.put_boolean("changed", false);
    o.put_boolean("restart", false);
    let mut steps = DataArray::new();
    let mut libs_out = DataArray::new();
    let mut skipped = DataArray::new();

    let h = crate::dev::git::read::read(repo.clone(), "rev-parse".to_string(), sargs(&["HEAD"]));
    if !okr(&h) {
        o.put_string("status", "err");
        o.put_string("msg", &format!("rev-parse failed: {}", h.try_get_string("msg").unwrap_or_default()));
        return o;
    }
    let repo_path = h.try_get_string("path").unwrap_or_default();
    let new_head = if new_head.trim().is_empty() { outs(&h).trim().to_string() } else { new_head.trim().to_string() };
    let old_head = old_head.trim().to_string();
    o.put_string("old_head", &old_head);
    o.put_string("new_head", &new_head);
    if old_head.is_empty() || old_head == new_head {
        o.put_string("msg", "HEAD did not move - nothing to install");
        o.put_array("libs", libs_out); o.put_array("skipped", skipped); o.put_array("steps", steps);
        return o;
    }

    let store = DataStore::new();
    let root = store.root.parent().unwrap().to_path_buf();
    let same = |a: &Path, b: &Path| match (a.canonicalize(), b.canonicalize()) { (Ok(x), Ok(y)) => x == y, _ => false };
    if same(Path::new(&repo_path), &root) {
        o.put_string("msg", "this is the instance's own checkout - not installed from here (use dev.dev.hard_reset / a rebuild)");
        o.put_array("libs", libs_out); o.put_array("skipped", skipped); o.put_array("steps", steps);
        return o;
    }

    let d = crate::dev::git::read::read(repo.clone(), "diff".to_string(),
        sargs(&["--name-status", "--no-renames", &old_head, &new_head, "--", "data"]));
    if !okr(&d) {
        o.put_string("status", "err");
        o.put_string("msg", &format!("diff {}..{} failed: {}", old_head, new_head, d.try_get_string("msg").unwrap_or_default()));
        return o;
    }
    let mut diffs: BTreeMap<String, LibDiff> = BTreeMap::new();
    for line in outs(&d).lines() {
        let mut it = line.splitn(2, '\t');
        let state = it.next().unwrap_or("").trim().to_string();
        let path = it.next().unwrap_or("").trim().to_string();
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() < 3 || parts[0] != "data" { continue; }
        let e = diffs.entry(parts[1].to_string()).or_default();
        if parts[2] == "_APPS" {
            if parts.len() < 5 { continue; }
            let app = parts[3].to_string();
            if !e.apps.contains(&app) { e.apps.push(app.clone()); }
            if state.starts_with('D') { e.removed.push(format!("{}/{}", app, parts[4..].join("/"))); }
        } else {
            e.store = true;
            if path.ends_with(".rs") { e.rust = true; }
        }
    }
    if diffs.is_empty() {
        o.put_string("msg", "no library changes between the two commits");
        o.put_array("libs", libs_out); o.put_array("skipped", skipped); o.put_array("steps", steps);
        return o;
    }
    o.put_boolean("changed", true);

    let core = ["app", "dev", "peer", "security"];
    let mut restart = false;
    for (lib, ld) in diffs.iter() {
        let mut skip = |why: &str| {
            let mut s = DataObject::new();
            s.put_string("lib", lib);
            s.put_string("why", why);
            skipped.push_object(s);
        };
        if core.contains(&lib.as_str()) { skip("core library - not rebuilt or reinstalled from a git update"); continue; }
        let repo_lib = Path::new(&repo_path).join("data").join(lib);
        if !repo_lib.is_dir() { skip("library no longer in the repo - nothing removed here"); continue; }
        if !same(&store.root.join(lib), &repo_lib) { skip("not installed from this repo on this instance"); continue; }

        let mut lo = DataObject::new();
        lo.put_string("lib", lib);

        // apps first: cheap, and independent of whether the build succeeds
        if !ld.apps.is_empty() {
            let mut gone: Vec<String> = Vec::new();
            let mut have: Vec<String> = Vec::new();
            for a in &ld.apps {
                if repo_lib.join("_APPS").join(a).join("app.properties").is_file() { have.push(a.clone()); } else { gone.push(a.clone()); }
            }
            if !have.is_empty() {
                let (l2, a2, r2) = (lib.clone(), sarr(&have), sarr(&ld.removed));
                match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| crate::dev::dev::refresh_apps::refresh_apps(l2, a2, r2))) {
                    Ok(r) => {
                        let list = |k: &str| -> Vec<String> {
                            let mut v = Vec::new();
                            if let Ok(a) = r.try_get_array(k) { for x in a.objects() { if let ndata::data::Data::DString(s) = x { v.push(s); } } }
                            v
                        };
                        let (ins, refr, lnk, errs) = (list("installed"), list("refreshed"), list("linked"), list("errors"));
                        if !ins.is_empty() { steps.push_string(&format!("{}: installed app(s) {} (inactive until activated in the app app)", lib, ins.join(", "))); }
                        if !refr.is_empty() { steps.push_string(&format!("{}: refreshed app(s) {}", lib, refr.join(", "))); }
                        if !lnk.is_empty() { steps.push_string(&format!("{}: app(s) {} are linked into the repo - already current", lib, lnk.join(", "))); }
                        if !errs.is_empty() { steps.push_string(&format!("{}: app refresh errors: {}", lib, errs.join("; "))); }
                        lo.put_object("apps", r);
                    }
                    Err(e) => {
                        let why = panic_text(e);
                        steps.push_string(&format!("{}: app refresh failed: {}", lib, why));
                        lo.put_string("apps_err", &why);
                    }
                }
            }
            if !gone.is_empty() {
                steps.push_string(&format!("{}: app(s) {} were removed upstream - runtime copy and activation left as they are", lib, gone.join(", ")));
                lo.put_array("apps_removed_upstream", sarr(&gone));
            }
        }

        if ld.store {
            let l2 = lib.clone();
            let r = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| crate::dev::dev::activate_lib::activate_lib(l2))) {
                Ok(r) => r,
                Err(e) => format!("ERROR: activation panicked: {}", panic_text(e)),
            };
            let mut ffi = false;
            if let Ok(s) = std::fs::read_to_string(repo_lib.join("meta.json")) {
                let w = DataObject::try_from_string(&format!("{{\"a\":{}}}", s));
                if let Ok(w) = w { if let Ok(meta) = w.try_get_object("a") {
                    if let Ok(cargo) = meta.try_get_object("cargo") { ffi = cargo.try_get_boolean("ffi").unwrap_or(false); }
                } }
            }
            let need_restart = r.starts_with("RESTART") || (ld.rust && !ffi && !r.starts_with("ERROR"));
            if need_restart { restart = true; }
            lo.put_string("activate", &r);
            lo.put_boolean("restart", need_restart);
            let first = r.lines().next().unwrap_or("").to_string();
            steps.push_string(&if r.starts_with("ERROR") { format!("{}: rebuild FAILED: {}", lib, first) }
                else if need_restart { format!("{}: rebuilt - restart Newbound to load its changed Rust", lib) }
                else { format!("{}: rebuilt, live", lib) });
        }
        libs_out.push_object(lo);
    }

    o.put_boolean("restart", restart);
    let n = libs_out.len();
    o.put_string("msg", &format!("{} librar{} brought in line with {}{}", n, if n == 1 { "y" } else { "ies" },
        &new_head[..new_head.len().min(8)], if restart { " - restart Newbound to finish" } else { "" }));
    o.put_array("libs", libs_out);
    o.put_array("skipped", skipped);
    o.put_array("steps", steps);
    o
}

match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| run(repo, old_head, new_head))) {
    Ok(o) => o,
    Err(e) => {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("post-update install panicked: {}", panic_text(e)));
        o
    }
}