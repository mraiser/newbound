let path = DataStore::new().root.parent().unwrap().join("runtime").join(&app);
let _x = fs::remove_dir_all(path).unwrap();
"OK".to_string()