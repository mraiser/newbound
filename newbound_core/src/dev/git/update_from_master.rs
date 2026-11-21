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
        update_from_master(arg_0, arg_1)
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

pub fn update_from_master(repo: String, branch: String) -> DataObject {
// "Master moved - bring my branch up to date." fetch -> merge origin/<default>
// into the current branch -> push. The verb pull cannot do this (it targets
// the branch's own upstream, which for a solo developer never moves). A dirty
// tree is not a blocker: git refuses a merge that would overwrite an edit
// (reported verbatim, nothing changed) and untouched edits ride along.
// Conflicts and a merge in flight refuse. A conflict is reported with the tree
// left mid-merge so it can be resolved or aborted - never half-merged.
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
if branch.is_empty() { return fail("branch is required"); }
let mut steps = DataArray::new();

let has_origin = {
    let r = crate::dev::git::read::read(repo.clone(), "remote".to_string(), sargs(&["get-url", "origin"]));
    okr(&r) && !outs(&r).trim().is_empty()
};
if has_origin {
    let r = crate::dev::git::remote_op::remote_op(repo.clone(), "fetch".to_string(), sargs(&["--prune"]));
    if !okr(&r) { return fail(&format!("fetch failed: {} - nothing merged", errs(&r))); }
    steps.push_string("fetch --prune");
}

let st = crate::dev::git::read::read(repo.clone(), "status".to_string(), sargs(&["--porcelain=v2", "--branch"]));
if !okr(&st) { return fail(&format!("status failed: {}", errs(&st))); }
let mut cur = String::new();
let mut upstream = String::new();
let (mut dirty, mut conflicts) = (0i64, 0i64);
for line in outs(&st).lines() {
    if let Some(h) = line.strip_prefix("# branch.head ") { cur = h.trim().to_string(); }
    else if let Some(u) = line.strip_prefix("# branch.upstream ") { upstream = u.trim().to_string(); }
    else if line.starts_with("u ") { conflicts += 1; dirty += 1; }
    else if line.starts_with("? ") || line.starts_with("1 ") || line.starts_with("2 ") { dirty += 1; }
}
if cur != branch { return fail(&format!("repo is on '{}', not '{}'", cur, branch)); }
if ref_exists(&repo, "MERGE_HEAD") { return fail("a merge is already in progress - finish it (commit) or abort it (merge --abort) first"); }
if conflicts > 0 { return fail(&format!("{} conflicted path(s) - resolve them first", conflicts)); }

let lb = crate::dev::git::read::read(repo.clone(), "branch".to_string(), sargs(&["--format=%(refname:short)"]));
let locals: Vec<String> = outs(&lb).lines().map(|l| l.trim().to_string()).filter(|s| !s.is_empty()).collect();
let default = if locals.iter().any(|b| b == "master") { "master".to_string() }
    else if locals.iter().any(|b| b == "main") { "main".to_string() }
    else { return fail("no local master or main branch to update from") };
if branch == default { return fail("already on the default branch - nothing to update from"); }
let remote_ref = format!("origin/{}", default);
let base = if has_origin && ref_exists(&repo, &format!("refs/remotes/{}", remote_ref)) { remote_ref } else { default.clone() };

// Restore first: a library pushed here from a peer (dev.git.overlay) is
// discarded - its files go back to the branch's HEAD - before anything is
// merged, so the merge meets a tree git knows. The running instance is put
// back in line below, whether or not HEAD then moves.
let ov = crate::dev::git::overlay::overlay("restore".to_string(), repo.clone(), String::new(), DataObject::new());
if !okr(&ov) { return fail(&format!("could not discard the push from a peer: {} - nothing merged", ov.try_get_string("msg").unwrap_or_default())); }
if let Ok(a) = ov.try_get_array("steps") {
    for s in a.objects() { if let ndata::data::Data::DString(x) = s { steps.push_string(&x); } }
}
let restored = ov.try_get_array("restored").unwrap_or_else(|_| DataArray::new());
let n_restored = restored.len() as i64;
if n_restored > 0 { dirty = 0; }
// forced re-install of the restored libraries; `built` = libraries after_update already rebuilt
let reinstall = |built: &Vec<String>, steps: &mut DataArray| -> bool {
    let mut restart = false;
    for r in restored.objects() {
        let r = r.object();
        let l = r.get_string("lib");
        let mut e = DataObject::new();
        e.put_array("removed", r.try_get_array("removed").unwrap_or_else(|_| DataArray::new()));
        e.put_boolean("rust", r.try_get_boolean("rust").unwrap_or(false));
        e.put_boolean("activate", !built.contains(&l));
        let i = crate::dev::git::overlay::overlay("install".to_string(), String::new(), l, e);
        if i.try_get_boolean("restart").unwrap_or(false) { restart = true; }
        if let Ok(a) = i.try_get_array("steps") {
            for s in a.objects() { if let ndata::data::Data::DString(x) = s { steps.push_string(&x); } }
        }
    }
    restart
};

// already current?
let cnt = crate::dev::git::read::read(repo.clone(), "rev-list".to_string(), sargs(&["--count", &format!("HEAD..{}", base)]));
let behind: i64 = outs(&cnt).trim().parse().unwrap_or(0);
if behind == 0 {
    let restart = reinstall(&Vec::new(), &mut steps);
    let mut o = DataObject::new();
    o.put_string("status", "ok");
    o.put_string("msg", &if n_restored > 0 { format!("{} peer-pushed librar{} restored to {}; it already has everything in {}{}", n_restored, if n_restored == 1 { "y" } else { "ies" }, branch, base, if restart { " - restart Newbound to finish" } else { "" }) }
        else { format!("{} already has everything in {}", branch, base) });
    o.put_boolean("restart", restart);
    o.put_int("restored", n_restored);
    o.put_string("branch", &branch);
    o.put_string("base", &base);
    o.put_int("merged", 0);
    o.put_boolean("pushed", false);
    o.put_int("carried", dirty);
    o.put_array("steps", steps);
    return o;
}

let old_head = outs(&crate::dev::git::read::read(repo.clone(), "rev-parse".to_string(), sargs(&["HEAD"]))).trim().to_string();
let r = crate::dev::git::write::write(repo.clone(), "merge".to_string(), sargs(&["-m", &format!("update {} from {}", branch, base), &base]));
if !okr(&r) {
    if ref_exists(&repo, "MERGE_HEAD") {
        return fail(&format!("merge {} failed: {} - left mid-merge on '{}'; resolve then commit, or merge --abort", base, errs(&r), branch));
    }
    // git refused before starting (typically an uncommitted edit the merge would overwrite): nothing changed
    return fail(&format!("merge {} refused: {} - nothing merged", base, errs(&r)));
}
steps.push_string(&format!("merge {}", base));

// the tree moved: bring the running instance in line (apps refreshed, changed libraries rebuilt)
let install = crate::dev::git::after_update::after_update(repo.clone(), old_head, String::new());
if let Ok(a) = install.try_get_array("steps") {
    for s in a.objects() { if let ndata::data::Data::DString(x) = s { steps.push_string(&x); } }
}
let mut restart = install.try_get_boolean("restart").unwrap_or(false);
// libraries restored from a peer push: re-install them even where the merge did not touch them
let mut built: Vec<String> = Vec::new();
if let Ok(a) = install.try_get_array("libs") {
    for l in a.objects() { let l = l.object(); if l.has("activate") { built.push(l.try_get_string("lib").unwrap_or_default()); } }
}
if reinstall(&built, &mut steps) { restart = true; }

let mut pushed = false;
let mut push_err = String::new();
if !upstream.is_empty() {
    let p = crate::dev::git::remote_op::remote_op(repo.clone(), "push".to_string(), sargs(&[]));
    pushed = okr(&p);
    if pushed { steps.push_string("push"); } else { push_err = errs(&p); }
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("merged {} commit(s) from {} into {}{}{}", behind, base, branch,
    if pushed { ", pushed" } else if upstream.is_empty() { " (branch is unpublished)" } else { " - push failed" },
    if dirty > 0 { format!(", {} uncommitted change(s) carried along untouched", dirty) } else { String::new() }));
o.put_string("branch", &branch);
o.put_string("base", &base);
o.put_int("merged", behind);
o.put_boolean("pushed", pushed);
o.put_string("push_err", &push_err);
o.put_int("carried", dirty);
o.put_boolean("restart", restart);
o.put_int("restored", n_restored);
o.put_object("install", install);
o.put_array("steps", steps);
o
}
