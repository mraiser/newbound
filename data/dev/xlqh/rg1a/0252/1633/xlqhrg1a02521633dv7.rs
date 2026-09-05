// The sweeper (normally the 5-minute timer): the whole "save" step, made
// mechanical. For EVERY registered repo with an origin: fetch --prune, so the
// panel's and the sensors' ahead/behind numbers are real without a click.
// For repos flagged autocommit: stage + commit when dirty, then push when the
// branch tracks a remote and has anything to push. Never on master/main -
// "branches always" is enforced here, so flagging canon or the overlay is
// safe: work on the default branch is reported, not committed. A clean tree,
// a git-less box, or an absent registry stays a free no-op.
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
let mut o = DataObject::new();
o.put_string("status", "ok");
let (mut swept, mut committed, mut pushed, mut fetched) = (0i64, 0i64, 0i64, 0i64);
let mut results = DataArray::new();
let regpath = DataStore::new().root.parent().unwrap()
    .join("runtime").join("dev").join("repos.json");
if regpath.exists() {
    if let Ok(reg) = DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap_or_default()) {
        for n in reg.get_keys() {
            let e = reg.get_object(&n);
            let has_origin = e.try_get_string("origin").map(|s| !s.trim().is_empty()).unwrap_or(false);
            let ac = matches!(e.try_get_boolean("autocommit"), Ok(true));
            let mut r = DataObject::new();
            r.put_string("repo", &n);
            if has_origin {
                let f = crate::dev::git::remote_op::remote_op(n.clone(), "fetch".to_string(), sargs(&["--prune"]));
                if okr(&f) { fetched += 1; r.put_boolean("fetched", true); }
                else { r.put_boolean("fetched", false); r.put_string("fetch_err", &errs(&f)); }
            }
            if !ac {
                r.put_string("result", "not_flagged");
                results.push_object(r);
                continue;
            }
            swept += 1;
            let st = crate::dev::git::read::read(n.clone(), "status".to_string(), sargs(&["--porcelain=v2", "--branch"]));
            if !okr(&st) {
                r.put_string("result", "status_failed");
                r.put_string("err", &errs(&st));
                results.push_object(r);
                continue;
            }
            let mut branch = String::new();
            let mut upstream = String::new();
            let mut ahead = 0i64;
            let mut npaths = 0i64;
            for line in outs(&st).lines() {
                if let Some(h) = line.strip_prefix("# branch.head ") { branch = h.trim().to_string(); }
                else if let Some(u) = line.strip_prefix("# branch.upstream ") { upstream = u.trim().to_string(); }
                else if let Some(ab) = line.strip_prefix("# branch.ab ") {
                    for tok in ab.split_whitespace() { if let Some(x) = tok.strip_prefix('+') { ahead = x.parse().unwrap_or(0); } }
                }
                else if line.starts_with("? ") || line.starts_with("1 ") || line.starts_with("2 ") || line.starts_with("u ") { npaths += 1; }
            }
            r.put_string("branch", &branch);
            if branch == "master" || branch == "main" {
                // branches always: never commit work onto the default branch
                r.put_string("result", if npaths > 0 { "refused_default_branch" } else { "clean_on_default" });
                r.put_int("paths", npaths);
                results.push_object(r);
                continue;
            }
            if branch == "(detached)" || branch.is_empty() {
                r.put_string("result", "detached");
                results.push_object(r);
                continue;
            }
            let mut did_commit = false;
            if npaths > 0 {
                let ar = crate::dev::git::write::write(n.clone(), "add".to_string(), sargs(&["-A"]));
                if !okr(&ar) {
                    r.put_string("result", "add_failed");
                    r.put_string("err", &errs(&ar));
                    results.push_object(r);
                    continue;
                }
                let cr = crate::dev::git::write::write(n.clone(), "commit".to_string(),
                    sargs(&["-m", &format!("autocommit: {} path(s) changed", npaths)]));
                if !okr(&cr) {
                    r.put_string("result", "commit_failed");
                    r.put_string("err", &errs(&cr));
                    results.push_object(r);
                    continue;
                }
                committed += 1;
                did_commit = true;
                r.put_int("paths", npaths);
            }
            r.put_string("result", if did_commit { "committed" } else { "clean" });
            // push: whenever the branch tracks a remote and holds anything unpushed
            if upstream.is_empty() {
                r.put_string("push", if has_origin { "unpublished" } else { "no_origin" });
            } else if did_commit || ahead > 0 {
                let p = crate::dev::git::remote_op::remote_op(n.clone(), "push".to_string(), sargs(&[]));
                if okr(&p) { pushed += 1; r.put_string("push", "pushed"); }
                else { r.put_string("push", "push_failed"); r.put_string("push_err", &errs(&p)); }
            } else {
                r.put_string("push", "in_sync");
            }
            results.push_object(r);
        }
    }
}
o.put_int("swept", swept);
o.put_int("committed", committed);
o.put_int("pushed", pushed);
o.put_int("fetched", fetched);
o.put_array("results", results);
o