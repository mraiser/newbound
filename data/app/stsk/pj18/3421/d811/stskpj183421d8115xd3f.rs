let store = DataStore::new();
let path = store.root.join(&lib);
if !path.exists() { let _ = fs::create_dir_all(&path).unwrap(); }

let mut meta = DataObject::new();
meta.put_str("username", "system");
meta.put_array("readers", readers);
meta.put_array("writers", writers);

let path2 = path.join("meta.json");
fs::write(path2, meta.to_string()).expect("Unable to write file");

load_library(&lib);
data::write::write(lib.to_owned(), "tasklists".to_string(), DataObject::new(), DataArray::new(), DataArray::new());

let mut controls = DataObject::new();
controls.put_array("list", DataArray::new());
data::write::write(lib.to_owned(), "controls".to_string(), controls, DataArray::new(), DataArray::new());

let path2 = path.join("_ASSETS");
let _ = fs::create_dir_all(&path2).unwrap();

"OK".to_string()