// Path traversal guard: the library name and asset path come straight from
// the URL. Refuse any ".." component (raw or percent-encoded) and any
// malformed path with an empty file path (an empty answer), so nothing
// outside data/<lib>/_ASSETS/ can be named.
if nn_path.len() < 12 || !nn_path.is_char_boundary(11) { return "".to_string(); }
let p = &nn_path[11..];
if !path_is_safe(p) || !path_is_safe(&hex_decode(p.to_string())) { return "".to_string(); }
let x = match p.find("/") { Some(x) => x, None => return "".to_string() };
let app = &p[..x];
if app.is_empty() { return "".to_string(); }
let p = &p[x..];
let root = DataStore::new().root;
let root = root.join(app);
let root = root.join("_ASSETS");
let root = root.into_os_string().into_string().unwrap();
let p = root + p;
p.to_string()