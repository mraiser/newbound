// Unregisters a repo from runtime/dev/repos.json. Registry-only: the
// working tree on disk is never touched. Same deterministic writer as set_repo.
fn fail(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}
fn esc(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}
fn repos_file(entries: &DataObject) -> String {
    let known = ["path", "origin", "role"];
    let mut names = entries.get_keys();
    names.sort();
    let mut out = String::from("{");
    let mut first = true;
    for n in &names {
        if !first { out.push(','); }
        first = false;
        out.push_str(&format!("\n  \"{}\": {{", esc(n)));
        let e = entries.get_object(n);
        let mut ffirst = true;
        for f in &known {
            if e.has(f) {
                if !ffirst { out.push(','); }
                ffirst = false;
                out.push_str(&format!("\n    \"{}\": \"{}\"", f, esc(&e.get_string(f))));
            }
        }
        out.push_str("\n  }");
    }
    if first { out.push_str("}\n"); } else { out.push_str("\n}\n"); }
    out
}
let _ = author;
let _ = nn_sessionid;

let name = name.trim().to_string();
let regpath = DataStore::new().root.parent().unwrap()
    .join("runtime").join("dev").join("repos.json");
if !regpath.exists() {
    return fail("no repo registry at runtime/dev/repos.json");
}
let entries = match DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap()) {
    Ok(e) => e,
    Err(_) => return fail(&format!("{} is not valid JSON - fix it by hand before writing through the API", regpath.display())),
};
if !entries.has(&name) {
    return fail(&format!("no repo named '{}' in the registry", name));
}
let mut kept = DataObject::new();
for k in entries.get_keys() {
    if k != name { kept.put_object(&k, entries.get_object(&k)); }
}
std::fs::write(&regpath, repos_file(&kept)).unwrap();

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("removed", &name);
o.put_int("remaining", kept.get_keys().len() as i64);
o