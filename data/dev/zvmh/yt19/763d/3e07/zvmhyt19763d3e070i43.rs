let path = DataStore::new().root.parent().unwrap().join("runtime").join("dev").join("plugins.json");
if !path.exists() { 
  return DataObject::new(); 
}
DataObject::from_string(&std::fs::read_to_string(&path).unwrap())