use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["name", "author", "nn_sessionid"] {
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
        let arg_0: String = o.get_string("name");
        let arg_1: String = o.get_string("author");
        let arg_2: String = o.get_string("nn_sessionid");
        remove_repo(arg_0, arg_1, arg_2)
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

pub fn remove_repo(name: String, author: String, nn_sessionid: String) -> DataObject {
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
}
