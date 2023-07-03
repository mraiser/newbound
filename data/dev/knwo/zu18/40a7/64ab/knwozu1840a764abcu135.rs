let filename = lib + ".json";
let file_path = DataStore::new().root.parent().unwrap().join("runtime").join("dev").join("libraries").join(&filename);
let json = fs::read_to_string(file_path).expect("Should have been able to read the file");
DataObject::from_string(&json)