// The resolver's write side: stage exactly one store unit's file closure
// and commit it. The closure comes from the LIVE store - the control record
// and every id-prefixed sibling (facets, _patches), each command record
// with its typed impls and their attachments, timer/event components, the
// controls index, and generated newbound_core/src/<lib>/<ctl>/ sources.
// Commit uses a pathspec so pre-staged unrelated work stays staged. A
// component already deleted from the store is outside the closure - the
// store can only name what it still knows.
fn fail(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}
fn shard_dir(root: &std::path::Path, lib: &str, id: &str) -> std::path::PathBuf {
    let mut s = id.to_string();
    while s.len() < 16 { s.push('_'); }
    root.join(lib).join(&s[0..4]).join(&s[4..8]).join(&s[8..12]).join(&s[12..16])
}
let _ = author;
let _ = nn_sessionid;

let lib = lib.trim().to_string();
let ctlq = ctl.trim().to_string();
if message.trim().is_empty() { return fail("message must be non-empty"); }

let store = DataStore::new();
let idx = store.root.join(&lib).join("cont").join("rols").join("____").join("____").join("controls");
if !idx.exists() { return fail(&format!("library '{}' has no controls index in the store", lib)); }
let d = store.get_data(&lib, "controls").get_object("data");
let list = if let Ok(a) = d.try_get_array("controls") { a }
    else if let Ok(a) = d.try_get_array("list") { a }
    else { return fail("controls index has no controls array"); };
let mut ctlid = String::new();
let mut ctlname = String::new();
for c in list.objects() {
    let co = match c.clone() { Data::DObject(_) => c.object(), _ => continue };
    let id = co.try_get_string("id").unwrap_or_default();
    let name = co.try_get_string("name").unwrap_or_default();
    if name == ctlq || id == ctlq { ctlid = id; ctlname = name; break; }
}
if ctlid.is_empty() { return fail(&format!("no control '{}' in library '{}'", ctlq, lib)); }
if ctlname.is_empty() { ctlname = ctlq.clone(); }

// gather the unit's record ids: control + commands + typed impls + components
let mut ids: Vec<String> = vec![ctlid.clone()];
if !shard_dir(&store.root, &lib, &ctlid).join(&ctlid).exists() {
    return fail("control record file is missing from the store tree");
}
let cd = store.get_data(&lib, &ctlid).get_object("data");
for key in ["cmd", "event", "timer"] {
    let arr = match cd.try_get_array(key) { Ok(a) => a, _ => continue };
    for e in arr.objects() {
        let eid = match e.clone() {
            Data::DString(s) => s,
            Data::DObject(_) => match e.object().try_get_string("id") { Ok(s) => s, _ => continue },
            _ => continue,
        };
        ids.push(eid.clone());
        if key == "cmd" && shard_dir(&store.root, &lib, &eid).join(&eid).exists() {
            let ed = store.get_data(&lib, &eid).get_object("data");
            for k in ["rust", "python", "flow", "js", "java"] {
                if let Ok(iid) = ed.try_get_string(k) {
                    if iid.len() >= 8 { ids.push(iid); }
                }
            }
        }
    }
}

// closure files: the controls index plus every file in each id's shard dir
// whose name starts with the id (record, facet/impl attachments, _patches)
let mut files: Vec<std::path::PathBuf> = vec![idx.clone()];
for id in &ids {
    let dir = shard_dir(&store.root, &lib, id);
    if let Ok(rd) = std::fs::read_dir(&dir) {
        for ent in rd.flatten() {
            let n = ent.file_name().to_string_lossy().to_string();
            if n.starts_with(id.as_str()) && ent.path().is_file() { files.push(ent.path()); }
        }
    }
}

// repo-relative conversion (canonicalize resolves the data/<lib> symlink of
// repositories/* clones into the repo tree)
let regpath = store.root.parent().unwrap().join("runtime").join("dev").join("repos.json");
if !regpath.exists() { return fail("no repo registry at runtime/dev/repos.json"); }
let reg = match DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap()) {
    Ok(o) => o,
    Err(_) => return fail("runtime/dev/repos.json is not valid JSON"),
};
let repo = repo.trim().to_string();
if !reg.has(&repo) { return fail(&format!("unknown repo '{}' - dev.git.repos lists registered repos", repo)); }
let rpath = match std::fs::canonicalize(reg.get_object(&repo).get_string("path")) {
    Ok(p) => p,
    Err(_) => return fail("repo path does not resolve"),
};

let mut staged = DataArray::new();
let mut skipped = DataArray::new();
let mut relargs: Vec<String> = Vec::new();
for f in &files {
    match std::fs::canonicalize(f) {
        Ok(cf) => match cf.strip_prefix(&rpath) {
            Ok(rel) => {
                let r = rel.to_string_lossy().to_string();
                relargs.push(r.clone());
                staged.push_string(&r);
            }
            Err(_) => skipped.push_string(&f.to_string_lossy().to_string()),
        },
        Err(_) => skipped.push_string(&f.to_string_lossy().to_string()),
    }
}
// generated sources ride as a directory pathspec so deletions stage too
let gensrc = rpath.join("newbound_core").join("src").join(&lib).join(&ctlname);
if gensrc.exists() {
    let r = format!("newbound_core/src/{}/{}", lib, ctlname);
    relargs.push(r.clone());
    staged.push_string(&r);
}
if relargs.is_empty() {
    return fail("no closure files resolve inside this repo - wrong repo for this unit?");
}

let mut aargs = DataArray::new();
aargs.push_string("-A");
aargs.push_string("--");
for r in &relargs { aargs.push_string(r); }
let add = crate::dev::git::write::write(repo.clone(), "add".to_string(), aargs);
if add.get_string("status") != "ok" { return add; }

let mut cargs = DataArray::new();
cargs.push_string("-m");
cargs.push_string(message.trim());
cargs.push_string("--");
for r in &relargs { cargs.push_string(r); }
let com = crate::dev::git::write::write(repo.clone(), "commit".to_string(), cargs);
let comout = format!("{}\n{}", com.get_string("out"), com.get_string("err"));
let mut res = DataObject::new();
if com.get_string("status") != "ok" {
    if comout.contains("nothing to commit") || comout.contains("no changes added") || comout.contains("nothing added to commit") {
        res.put_string("status", "ok");
        res.put_boolean("committed", false);
        res.put_string("msg", "closure staged, but nothing in it had changed - nothing to commit");
    } else { return com; }
} else {
    res.put_string("status", "ok");
    res.put_boolean("committed", true);
}
res.put_string("unit", &format!("{}.{}", lib, ctlname));
res.put_string("control_id", &ctlid);
res.put_array("staged", staged);
res.put_array("skipped", skipped);
res.put_string("out", comout.trim());
res