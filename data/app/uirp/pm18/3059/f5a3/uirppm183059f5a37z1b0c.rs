let store = DataStore::new();
let mut a = DataArray::new();

let p = store.root.join(&lib).join("_ASSETS");
for file in fs::read_dir(&p).unwrap() {
  let path = file.unwrap().path();
  let name:String = path.file_name().unwrap().to_str().unwrap().to_string();
  a.push_str(&name);
}
a