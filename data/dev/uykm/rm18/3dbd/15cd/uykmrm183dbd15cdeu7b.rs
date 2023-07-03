let filename = lib + "_" + &version.to_string() + ".zip";
let file_path = DataStore::new().root.parent().unwrap().join("runtime").join("dev").join("libraries").join(&filename);

file_path.into_os_string().into_string().unwrap()