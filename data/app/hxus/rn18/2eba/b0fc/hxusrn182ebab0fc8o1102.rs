let root = DataStore::new().root;
let p = &nn_path[11..];
let x = p.find("/").unwrap();
let app = &p[..x];
let p = &p[x..];
let root = root.join(app);
let root = root.join("_ASSETS");
let root = root.into_os_string().into_string().unwrap();
let p = root + p;
p.to_string()