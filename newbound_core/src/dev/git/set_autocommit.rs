use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["name", "autocommit"] {
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
        let arg_1: bool = o.get_boolean("autocommit");
        set_autocommit(arg_0, arg_1)
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

pub fn set_autocommit(name: String, autocommit: bool) -> DataObject {
// Turn one repo's autocommit flag on or off — the per-row toggle the panel and an
// agent share, lighter than a full set_repo replace. Reads the registry, flips only
// the flag on the named entry, and rewrites repos.json in the same deterministic
// sorted layout set_repo uses so hand edits and command writes diff cleanly. The
// 5-minute sweep honors it on its next pass; no restart. Returns {name, autocommit}.
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
        if let Ok(true) = e.try_get_boolean("autocommit") {
            if !ffirst { out.push(','); }
            out.push_str("\n    \"autocommit\": true");
        }
        out.push_str("\n  }");
    }
    if first { out.push_str("}\n") } else { out.push_str("\n}\n") }
    out
}
let name = name.trim().to_string();
if name.is_empty() { return fail("name is required"); }
let regpath = DataStore::new().root.parent().unwrap()
    .join("runtime").join("dev").join("repos.json");
if !regpath.exists() { return fail("no repo registry — register repos with dev.git.set_repo"); }
let mut reg = match DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap()) {
    Ok(o) => o,
    Err(_) => return fail("repos.json is not valid JSON"),
};
if !reg.has(&name) { return fail(&format!("unknown repo '{}'", name)); }
let mut e = reg.get_object(&name);
if autocommit { e.put_boolean("autocommit", true); }
else if e.has("autocommit") { let _ = e.remove_property("autocommit"); }
reg.put_object(&name, e);
if let Err(err) = std::fs::write(&regpath, repos_file(&reg)) {
    return fail(&format!("write failed: {}", err));
}
let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("name", &name);
o.put_boolean("autocommit", autocommit);
o.put_string("msg", &format!("{} autocommit {}", name, if autocommit { "on" } else { "off" }));
o
}
