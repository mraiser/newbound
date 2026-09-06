use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["repo", "branch"] {
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
        let arg_0: String = o.get_string("repo");
        let arg_1: String = o.get_string("branch");
        carry_branch(arg_0, arg_1)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
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

pub fn carry_branch(repo: String, branch: String) -> DataObject {
// "My commits landed on master/main." The pre-'branches always' condition:
// the sweeper used to autocommit straight onto the default branch, so a repo
// can hold commits on main that origin/main lacks. Move them onto a new branch
// and put the local default back where origin has it, without touching the
// working tree: fetch -> checkout -b <branch> (at the default's current HEAD)
// -> branch -f <default> origin/<default> -> push -u origin <branch>. Nothing
// is rewritten and nothing is force-pushed: the commits keep their history
// under the new name, and update_from_master folds in whatever origin gained
// meanwhile. Uncommitted edits ride along untouched (a branch cut keeps the
// tree; resetting the default's pointer never checks it out).
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
fn count(repo: &str, range: &str) -> i64 {
    let x = crate::dev::git::read::read(repo.to_string(), "rev-list".to_string(), sargs(&["--count", range]));
    outs(&x).trim().parse().unwrap_or(0)
}

let repo = repo.trim().to_string();
let branch = branch.trim().to_string();
if branch.is_empty() { return fail("branch name is required"); }
if branch.starts_with('-') || branch.contains(char::is_whitespace) || branch.contains("..") {
    return fail(&format!("'{}' is not a usable branch name", branch));
}
let mut steps = DataArray::new();

// origin is not optional here: the default is reset to ORIGIN's copy
let has_origin = {
    let r = crate::dev::git::read::read(repo.clone(), "remote".to_string(), sargs(&["get-url", "origin"]));
    okr(&r) && !outs(&r).trim().is_empty()
};
if !has_origin { return fail("no origin - there is nothing to reset the default branch to; use start_branch"); }
let r = crate::dev::git::remote_op::remote_op(repo.clone(), "fetch".to_string(), sargs(&["--prune"]));
if !okr(&r) { return fail(&format!("fetch failed: {} - nothing changed", errs(&r))); }
steps.push_string("fetch --prune");

let st = crate::dev::git::read::read(repo.clone(), "status".to_string(), sargs(&["--porcelain=v2", "--branch"]));
if !okr(&st) { return fail(&format!("status failed: {}", errs(&st))); }
let mut cur = String::new();
let (mut dirty, mut conflicts) = (0i64, 0i64);
for line in outs(&st).lines() {
    if let Some(h) = line.strip_prefix("# branch.head ") { cur = h.trim().to_string(); }
    else if line.starts_with("u ") { conflicts += 1; dirty += 1; }
    else if line.starts_with("? ") || line.starts_with("1 ") || line.starts_with("2 ") { dirty += 1; }
}
if ref_exists(&repo, "MERGE_HEAD") { return fail("a merge is in progress - finish it (commit) or abort it (merge --abort) first"); }
if conflicts > 0 { return fail(&format!("{} conflicted path(s) - resolve them first", conflicts)); }

let lb = crate::dev::git::read::read(repo.clone(), "branch".to_string(), sargs(&["--format=%(refname:short)"]));
let locals: Vec<String> = outs(&lb).lines().map(|l| l.trim().to_string()).filter(|s| !s.is_empty()).collect();
if locals.iter().any(|b| b == &branch) { return fail(&format!("branch '{}' already exists locally", branch)); }
let default = if locals.iter().any(|b| b == "master") { "master".to_string() }
    else if locals.iter().any(|b| b == "main") { "main".to_string() }
    else { return fail("no local master or main branch") };
if branch == default { return fail("the default branch is not a working branch"); }
if cur != default {
    return fail(&format!("repo is on '{}', not {} - carry moves commits sitting ON the default branch; start_branch cuts a fresh one", cur, default));
}
let remote_ref = format!("origin/{}", default);
if !ref_exists(&repo, &format!("refs/remotes/{}", remote_ref)) {
    return fail(&format!("{} does not exist - origin has no {} to reset to", remote_ref, default));
}
let carried = count(&repo, &format!("{}..HEAD", remote_ref));
if carried == 0 {
    return fail(&format!("{} has no commits {} lacks - nothing to carry; use start_branch", default, remote_ref));
}
let behind = count(&repo, &format!("HEAD..{}", remote_ref));

// cut at the current default HEAD: the commits now have a name
let r = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&["-b", &branch]));
if !okr(&r) { return fail(&format!("checkout -b {} failed: {} - still on '{}', nothing changed", branch, errs(&r), default)); }
steps.push_string(&format!("checkout -b {}", branch));
// move the default's pointer to origin's without checking it out (the tree is untouched)
let r = crate::dev::git::write::write(repo.clone(), "branch".to_string(), sargs(&["-f", &default, &remote_ref]));
if !okr(&r) {
    return fail(&format!("branch -f {} {} failed: {} - the {} commit(s) are safe on '{}'; {} still holds them too", default, remote_ref, errs(&r), carried, branch, default));
}
steps.push_string(&format!("branch -f {} {}", default, remote_ref));
let mut published = false;
let mut publish_err = String::new();
let r = crate::dev::git::remote_op::remote_op(repo.clone(), "push".to_string(), sargs(&["-u", "origin", &branch]));
published = okr(&r);
if published { steps.push_string(&format!("push -u origin {}", branch)); } else { publish_err = errs(&r); }

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("branch", &branch);
o.put_string("default", &default);
o.put_string("base", &remote_ref);
o.put_int("carried_commits", carried);
o.put_int("behind_base", behind);
o.put_boolean("published", published);
o.put_string("publish_err", &publish_err);
o.put_int("carried", dirty);
o.put_array("steps", steps);
o.put_string("msg", &format!("{} commit(s) moved from {} onto {}{}; {} reset to {}{}{}",
    carried, default, branch,
    if published { ", published" } else { ", NOT published (publish once origin is reachable)" },
    default, remote_ref,
    if behind > 0 { format!("; {} has {} commit(s) this branch lacks - update from {}", remote_ref, behind, default) } else { String::new() },
    if dirty > 0 { format!("; {} uncommitted change(s) carried along untouched", dirty) } else { String::new() }));
o
}
