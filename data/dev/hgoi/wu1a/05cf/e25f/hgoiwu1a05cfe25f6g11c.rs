// "This is bad — abandon this branch and go back to the default branch clean."
// Guarded destructive workflow: checkout the default branch (master, else main),
// delete the feature branch, and (discard=true) reset --hard the default branch so
// no working-tree edits survive. The mutating-command confirm gate is the "are you
// sure?" by mechanism; discard defaults false so a bare call only leaves the branch
// and deletes the label, never touches the tree. Refuses to delete the default
// branch or the branch you're not on without checking out default first.
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

// default branch: local master else main
let lb = crate::dev::git::read::read(repo.clone(), "branch".to_string(), sargs(&["--format=%(refname:short)"]));
let lb = match ok_step("branch list", lb) { Ok(r) => r, Err(e) => return fail(&e) };
let locals: Vec<String> = lb.try_get_string("out").unwrap_or_default()
    .lines().map(|l| l.trim().trim_start_matches("* ").to_string()).filter(|s| !s.is_empty()).collect();
if !locals.iter().any(|b| b == &branch) { return fail(&format!("no such local branch '{}'", branch)); }
let default = if locals.iter().any(|b| b == "master") { "master".to_string() }
    else if locals.iter().any(|b| b == "main") { "main".to_string() }
    else { return fail("no local master or main branch to fall back to"); };
if default == branch { return fail("refusing to abandon the default branch itself"); }

let mut steps = DataArray::new();
// move to the default branch (force checkout discards nothing unless discard)
let r = crate::dev::git::write::write(repo.clone(), "checkout".to_string(), sargs(&[&default]));
if let Err(e) = ok_step(&format!("checkout {}", default), r) {
    return fail(&format!("{} — uncommitted changes on '{}' block the switch; commit, stash, or set discard=true", e, branch));
}
steps.push_string(&format!("checkout {}", default));
// delete the feature branch (-D: it is abandon, unmerged is the point)
let r = crate::dev::git::write::write(repo.clone(), "branch".to_string(), sargs(&["-D", &branch]));
match ok_step(&format!("delete branch {}", branch), r) {
    Ok(_) => steps.push_string(&format!("branch -D {}", branch)),
    Err(e) => return fail(&format!("{} — now on '{}', branch not deleted", e, default)),
}
// optionally reset the tree to the default branch tip
if discard {
    let r = crate::dev::git::write::write(repo.clone(), "reset".to_string(), sargs(&["--hard", "HEAD"]));
    match ok_step("reset --hard", r) {
        Ok(_) => steps.push_string("reset --hard HEAD"),
        Err(e) => return fail(&format!("{} — branch deleted, on '{}', but the reset did not run", e, default)),
    }
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("abandoned {}; on {} {}", branch, default, if discard { "(tree reset)" } else { "(tree kept)" }));
o.put_string("abandoned", &branch);
o.put_string("now_on", &default);
o.put_boolean("discarded", discard);
o.put_array("steps", steps);
o