// Commit exactly the named repo-relative paths, whatever happened to them:
// modified, new, or DELETED. git itself is the witness (add -A stages a
// deletion as readily as an edit), so nothing depends on the live store still
// knowing a record - the gap commit_unit's store closure cannot cover.
// Pathspecs are literal; the commit carries a pathspec, so pre-staged
// unrelated work stays staged, untouched.
fn fail(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}
let _ = author;
let _ = nn_sessionid;
if message.trim().is_empty() { return fail("message must be non-empty"); }
let repo = repo.trim().to_string();

let regpath = DataStore::new().root.parent().unwrap().join("runtime").join("dev").join("repos.json");
if !regpath.exists() { return fail("no repo registry at runtime/dev/repos.json"); }
let reg = match DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap_or_default()) {
    Ok(o) => o,
    Err(_) => return fail("runtime/dev/repos.json is not valid JSON"),
};
if !reg.has(&repo) { return fail(&format!("unknown repo '{}' - dev.git.repos lists registered repos", repo)); }
let rpath = std::path::PathBuf::from(reg.get_object(&repo).get_string("path"));

// validate: repo-relative, no traversal, de-duplicated
let mut want: Vec<String> = Vec::new();
for p in paths.objects() {
    let s = match p { Data::DString(s) => s, _ => return fail("paths must be an array of strings") };
    let s = s.trim().to_string();
    if s.is_empty() { continue; }
    if s.starts_with('/') || s.split('/').any(|c| c == "..") {
        return fail(&format!("path '{}' must be repo-relative with no '..'", s));
    }
    if !want.contains(&s) { want.push(s); }
}
if want.is_empty() { return fail("no paths given"); }

// a path git does not track and the disk does not hold names nothing (it
// would fail the whole add): skip it and say so
let mut largs = DataArray::new();
largs.push_string("--");
for s in &want { largs.push_string(&format!(":(literal){}", s)); }
let ls = crate::dev::git::read::read(repo.clone(), "ls-files".to_string(), largs);
if ls.get_string("status") != "ok" { return ls; }
let lsout = ls.get_string("out");
let tracked: Vec<&str> = lsout.lines().map(|l| l.trim().trim_matches('"')).collect();
// ...unless it is an already-STAGED change (a staged deletion is in neither
// the index nor the worktree, only in HEAD): that needs no add, just the commit
let mut dargs = DataArray::new();
dargs.push_string("--cached"); dargs.push_string("--name-only"); dargs.push_string("--no-renames");
dargs.push_string("HEAD"); dargs.push_string("--");
for s in &want { dargs.push_string(&format!(":(literal){}", s)); }
let dc = crate::dev::git::read::read(repo.clone(), "diff".to_string(), dargs);
let dcout = if dc.get_string("status") == "ok" { dc.get_string("out") } else { String::new() };
let prestaged: Vec<&str> = dcout.lines().map(|l| l.trim().trim_matches('"')).collect();
let mut addspecs: Vec<String> = Vec::new();
let mut specs: Vec<String> = Vec::new();
let mut committed_paths = DataArray::new();
let mut skipped = DataArray::new();
for s in &want {
    let live = tracked.contains(&s.as_str()) || std::fs::symlink_metadata(rpath.join(s)).is_ok();
    if live { addspecs.push(format!(":(literal){}", s)); }
    if live || prestaged.contains(&s.as_str()) {
        specs.push(format!(":(literal){}", s));
        committed_paths.push_string(s);
    } else { skipped.push_string(s); }
}
if specs.is_empty() { return fail("none of the paths is tracked, staged, or present on disk"); }

if !addspecs.is_empty() {
    let mut aargs = DataArray::new();
    aargs.push_string("-A");
    aargs.push_string("--");
    for s in &addspecs { aargs.push_string(s); }
    let add = crate::dev::git::write::write(repo.clone(), "add".to_string(), aargs);
    if add.get_string("status") != "ok" { return add; }
}

let mut cargs = DataArray::new();
cargs.push_string("-m");
cargs.push_string(message.trim());
cargs.push_string("--");
for s in &specs { cargs.push_string(s); }
let com = crate::dev::git::write::write(repo.clone(), "commit".to_string(), cargs);
let comout = format!("{}\n{}", com.get_string("out"), com.get_string("err"));
let mut res = DataObject::new();
if com.get_string("status") != "ok" {
    if comout.contains("nothing to commit") || comout.contains("no changes added") || comout.contains("nothing added to commit") {
        res.put_string("status", "ok");
        res.put_boolean("committed", false);
        res.put_string("msg", "paths staged, but nothing in them had changed - nothing to commit");
    } else { return com; }
} else {
    res.put_string("status", "ok");
    res.put_boolean("committed", true);
}
res.put_array("paths", committed_paths);
res.put_array("skipped", skipped);
res.put_string("out", comout.trim());
res