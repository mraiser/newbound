let store = DataStore::new();
let path = store.root.join(&lib);
if path.exists() { let _ = fs::remove_dir_all(&path).unwrap(); }
init_globals();
"OK".to_string()