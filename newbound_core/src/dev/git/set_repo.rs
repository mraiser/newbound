use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use flowlang::flowlang::system::system_call::system_call;
use ndata::dataarray::DataArray;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["name", "path", "origin", "role", "autocommit", "author", "nn_sessionid"] {
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
        let arg_1: String = o.get_string("path");
        let arg_2: String = o.get_string("origin");
        let arg_3: String = o.get_string("role");
        let arg_4: bool = o.get_boolean("autocommit");
        let arg_5: String = o.get_string("author");
        let arg_6: String = o.get_string("nn_sessionid");
        set_repo(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6)
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

pub fn set_repo(name: String, path: String, origin: String, role: String, autocommit: bool, author: String, nn_sessionid: String) -> DataObject {
// Replace-only, keyed on name (the Q7 setter idiom, set_plugin precedent).
// runtime/dev/repos.json is per-instance local state - unjournaled like
// plugins.json; `author` rides for symmetry with every other mutation.
// Deterministic sorted-name layout so hand edits and command writes diff cleanly.
// autocommit=true marks the repo for the dev.git.autocommit_sweep timer
// (imported/created library repos default on; canon and overlay stay off).
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
        // the one non-string field; stored only when on, absent means off
        if e.has("autocommit") {
            if let Ok(true) = e.try_get_boolean("autocommit") {
                if !ffirst { out.push(','); }
                out.push_str("\n    \"autocommit\": true");
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
if name.is_empty() || name.contains('/') || name.contains(char::is_whitespace) {
    return fail("name must be non-empty, with no '/' or whitespace");
}
let role = role.trim().to_string();
if role != "canon" && role != "overlay" && role != "library" && role != "foreign" {
    return fail("role must be one of: canon | overlay | library | foreign");
}
let path = match std::fs::canonicalize(path.trim()) {
    Ok(p) => p.to_string_lossy().to_string(),
    Err(_) => return fail(&format!("path '{}' does not exist", path.trim())),
};
let mut a = DataArray::new();
for s in ["git", "-C", path.as_str(), "rev-parse", "--git-dir"] { a.push_string(s); }
let r = system_call(a);
if r.try_get_string("status").unwrap_or_default() != "ok" {
    return fail(&format!("'{}' is not a git repository: {}", path,
        r.try_get_string("err").unwrap_or_default().trim()));
}
let mut origin = origin.trim().to_string();
if origin.is_empty() {
    let mut b = DataArray::new();
    for s in ["git", "-C", path.as_str(), "remote", "get-url", "origin"] { b.push_string(s); }
    let rr = system_call(b);
    if rr.try_get_string("status").unwrap_or_default() == "ok" {
        origin = rr.try_get_string("out").unwrap_or_default().trim().to_string();
    }
}

let regpath = DataStore::new().root.parent().unwrap()
    .join("runtime").join("dev").join("repos.json");
let mut entries = if regpath.exists() {
    match DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap()) {
        Ok(e) => e,
        Err(_) => return fail(&format!("{} is not valid JSON - fix it by hand before writing through the API", regpath.display())),
    }
} else {
    DataObject::new()
};
let existed = entries.has(&name);
let mut e = DataObject::new();
e.put_string("path", &path);
e.put_string("origin", &origin);
e.put_string("role", &role);
if autocommit { e.put_boolean("autocommit", true); }
entries.put_object(&name, e);
std::fs::create_dir_all(regpath.parent().unwrap()).unwrap();
std::fs::write(&regpath, repos_file(&entries)).unwrap();

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("created", !existed);
o.put_string("name", &name);
o.put_string("path", &path);
o.put_string("origin", &origin);
o.put_string("role", &role);
o.put_boolean("autocommit", autocommit);
o
}
