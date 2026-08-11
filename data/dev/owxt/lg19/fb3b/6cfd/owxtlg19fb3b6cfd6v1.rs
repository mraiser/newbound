// An empty author defaults to the calling session's user — the platform
// injects nn_sessionid into params on every web call (HTTP and websocket
// alike); CLI/MCP callers that want a specific provenance name pass author.
let author = {
    let a = author.trim().to_string();
    if !a.is_empty() { a } else {
        let mut who = String::new();
        if !nn_sessionid.is_empty() {
            let system = flowlang::datastore::DataStore::globals().get_object("system");
            if system.has("sessions") {
                let sessions = system.get_object("sessions");
                if sessions.has(&nn_sessionid) {
                    let session = sessions.get_object(&nn_sessionid);
                    if session.has("user") {
                        who = session.get_object("user").try_get_string("displayname").unwrap_or_default();
                    }
                    if who.trim().is_empty() {
                        who = session.try_get_string("username").unwrap_or_default();
                    }
                }
            }
        }
        if who.trim().is_empty() { "anonymous".to_string() } else { who }
    }
};

// Replace-only (the Q7 setter idiom, set_timer/remove_timer): a set wholly
// replaces the named registration entry in runtime/dev/plugins.json — the
// per-instance file dev.plugins.list_plugins reads (the config.properties
// precedent). Unjournaled like set_meta_identity: runtime state has no
// _patches home; the canonical repo's git history is the record. `author`
// is accepted for symmetry with every other mutation. The write is a
// deterministic 2-space layout with entries sorted by name (ndata objects
// are hash-backed, so a parse loses file order anyway) — a hand-edited
// file and a command-written one diff cleanly.
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
fn leaf(d: Data) -> String {
    match d {
        Data::DString(s) => format!("\"{}\"", esc(&s)),
        other => {
            // Not part of the five-field shape, but the file is the user's —
            // whatever else is there rides through ndata's own serializer.
            let mut a = DataArray::new();
            a.push_property(other);
            let s = a.to_string();
            s[1..s.len() - 1].to_string()
        }
    }
}
fn plugins_file(entries: &DataObject) -> String {
    let known = ["target_lib", "target_ctl", "plugin_lib", "plugin_ctl", "selector"];
    let mut names = entries.get_keys();
    names.sort();
    let mut out = String::from("{");
    let mut first = true;
    for n in &names {
        if !first { out.push(','); }
        first = false;
        match entries.try_get_object(n) {
            Ok(e) => {
                out.push_str(&format!("\n  \"{}\": {{", esc(n)));
                let mut fields: Vec<String> =
                    known.iter().filter(|k| e.has(k)).map(|s| s.to_string()).collect();
                let mut extra: Vec<String> = e.get_keys().into_iter()
                    .filter(|k| !known.contains(&k.as_str())).collect();
                extra.sort();
                fields.extend(extra);
                let mut ffirst = true;
                for f in &fields {
                    if !ffirst { out.push(','); }
                    ffirst = false;
                    out.push_str(&format!("\n    \"{}\": {}", esc(f), leaf(e.get_property(f))));
                }
                out.push_str("\n  }");
            }
            Err(_) => out.push_str(&format!("\n  \"{}\": {}", esc(n), leaf(entries.get_property(n)))),
        }
    }
    if first { out.push_str("}\n"); } else { out.push_str("\n}\n"); }
    out
}

let _author = author;
let name = name.trim().to_string();
for (v, what) in [(&name, "name"), (&target_lib, "target_lib"), (&target_ctl, "target_ctl"),
                  (&plugin_lib, "plugin_lib"), (&plugin_ctl, "plugin_ctl"), (&selector, "selector")] {
    if v.trim().is_empty() {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("'{}' must not be empty", what));
        return o;
    }
}

let path = DataStore::new().root.parent().unwrap()
    .join("runtime").join("dev").join("plugins.json");
let mut entries = if path.exists() {
    match DataObject::try_from_string(&std::fs::read_to_string(&path).unwrap()) {
        Ok(e) => e,
        Err(_) => {
            let mut o = DataObject::new();
            o.put_string("status", "err");
            o.put_string("msg", &format!("{} is not valid JSON - fix it by hand before writing through the API", path.display()));
            return o;
        }
    }
} else {
    DataObject::new()
};

let existed = entries.has(&name);
let mut e = DataObject::new();
e.put_string("target_lib", target_lib.trim());
e.put_string("target_ctl", target_ctl.trim());
e.put_string("plugin_lib", plugin_lib.trim());
e.put_string("plugin_ctl", plugin_ctl.trim());
e.put_string("selector", selector.trim());
entries.put_object(&name, e);

std::fs::create_dir_all(path.parent().unwrap()).unwrap();
std::fs::write(&path, plugins_file(&entries)).unwrap();

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("created", !existed);
o.put_string("name", &name);
o
