use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib"] {
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
        let arg_0: String = o.get_string("lib");
        list_assets(arg_0)
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

pub fn list_assets(lib: String) -> DataObject {
let store = DataStore::new();
let libdir = store.root.join(&lib);
if !libdir.exists() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Library '{}' not found", lib));
    return o;
}

// Recursive walk of data/<lib>/_ASSETS; names are relative paths with '/'
// separators (subdirectories serve fine via app/asset). A missing _ASSETS
// folder is a normal state: no assets yet.
let base = libdir.join("_ASSETS");
let mut assets = DataArray::new();
if base.exists() {
    let mut stack = vec![base.clone()];
    while let Some(dir) = stack.pop() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                    continue;
                }
                let rel = match path.strip_prefix(&base) {
                    Ok(r) => r.to_string_lossy().replace('\\', "/"),
                    Err(_) => continue,
                };
                let mut item = DataObject::new();
                item.put_string("name", &rel);
                match std::fs::metadata(&path) {
                    Ok(md) => {
                        item.put_int("size", md.len() as i64);
                        let ms = md.modified().ok()
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_millis() as i64)
                            .unwrap_or(0);
                        item.put_int("time", ms);
                    }
                    Err(_) => {
                        item.put_int("size", 0);
                        item.put_int("time", 0);
                    }
                }
                assets.push_object(item);
            }
        }
    }
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_array("assets", assets);
o
}
