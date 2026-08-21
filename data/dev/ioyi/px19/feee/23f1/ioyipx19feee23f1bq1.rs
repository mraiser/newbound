// Timer-fired once at boot (start 0, no repeat), on the same pattern as
// security.security.init and peer.reboot.init. A clone-built instance has
// no data/runtime (identity keys are redacted from the repo), so
// runtime/metaidentity is absent and dev.editcontrol.publishapp panics on
// its known FIXME. When the record is missing, seed the platform's
// historical default identity - the "Some Dev" the shipped library
// meta.json files carry - so a fresh checkout publishes out of the box
// with no hand-seeding. The workbench publish pane's identity form edits
// it from there; an instance that already has an identity is untouched.
let store = DataStore::new();
let mut o = DataObject::new();
o.put_string("status", "ok");
if store.exists("runtime", "metaidentity") {
    o.put_boolean("created", false);
} else {
    let r = crate::dev::code::set_meta_identity::set_meta_identity(
        "Some Dev".to_string(), String::new(), "system".to_string(), String::new());
    if r.get_string("status") != "ok" { return r; }
    println!("dev.code.init: seeded runtime/metaidentity as \"Some Dev\"");
    o.put_boolean("created", true);
}

// git self-registration (frictionless git): having git IS enabling git.
// Register the working checkout (role canon) and every repositories/*
// clone (role library, autocommit on) that is not already registered -
// ADDITIVE ONLY, matched by canonical path, so hand-tuned entries
// (names, roles, origins, flags) are never clobbered. No git on PATH,
// or no .git anywhere: a clean no-op - the zip install never notices.
let gitok = std::env::var("PATH").unwrap_or_default().split(':')
    .any(|d| !d.is_empty() && std::path::Path::new(d).join("git").is_file());
o.put_boolean("git", gitok);
let mut registered: i64 = 0;
if gitok {
    let root = store.root.parent().unwrap().to_path_buf();
    let regpath = root.join("runtime").join("dev").join("repos.json");
    let reg = if regpath.exists() {
        DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap_or_default())
            .unwrap_or_else(|_| DataObject::new())
    } else { DataObject::new() };
    let mut known: Vec<String> = Vec::new();
    for n in reg.get_keys() {
        let e = reg.get_object(&n);
        if let Ok(p) = e.try_get_string("path") { known.push(p); }
    }
    // the checkout itself
    if root.join(".git").exists() {
        if let Ok(rootc) = std::fs::canonicalize(&root) {
            let rootc = rootc.to_string_lossy().to_string();
            if !known.iter().any(|p| *p == rootc) && !reg.has("canon") {
                let r = crate::dev::git::set_repo::set_repo(
                    "canon".to_string(), rootc.clone(), String::new(),
                    "canon".to_string(), false, "system".to_string(), String::new());
                if r.get_string("status") == "ok" {
                    println!("dev.code.init: registered working checkout as repo 'canon' ({})", rootc);
                    known.push(rootc);
                    registered += 1;
                }
            }
        }
    }
    // imported / created library clones
    let repodir = root.join("repositories");
    if let Ok(rd) = std::fs::read_dir(&repodir) {
        for ent in rd.flatten() {
            let p = ent.path();
            if !p.is_dir() || !p.join(".git").exists() { continue; }
            let nm = ent.file_name().to_string_lossy().to_string();
            if reg.has(&nm) { continue; }
            if let Ok(pc) = std::fs::canonicalize(&p) {
                let pc = pc.to_string_lossy().to_string();
                if known.iter().any(|k| *k == pc) { continue; }
                let r = crate::dev::git::set_repo::set_repo(
                    nm.clone(), pc.clone(), String::new(),
                    "library".to_string(), true, "system".to_string(), String::new());
                if r.get_string("status") == "ok" {
                    println!("dev.code.init: registered repositories/{} as a library repo (autocommit on)", nm);
                    known.push(pc);
                    registered += 1;
                }
            }
        }
    }
}
o.put_int("repos_registered", registered);
o
