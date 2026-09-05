// "Start a new working branch from master." Compound, transactional:
// fetch -> checkout default -> fast-forward it to origin/<default> ->
// checkout -b <branch> -> push -u origin <branch>. Cuts from the REMOTE's
// master (never from wherever HEAD happens to be), so an abandoned branch
// can never leak into the next one, and publishes at birth so the sweeper
// can push from the first commit. Requires a clean tree unless you are ON
// the default branch, in which case uncommitted edits ride into the new
// branch (the "I edited on master by mistake" rescue).
fn fail(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}
fn sargs(v: &[&str]) -> DataArray {
    let mut a = DataArray::new();
    for s in v { a.push_string(s); }
    a
}
fn okr(r: &DataObject) -> bool { r.try_get_string("status").unwrap_or_default() == "ok" }
fn outs(r: &DataObject) -> String { r.try_get_string("out").unwrap_or_default() }
fn errs(r: &DataObject) -> String {
    let e = r.try_get_string("err").unwrap_or_default().trim().to_string();
    if e.is_empty() { r.try_get_string("msg").unwrap_or_default() } else { e }
}
fn ref_exists(repo: &str, r: &str) -> bool {
    let x = crate::dev::git::read::read(repo.to_string(), "rev-parse".to_string(), sargs(&["--verify", "--quiet", r]));
    okr(&x) && !outs(&x).trim().is_empty()
}

let repo = repo.trim().to_string();
let branch = branch.trim().to_string();
if branch.is_empty() { return fail("branch name is required"); }
if branch.starts_with('-') || branch.contains(char::is_whitespace) || branch.contains("..") {
    return fail(&format!("'{}' is not a usable branch name", branch));
}
let mut steps = DataArray::new();

// origin + fetch (non-fatal: offline means we cut from the local default and say so)
let has_origin = {
    let r = crate::dev::git::read::read(repo.clone(), "remote".to_string(), sargs(&["get-url", "origin"]));
    okr(&r) && !outs(&r).trim().is_empty()
};
let mut fetched = false;
if has_origin {
    let r = crate::dev::git::remote_op::remote_op(repo.clone(), "fetch".to_string(), sargs(&["--prune"]));
    fetched = okr(&r);
    steps.push_string(if fetched { "fetch --prune" } else { "fetch --prune (failed - cutting from the local default)" });
}

// where are we, and is the tree clean?
let st = crate::dev::git::read::read(repo.clone(), "status".to_string(), sargs(&["--porcelain=v2", "--branch"]));
if !okr(&st) { return fail(&format!("status failed: {}", errs(&st))); }
let mut cur = String::new();
let mut dirty = 0i64;
for line in outs(&st).lines() {
    if let Some(h) = line.strip_prefix("# branch.head ") { cur = h.trim().to_string(); }
    else if line.starts_with("? ") || line.starts_with("1 ") || line.starts_with("2 ") || line.starts_with("u ") { dirty += 1; }
}
if ref_exists(&repo, "MERGE_HEAD") { return fail("a merge is in progress - finish it (commit) or abort it (merge --abort) first"); }

let lb = crate::dev::git::read::read(repo.clone(), "branch".to_string(), sargs(&["--format=%(refname:short)"]));
let locals: Vec<String> = outs(&lb).lines().map(|l| l.trim().to_string()).filter(|s| !s.is_empty()).collect();
if locals.iter().any(|b| b == &branch) { return fail(&format!("branch '{}' already exists locally", branch)); }
let default = if locals.iter().any(|b| b == "master") { "master".to_string() }
    else if locals.iter().any(|b| b == "main") { "main".to_string() }
    else { return fail("no local master or main branch to start from") };
if branch == default { return fail("the default branch is not a working branch"); }

if dirty > 0 && cur != default {
    return fail(&format!("{} uncommitted change(s) on '{}' - let the sweep commit them (or commit / abandon with discard) before starting a new branch", dirty, cur));
}

// onto the default branch
if cur != default {
    let r = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&[&default]));
    if !okr(&r) { return fail(&format!("checkout {} failed: {}", default, errs(&r))); }
    steps.push_string(&format!("checkout {}", default));
}
// fast-forward it to origin's (never merge: a diverged local default is an error to see, not to paper over)
let remote_ref = format!("origin/{}", default);
if has_origin && ref_exists(&repo, &format!("refs/remotes/{}", remote_ref)) {
    let r = crate::dev::git::write::write(repo.clone(), "merge".to_string(), sargs(&["--ff-only", &remote_ref]));
    if !okr(&r) {
        if cur != default { let _ = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&[&cur])); }
        return fail(&format!("local {} could not fast-forward to {}: {} - it has diverged; back on '{}'", default, remote_ref, errs(&r), cur));
    }
    steps.push_string(&format!("merge --ff-only {}", remote_ref));
}
// cut and publish
let r = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&["-b", &branch]));
if !okr(&r) { return fail(&format!("checkout -b {} failed: {} - now on '{}'", branch, errs(&r), default)); }
steps.push_string(&format!("checkout -b {}", branch));
let mut published = false;
let mut publish_err = String::new();
if has_origin {
    let r = crate::dev::git::remote_op::remote_op(repo.clone(), "push".to_string(), sargs(&["-u", "origin", &branch]));
    published = okr(&r);
    if published { steps.push_string(&format!("push -u origin {}", branch)); } else { publish_err = errs(&r); }
}
let head = crate::dev::git::read::read(repo.clone(), "rev-parse".to_string(), sargs(&["--short", "HEAD"]));

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("branch", &branch);
o.put_string("default", &default);
o.put_string("base", &outs(&head).trim().to_string());
o.put_boolean("fetched", fetched);
o.put_boolean("published", published);
o.put_string("publish_err", &publish_err);
o.put_int("carried", if cur == default { dirty } else { 0 });
o.put_array("steps", steps);
o.put_string("msg", &format!("on {} from {}{}{}", branch,
    if fetched { remote_ref.clone() } else { default.clone() },
    if published { ", published" } else if has_origin { ", NOT published (publish once origin is reachable)" } else { "" },
    if cur == default && dirty > 0 { format!(", {} uncommitted change(s) carried over", dirty) } else { String::new() }));
o