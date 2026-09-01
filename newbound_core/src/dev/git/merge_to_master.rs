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
        merge_to_master(arg_0, arg_1)
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

pub fn merge_to_master(repo: String, branch: String) -> DataObject {
// "This is working now — merge my branch to the default upstream branch and push."
// Transactional: detect the repo's default branch (master, else main), require a
// clean tree, checkout default, merge the feature branch, push, then checkout the
// feature branch back. Any failure stops the sequence and surfaces the step's
// stderr; a merge conflict is reported with the tree left on the default branch
// mid-merge so the owner can resolve or abort, never silently half-merged.
fn fail(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}
fn ok_step(step: &str, r: DataObject) -> Result<DataObject, String> {
    if r.try_get_string("status").unwrap_or_default() == "ok" { Ok(r) }
    else {
        let e = r.try_get_string("err").unwrap_or_default().trim().to_string();
        let m = r.try_get_string("msg").unwrap_or_default().trim().to_string();
        Err(format!("{} failed: {}", step, if !e.is_empty() { e } else { m }))
    }
}
fn sargs(v: &[&str]) -> DataArray {
    let mut a = DataArray::new();
    for s in v { a.push_string(s); }
    a
}
let branch = branch.trim().to_string();
if branch.is_empty() { return fail("branch is required"); }

// current branch + clean check (porcelain=v2 --branch)
let st = crate::dev::git::read::read(repo.clone(), "status".to_string(), sargs(&["--porcelain=v2", "--branch"]));
let st = match ok_step("status", st) { Ok(r) => r, Err(e) => return fail(&e) };
let sout = st.try_get_string("out").unwrap_or_default();
let mut cur = String::new();
let mut dirty = false;
for line in sout.lines() {
    if let Some(h) = line.strip_prefix("# branch.head ") { cur = h.trim().to_string(); }
    else if line.starts_with("? ") || line.starts_with("1 ") || line.starts_with("2 ") || line.starts_with("u ") { dirty = true; }
}
if cur != branch {
    return fail(&format!("repo is on '{}', not the branch to merge '{}' — check it out first (dev.git branch_new / checkout)", cur, branch));
}
if dirty { return fail("working tree is dirty — commit or stash before merging (the sweep may be holding changes)"); }

// default branch: prefer a local master, else main, else a remote default
let lb = crate::dev::git::read::read(repo.clone(), "branch".to_string(), sargs(&["--format=%(refname:short)"]));
let lb = match ok_step("branch list", lb) { Ok(r) => r, Err(e) => return fail(&e) };
let locals: Vec<String> = lb.try_get_string("out").unwrap_or_default()
    .lines().map(|l| l.trim().trim_start_matches("* ").to_string()).filter(|s| !s.is_empty()).collect();
let default = if locals.iter().any(|b| b == "master") { "master".to_string() }
    else if locals.iter().any(|b| b == "main") { "main".to_string() }
    else { return fail("no local master or main branch to merge into"); };
if default == branch { return fail("branch to merge is already the default branch"); }

let mut steps = DataArray::new();
// checkout default
let r = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&[&default]));
if let Err(e) = ok_step(&format!("checkout {}", default), r) { return fail(&e); }
steps.push_string(&format!("checkout {}", default));
// merge the feature branch
let r = crate::dev::git::write::write(repo.clone(), "merge".to_string(), sargs(&["--no-ff", "-m", &format!("merge {}", branch), &branch]));
match ok_step(&format!("merge {}", branch), r) {
    Ok(_) => steps.push_string(&format!("merge {}", branch)),
    Err(e) => {
        return fail(&format!("{} — left on '{}' mid-merge; resolve then commit, or dev.git abandon the merge (merge --abort)", e, default));
    }
}
// push default upstream
let r = crate::dev::git::remote_op::remote_op(repo.clone(), "push".to_string(), sargs(&["origin", &default]));
match ok_step("push", r) {
    Ok(_) => steps.push_string(&format!("push origin {}", default)),
    Err(e) => {
        let _ = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&[&branch]));
        return fail(&format!("{} — merged locally but not pushed; back on '{}'", e, branch));
    }
}
// return to the feature branch
let _ = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&[&branch]));
steps.push_string(&format!("checkout {}", branch));

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("merged {} → {} and pushed", branch, default));
o.put_string("branch", &branch);
o.put_string("default", &default);
o.put_array("steps", steps);
o
}
