// The one state sentence per repo the panel renders: where the branch stands
// against its upstream AND against origin/<default> - the number the owner
// asked for ("do I have work master has never seen? has master moved?").
// Read-only apart from the optional fetch --prune, which is what makes the
// numbers real rather than as-of-the-last-click.
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
let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("repo", &repo);

// origin present? (a repo with no remote still gets a local-only answer)
let has_origin = {
    let r = crate::dev::git::read::read(repo.clone(), "remote".to_string(), sargs(&["get-url", "origin"]));
    okr(&r) && !outs(&r).trim().is_empty()
};
o.put_boolean("has_origin", has_origin);

// 1. fetch (optional, non-fatal: offline just means the numbers are as of the last fetch)
let mut fetched = false;
let mut fetch_err = String::new();
if fetch && has_origin {
    let r = crate::dev::git::remote_op::remote_op(repo.clone(), "fetch".to_string(), sargs(&["--prune"]));
    if okr(&r) { fetched = true; } else { fetch_err = errs(&r); }
}
o.put_boolean("fetched", fetched);
o.put_string("fetch_err", &fetch_err);

// 2. status --porcelain=v2 --branch
let st = crate::dev::git::read::read(repo.clone(), "status".to_string(), sargs(&["--porcelain=v2", "--branch"]));
if !okr(&st) { return fail(&format!("status failed: {}", errs(&st))); }
let mut branch = String::new();
let mut upstream = String::new();
let (mut ahead, mut behind, mut changes, mut untracked, mut conflicts) = (0i64, 0i64, 0i64, 0i64, 0i64);
for line in outs(&st).lines() {
    if let Some(h) = line.strip_prefix("# branch.head ") { branch = h.trim().to_string(); }
    else if let Some(u) = line.strip_prefix("# branch.upstream ") { upstream = u.trim().to_string(); }
    else if let Some(ab) = line.strip_prefix("# branch.ab ") {
        for tok in ab.split_whitespace() {
            if let Some(n) = tok.strip_prefix('+') { ahead = n.parse().unwrap_or(0); }
            else if let Some(n) = tok.strip_prefix('-') { behind = n.parse().unwrap_or(0); }
        }
    }
    else if line.starts_with("? ") { untracked += 1; }
    else if line.starts_with("u ") { conflicts += 1; changes += 1; }
    else if line.starts_with("1 ") || line.starts_with("2 ") { changes += 1; }
}
let detached = branch == "(detached)" || branch.is_empty();

// 3. default branch: local master, else main
let lb = crate::dev::git::read::read(repo.clone(), "branch".to_string(), sargs(&["--format=%(refname:short)"]));
let locals: Vec<String> = outs(&lb).lines().map(|l| l.trim().to_string()).filter(|s| !s.is_empty()).collect();
let default = if locals.iter().any(|b| b == "master") { "master".to_string() }
    else if locals.iter().any(|b| b == "main") { "main".to_string() }
    else { String::new() };
let remote_default = if !default.is_empty() && has_origin && ref_exists(&repo, &format!("refs/remotes/origin/{}", default)) {
    format!("origin/{}", default)
} else { String::new() };
let base = if !remote_default.is_empty() { remote_default.clone() } else { default.clone() };

// 4. the branch against the base: commits here not in base / commits in base not here
let (mut ahead_base, mut behind_base) = (0i64, 0i64);
if !base.is_empty() && !detached && branch != base {
    let r = crate::dev::git::read::read(repo.clone(), "rev-list".to_string(), sargs(&["--left-right", "--count", &format!("HEAD...{}", base)]));
    if okr(&r) {
        let t = outs(&r);
        let mut it = t.split_whitespace();
        ahead_base = it.next().and_then(|s| s.parse().ok()).unwrap_or(0);
        behind_base = it.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    }
}

// 5. an operation in flight?
let op = if ref_exists(&repo, "MERGE_HEAD") { "merge" }
    else if ref_exists(&repo, "REBASE_HEAD") { "rebase" }
    else if ref_exists(&repo, "CHERRY_PICK_HEAD") { "cherry-pick" }
    else { "" };

let on_default = !default.is_empty() && branch == default;
let published = !upstream.is_empty();
let dirty = changes + untracked;
let clean = dirty == 0 && op.is_empty();

// 6. the sentence
let mut parts: Vec<String> = Vec::new();
parts.push(if detached { "detached HEAD".to_string() } else { branch.clone() });
if !op.is_empty() { parts.push(format!("mid-{}", op)); }
if conflicts > 0 { parts.push(format!("{} conflicted", conflicts)); }
parts.push(if dirty > 0 { format!("{} uncommitted", dirty) } else { "clean".to_string() });
if !detached {
    if !has_origin { parts.push("no origin".to_string()); }
    else if !published { parts.push("unpublished".to_string()); }
    else {
        let mut s: Vec<String> = Vec::new();
        if ahead > 0 { s.push(format!("{} to push", ahead)); }
        if behind > 0 { s.push(format!("{} behind {}", behind, upstream)); }
        if s.is_empty() { parts.push("pushed".to_string()); } else { parts.extend(s); }
    }
    if on_default {
        parts.push(format!("on {} - work belongs on a branch", default));
    } else if !base.is_empty() {
        parts.push(if ahead_base > 0 { format!("{} not in {}", ahead_base, default) } else { "nothing to merge".to_string() });
        parts.push(if behind_base > 0 { format!("{} moved +{}", default, behind_base) } else { format!("{} unchanged", default) });
    }
}
if fetch && has_origin && !fetched { parts.push("fetch failed - numbers as of the last fetch".to_string()); }

o.put_string("branch", &branch);
o.put_boolean("detached", detached);
o.put_string("upstream", &upstream);
o.put_boolean("published", published);
o.put_int("ahead", ahead);
o.put_int("behind", behind);
o.put_int("changes", changes);
o.put_int("untracked", untracked);
o.put_int("conflicts", conflicts);
o.put_int("dirty", dirty);
o.put_boolean("clean", clean);
o.put_string("op", op);
o.put_string("default", &default);
o.put_string("base", &base);
o.put_boolean("on_default", on_default);
o.put_int("ahead_base", ahead_base);
o.put_int("behind_base", behind_base);
o.put_boolean("needs_update", behind_base > 0 && !on_default);
o.put_boolean("can_merge", ahead_base > 0 && clean && !on_default && !detached && !default.is_empty());
o.put_string("summary", &parts.join(" · "));
o