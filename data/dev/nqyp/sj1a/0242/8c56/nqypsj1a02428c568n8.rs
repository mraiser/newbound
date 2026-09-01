// Internal engine for dev.git.{read,write,remote_op}: registry resolve,
// per-mode verb allowlist, argv build, one system_call. No shell, ever -
// argv form only, so nothing is interpolated.
fn fail(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}
// git availability: one cached PATH scan per process - no spawn, so a
// git-less box gets a plain answer instead of a spawn failure. (Installing
// git while the instance runs needs a restart to be noticed.)
let mut globals = DataStore::globals();
let gitok = if globals.has("GIT_AVAILABLE") { globals.get_boolean("GIT_AVAILABLE") } else {
    let ok = std::env::var("PATH").unwrap_or_default().split(':')
        .any(|d| !d.is_empty() && std::path::Path::new(d).join("git").is_file());
    globals.put_boolean("GIT_AVAILABLE", ok);
    ok
};
if !gitok {
    return fail("git is not installed (no 'git' on PATH) - dev.git is inert without it");
}
let regpath = DataStore::new().root.parent().unwrap()
    .join("runtime").join("dev").join("repos.json");
if !regpath.exists() {
    return fail("no repo registry at runtime/dev/repos.json - register repos with dev.git.set_repo");
}
let reg = match DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap()) {
    Ok(o) => o,
    Err(_) => return fail("runtime/dev/repos.json is not valid JSON - fix it by hand before using dev.git"),
};
let repo = repo.trim().to_string();
if !reg.has(&repo) {
    return fail(&format!("unknown repo '{}' - dev.git.repos lists registered repos; dev.git.set_repo adds one", repo));
}
let path = match reg.get_object(&repo).try_get_string("path") {
    Ok(p) if !p.trim().is_empty() => p,
    _ => return fail(&format!("registry entry '{}' has no path", repo)),
};

let verb = verb.trim().to_string();
let allowed: &[&str] = match mode.as_str() {
    "read" => &["status","log","diff","show","rev-parse","rev-list","branch","ls-files","blame","describe","remote"],
    "write" => &["add","commit","checkout","branch","merge","tag","stash","reset","revert"],
    "remote" => &["fetch","pull","push"],
    _ => return fail(&format!("unknown mode '{}'", mode)),
};
if !allowed.contains(&verb.as_str()) {
    return fail(&format!("verb '{}' is not in the {} allowlist: {}", verb, mode, allowed.join(", ")));
}

let mut extra: Vec<String> = Vec::new();
for d in args.objects() {
    match d {
        Data::DString(s) => extra.push(s),
        _ => return fail("args must be an array of strings (one git argument per element)"),
    }
}

// read stays read: branch and remote are listing-only in read mode.
if mode == "read" {
    if verb == "branch" && extra.iter().any(|a| !a.starts_with('-')) {
        return fail("dev.git.read branch takes only flags (listing); branch creation and deletion are dev.git.write");
    }
    if verb == "remote" && !extra.is_empty() {
        let first = extra[0].as_str();
        if first != "-v" && first != "show" && first != "get-url" {
            return fail("dev.git.read remote allows only -v, show, get-url; remote config changes are not exposed");
        }
    }
}

// pull is fast-forward-only unless the caller states a strategy -
// the dev.github.update precedent: error rather than merge on divergence.
if mode == "remote" && verb == "pull"
    && !extra.iter().any(|a| a == "--ff-only" || a == "--ff" || a == "--no-ff" || a == "--rebase" || a.starts_with("--rebase=")) {
    extra.insert(0, "--ff-only".to_string());
}

let mut argv: Vec<String> = vec![
    "git".to_string(), "--no-optional-locks".to_string(), "-C".to_string(), path.clone(),
];

// commit needs an identity; fall back to a neutral one when the repo has none,
// rather than surfacing git's config lecture as a mystery failure.
if verb == "commit" {
    let mut ca = DataArray::new();
    for s in ["git", "-C", path.as_str(), "config", "user.email"] { ca.push_string(s); }
    let cr = system_call(ca);
    if cr.try_get_string("out").unwrap_or_default().trim().is_empty() {
        argv.push("-c".to_string()); argv.push("user.name=Newbound Agent".to_string());
        argv.push("-c".to_string()); argv.push("user.email=newbound-agent@localhost".to_string());
    }
}

argv.push(verb.clone());
argv.extend(extra);

let mut a = DataArray::new();
for s in &argv { a.push_string(s); }
let mut r = system_call(a);
r.put_string("repo", &repo);
r.put_string("path", &path);
r.put_string("argv", &argv.join(" "));
r