use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;

pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        crate_versions()
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

pub fn crate_versions() -> DataObject {
let mut out = DataObject::new();
let mut list = DataArray::new();
let mut root_fl = String::new();
let mut root_nd = String::new();
let mut mismatch = false;
let paths = manifest_paths();
let mut first = true;
for p in &paths {
  let content = std::fs::read_to_string(p).unwrap_or_default();
  let fl = read_dep_version(&content, "flowlang");
  let nd = read_dep_version(&content, "ndata");
  if first { root_fl = fl.clone(); root_nd = nd.clone(); first = false; }
  if (!fl.is_empty() && fl != root_fl) || (!nd.is_empty() && nd != root_nd) { mismatch = true; }
  let mut o = DataObject::new();
  o.put_string("path", &p.display().to_string());
  o.put_string("flowlang", &fl);
  o.put_string("ndata", &nd);
  list.push_object(o);
}
out.put_string("status", "ok");
out.put_string("flowlang", &root_fl);
out.put_string("ndata", &root_nd);
out.put_boolean("mismatch", mismatch);
out.put_array("manifests", list);
out
}

// ---- module-level helpers, shared with update_crates ----

// Is this line the DEPENDENCY line for `dep`? Matches `dep =` / `dep=` at line
// start (trimmed), which excludes feature entries like "flowlang/serde_support"
// (those appear on lines keyed by the feature name).
pub fn dep_line(line: &str, dep: &str) -> bool {
  let t = line.trim_start();
  if !t.starts_with(dep) { return false; }
  let rest = &t[dep.len()..];
  rest.starts_with(' ') || rest.starts_with('=')
}

// Span (inside the quotes) of the version-shaped quoted value on a dependency
// line, preferring the value after a `version` key. None when the quoted value
// is not version-shaped (e.g. a local `path = "../flowlang"` override) - such
// lines are left untouched and reported unpinned.
pub fn version_span(line: &str) -> Option<(usize, usize)> {
  let anchor = line.find("version").unwrap_or(0);
  let q1 = line[anchor..].find('"')? + anchor;
  let q2 = line[q1 + 1..].find('"')? + q1 + 1;
  let val = &line[q1 + 1..q2];
  let core = val.strip_prefix('=').unwrap_or(val);
  let mut chars = core.chars();
  match chars.next() { Some(c) if c.is_ascii_digit() => (), _ => return None }
  for c in chars { if !(c.is_ascii_alphanumeric() || c == '.' || c == '-') { return None; } }
  Some((q1 + 1, q2))
}

pub fn read_dep_version(content: &str, dep: &str) -> String {
  for line in content.lines() {
    if dep_line(line, dep) {
      if let Some((a, b)) = version_span(line) {
        return line[a..b].trim_start_matches('=').to_string();
      }
    }
  }
  String::new()
}

// Rewrite the pin, preserving each line's own style: a `=`-prefixed pin stays
// a `=` pin, a bare caret requirement stays bare. Returns (new content, changed).
pub fn rewrite_dep_version(content: &str, dep: &str, newver: &str) -> (String, bool) {
  let mut changed = false;
  let mut out = String::new();
  for line in content.lines() {
    if dep_line(line, dep) {
      if let Some((a, b)) = version_span(line) {
        let eq = line[a..b].starts_with('=');
        let nv = if eq { format!("={}", newver) } else { newver.to_string() };
        if &line[a..b] != nv.as_str() { changed = true; }
        out.push_str(&line[..a]);
        out.push_str(&nv);
        out.push_str(&line[b..]);
        out.push('\n');
        continue;
      }
    }
    out.push_str(line);
    out.push('\n');
  }
  (out, changed)
}

// Every manifest that must move in lockstep: the root workspace, newbound_core,
// the cmd crate when present, and every FFI crate root the store knows about
// (the same lib_crate_info walk the recompile subcommand uses).
pub fn manifest_paths() -> Vec<std::path::PathBuf> {
  let store = DataStore::new();
  let base = store.root.canonicalize().unwrap();
  let base = base.parent().unwrap().to_path_buf();
  let mut v: Vec<std::path::PathBuf> = Vec::new();
  v.push(base.join("Cargo.toml"));
  v.push(base.join("newbound_core").join("Cargo.toml"));
  let c = base.join("cmd").join("Cargo.toml");
  if c.exists() { v.push(c); }
  let mut libs: Vec<String> = Vec::new();
  if let Ok(entries) = std::fs::read_dir(&store.root) {
    for e in entries.flatten() {
      if e.path().is_dir() {
        if let Some(name) = e.file_name().to_str() {
          let (_r, ffi) = store.lib_crate_info(name);
          if ffi { libs.push(name.to_string()); }
        }
      }
    }
  }
  libs.sort();
  for lib in libs {
    let root = store.get_lib_root(&lib);
    let root = if root.is_absolute() { root } else { base.join(root) };
    let p = root.join("Cargo.toml");
    if p.exists() && !v.contains(&p) { v.push(p); }
  }
  v
}
