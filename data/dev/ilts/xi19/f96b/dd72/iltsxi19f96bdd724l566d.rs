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