// "This is working now — merge my branch to the default upstream branch and push."
// Transactional: detect the repo's default branch (master, else main), checkout
// default, merge the feature branch, push, then checkout the feature branch
// back. A dirty tree is NOT a blocker: git itself refuses a checkout or merge
// that would overwrite an edit (gitrun reports the refusal verbatim), and edits
// it does not touch ride along untouched (Cargo.lock, forever rewritten by the
// builder, is the standing case). Conflicts and a merge in flight still refuse.
// A merge conflict is reported with the tree left on the default branch
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
fn ref_exists(repo: &str, r: &str) -> bool {
    let x = crate::dev::git::read::read(repo.to_string(), "rev-parse".to_string(), sargs(&["--verify", "--quiet", r]));
    x.try_get_string("status").unwrap_or_default() == "ok" && !x.try_get_string("out").unwrap_or_default().trim().is_empty()
}
let repo = repo.trim().to_string();
let branch = branch.trim().to_string();
if branch.is_empty() { return fail("branch is required"); }

// where are we, and what is the tree carrying? (porcelain=v2 --branch)
let st = crate::dev::git::read::read(repo.clone(), "status".to_string(), sargs(&["--porcelain=v2", "--branch"]));
let st = match ok_step("status", st) { Ok(r) => r, Err(e) => return fail(&e) };
let sout = st.try_get_string("out").unwrap_or_default();
let mut cur = String::new();
let (mut dirty, mut conflicts) = (0i64, 0i64);
for line in sout.lines() {
    if let Some(h) = line.strip_prefix("# branch.head ") { cur = h.trim().to_string(); }
    else if line.starts_with("u ") { conflicts += 1; dirty += 1; }
    else if line.starts_with("? ") || line.starts_with("1 ") || line.starts_with("2 ") { dirty += 1; }
}
if cur != branch {
    return fail(&format!("repo is on '{}', not the branch to merge '{}' — check it out first", cur, branch));
}
if ref_exists(&repo, "MERGE_HEAD") { return fail("a merge is already in progress - finish it (commit) or abort it (merge --abort) first"); }
if conflicts > 0 { return fail(&format!("{} conflicted path(s) - resolve them first", conflicts)); }

// default branch: prefer a local master, else main
let lb = crate::dev::git::read::read(repo.clone(), "branch".to_string(), sargs(&["--format=%(refname:short)"]));
let lb = match ok_step("branch list", lb) { Ok(r) => r, Err(e) => return fail(&e) };
let locals: Vec<String> = lb.try_get_string("out").unwrap_or_default()
    .lines().map(|l| l.trim().trim_start_matches("* ").to_string()).filter(|s| !s.is_empty()).collect();
let default = if locals.iter().any(|b| b == "master") { "master".to_string() }
    else if locals.iter().any(|b| b == "main") { "main".to_string() }
    else { return fail("no local master or main branch to merge into"); };
if default == branch { return fail("branch to merge is already the default branch"); }

let mut steps = DataArray::new();
// checkout default - git refuses if a dirty file differs between the two branches; then nothing has changed
let r = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&[&default]));
if let Err(e) = ok_step(&format!("checkout {}", default), r) { return fail(&format!("{} - still on '{}', nothing merged", e, branch)); }
steps.push_string(&format!("checkout {}", default));
// merge the feature branch
let r = crate::dev::git::write::write(repo.clone(), "merge".to_string(), sargs(&["--no-ff", "-m", &format!("merge {}", branch), &branch]));
match ok_step(&format!("merge {}", branch), r) {
    Ok(_) => steps.push_string(&format!("merge {}", branch)),
    Err(e) => {
        if ref_exists(&repo, "MERGE_HEAD") {
            return fail(&format!("{} — left on '{}' mid-merge; resolve then commit, or merge --abort", e, default));
        }
        // git refused before starting (typically an uncommitted edit the merge would overwrite): nothing changed
        let _ = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&[&branch]));
        return fail(&format!("{} — nothing merged, back on '{}'", e, branch));
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
o.put_string("msg", &format!("merged {} → {} and pushed{}", branch, default,
    if dirty > 0 { format!(" ({} uncommitted change(s) carried along untouched)", dirty) } else { String::new() }));
o.put_string("branch", &branch);
o.put_string("default", &default);
o.put_int("carried", dirty);
o.put_array("steps", steps);
o