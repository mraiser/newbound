use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["repo", "branch", "discard", "delete_remote", "next_branch"] {
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
        let arg_2: bool = o.get_boolean("discard");
        let arg_3: bool = o.get_boolean("delete_remote");
        let arg_4: String = o.get_string("next_branch");
        abandon_branch(arg_0, arg_1, arg_2, arg_3, arg_4)
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

pub fn abandon_branch(repo: String, branch: String, discard: bool, delete_remote: bool, next_branch: String) -> DataObject {
// "This is bad - drop this branch and start over from master." Guarded
// destructive workflow: (discard) reset --hard + clean -fd so no edit or new
// store record survives -> checkout default -> branch -D -> (delete_remote)
// push origin --delete -> fast-forward default to origin -> (next_branch)
// start_branch. A dirty tree without discard=true is refused, never silently
// carried; origin's copy of the branch is kept unless delete_remote is set,
// so "abandon" is still recoverable from the remote by default.
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
let next_branch = next_branch.trim().to_string();
if branch.is_empty() { return fail("branch is required"); }
let mut steps = DataArray::new();

let lb = crate::dev::git::read::read(repo.clone(), "branch".to_string(), sargs(&["--format=%(refname:short)"]));
if !okr(&lb) { return fail(&format!("branch list failed: {}", errs(&lb))); }
let locals: Vec<String> = outs(&lb).lines().map(|l| l.trim().to_string()).filter(|s| !s.is_empty()).collect();
if !locals.iter().any(|b| b == &branch) { return fail(&format!("no such local branch '{}'", branch)); }
let default = if locals.iter().any(|b| b == "master") { "master".to_string() }
    else if locals.iter().any(|b| b == "main") { "main".to_string() }
    else { return fail("no local master or main branch to fall back to") };
if default == branch { return fail("refusing to abandon the default branch itself"); }
if !next_branch.is_empty() && next_branch == branch { return fail("next_branch must differ from the branch being abandoned"); }

let st = crate::dev::git::read::read(repo.clone(), "status".to_string(), sargs(&["--porcelain=v2", "--branch"]));
if !okr(&st) { return fail(&format!("status failed: {}", errs(&st))); }
let mut cur = String::new();
let mut dirty = 0i64;
for line in outs(&st).lines() {
    if let Some(h) = line.strip_prefix("# branch.head ") { cur = h.trim().to_string(); }
    else if line.starts_with("? ") || line.starts_with("1 ") || line.starts_with("2 ") || line.starts_with("u ") { dirty += 1; }
}
let mid_merge = ref_exists(&repo, "MERGE_HEAD");

// the tree: discard it, or refuse to lose it
let mut discarded = false;
if dirty > 0 || mid_merge {
    if !discard {
        return fail(&format!("{} uncommitted change(s){} on '{}' would be lost - pass discard=true to throw them away", dirty,
            if mid_merge { " and a merge in progress" } else { "" }, cur));
    }
    if mid_merge {
        let r = crate::dev::git::write::write(repo.clone(), "merge".to_string(), sargs(&["--abort"]));
        if okr(&r) { steps.push_string("merge --abort"); }
    }
    let r = crate::dev::git::write::write(repo.clone(), "reset".to_string(), sargs(&["--hard", "HEAD"]));
    if !okr(&r) { return fail(&format!("reset --hard failed: {}", errs(&r))); }
    steps.push_string("reset --hard HEAD");
    let r = crate::dev::git::write::write(repo.clone(), "clean".to_string(), sargs(&["-fd"]));
    if !okr(&r) { return fail(&format!("clean -fd failed: {} (tracked edits already reset)", errs(&r))); }
    steps.push_string("clean -fd");
    discarded = true;
}

// onto the default branch, delete the label
if cur != default {
    let r = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&[&default]));
    if !okr(&r) { return fail(&format!("checkout {} failed: {}", default, errs(&r))); }
    steps.push_string(&format!("checkout {}", default));
}
let r = crate::dev::git::write::write(repo.clone(), "branch".to_string(), sargs(&["-D", &branch]));
if !okr(&r) { return fail(&format!("branch -D {} failed: {} - now on '{}', branch not deleted", branch, errs(&r), default)); }
steps.push_string(&format!("branch -D {}", branch));

// origin: optionally drop the remote copy; always try to bring default current
let has_origin = {
    let r = crate::dev::git::read::read(repo.clone(), "remote".to_string(), sargs(&["get-url", "origin"]));
    okr(&r) && !outs(&r).trim().is_empty()
};
let mut remote_deleted = false;
let mut notes: Vec<String> = Vec::new();
if has_origin && delete_remote && ref_exists(&repo, &format!("refs/remotes/origin/{}", branch)) {
    let r = crate::dev::git::remote_op::remote_op(repo.clone(), "push".to_string(), sargs(&["origin", "--delete", &branch]));
    remote_deleted = okr(&r);
    if remote_deleted { steps.push_string(&format!("push origin --delete {}", branch)); }
    else { notes.push(format!("origin/{} not deleted: {}", branch, errs(&r))); }
}
let mut next = DataObject::new();
let mut now_on = default.clone();
if !next_branch.is_empty() {
    // start_branch fetches, fast-forwards default, cuts, publishes
    next = crate::dev::git::start_branch::start_branch(repo.clone(), next_branch.clone());
    if okr(&next) {
        now_on = next_branch.clone();
        for s in next.get_array("steps").objects() { if let ndata::data::Data::DString(x) = s { steps.push_string(&x); } }
    } else {
        notes.push(format!("next branch '{}' not started: {}", next_branch, next.try_get_string("msg").unwrap_or_default()));
    }
} else if has_origin {
    let r = crate::dev::git::remote_op::remote_op(repo.clone(), "fetch".to_string(), sargs(&["--prune"]));
    if okr(&r) {
        steps.push_string("fetch --prune");
        let remote_ref = format!("origin/{}", default);
        if ref_exists(&repo, &format!("refs/remotes/{}", remote_ref)) {
            let m = crate::dev::git::write::write(repo.clone(), "merge".to_string(), sargs(&["--ff-only", &remote_ref]));
            if okr(&m) { steps.push_string(&format!("merge --ff-only {}", remote_ref)); }
            else { notes.push(format!("local {} could not fast-forward to {}: {}", default, remote_ref, errs(&m))); }
        }
    } else { notes.push(format!("fetch failed: {}", errs(&r))); }
}

let mut o = DataObject::new();
o.put_string("status", "ok");
let mut msg = format!("abandoned {}; on {}{}{}", branch, now_on,
    if discarded { " (tree discarded)" } else { "" },
    if remote_deleted { ", origin copy deleted" } else if has_origin { ", origin copy kept" } else { "" });
if !notes.is_empty() { msg.push_str(" - "); msg.push_str(&notes.join("; ")); }
o.put_string("msg", &msg);
o.put_string("abandoned", &branch);
o.put_string("now_on", &now_on);
o.put_boolean("discarded", discarded);
o.put_boolean("remote_deleted", remote_deleted);
o.put_object("next", next);
o.put_array("steps", steps);
o
}
