// 1. Extract required 'id' (library_name)
let library_id = if data.has("id") {
  let id_prop = data.get_property("id");
  if id_prop.is_string() {
    data.get_string("id") // Returns String
  } else {
    panic!("Field 'id' is not a string.");
  }
} else {
  panic!("Missing 'id' (library_name) in input data.");
};

if library_id.is_empty() {
  panic!("'id' (library_name) cannot be empty.");
}

// 2. Extract other fields from input data (which is flat)
// The input 'library_root' will be saved as top-level 'root' in meta.json
let library_root_input = if data.has("library_root") { // This is the "library_root" from the UI/input
  let prop = data.get_property("library_root");
  if prop.is_string() {
    data.get_string("library_root")
  } else {
    eprintln!("WARN: Input 'library_root' is present but not a string for id '{}'. Defaulting.", library_id);
    String::default()
  }
} else {
  String::default()
};

let library_dependencies_str_input = if data.has("library_dependencies") {
  let prop = data.get_property("library_dependencies");
  if prop.is_string() {
    data.get_string("library_dependencies")
  } else {
    eprintln!("WARN: Input 'library_dependencies' is present but not a string for id '{}'. Defaulting.", library_id);
    String::default()
  }
} else {
  String::default()
};

// 3. Construct path
let base_path = DataStore::new().root;
let meta_json_path = base_path.join(&library_id).join("meta.json");

// 4. Read meta.json or create a new DataObject if it doesn't exist
let mut meta_do = match fs::read_to_string(&meta_json_path) {
  Ok(json_content) => {
    DataObject::from_string(&json_content) // Panics on bad JSON
  }
  Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => {
    let mut new_obj = DataObject::new();
    new_obj.put_string("id", &library_id); // Ensure new meta.json has top-level id
    new_obj
  }
  Err(e) => {
    panic!("Failed to read meta.json for '{}' at {:?}: {}", library_id, meta_json_path, e);
  }
};

// 5. Modify meta_do:
// Save the library root to the top-level "root" field
meta_do.put_string("root", &library_root_input);

// Get or create the 'cargo' object within meta_do for other settings
let mut cargo_do = if meta_do.has("cargo") {
  let cargo_prop = meta_do.get_property("cargo");
  if cargo_prop.is_object() {
    meta_do.get_object("cargo")
  } else {
    eprintln!("WARN: 'cargo' field in meta.json for '{}' is not an object. Recreating.", library_id);
    DataObject::new()
  }
} else {
  DataObject::new()
};

// Prepare and put library_types into cargo_do (e.g., cargo.crate_types)
let mut types_array_input = DataArray::new();
if data.has("library_types") {
  let types_prop = data.get_property("library_types");
  if types_prop.is_array() {
    let input_types_da = data.get_array("library_types");
    for i in 0..input_types_da.len() {
      let item_prop = input_types_da.get_property(i);
      if item_prop.is_string() {
        types_array_input.push_string(&input_types_da.get_string(i));
      } else {
        eprintln!("WARN: Skipping non-string item in input 'library_types' for '{}' at index {}", library_id, i);
      }
    }
  } else {
    eprintln!("WARN: Input 'library_types' field for '{}' is not an array.", library_id);
  }
}
cargo_do.put_array("crate_types", types_array_input); // types_array_input is moved

// Prepare and put dependencies into cargo_do
let mut new_deps_do = DataObject::new();
for line in library_dependencies_str_input.lines() {
  let trimmed_line = line.trim();
  if trimmed_line.is_empty() || trimmed_line.starts_with('#') {
    continue;
  }
  let parts: Vec<&str> = trimmed_line.splitn(2, '=').collect();
  if parts.len() == 2 {
    let key = parts[0].trim();
    let value_str = parts[1].trim();
    if !key.is_empty() {
      new_deps_do.put_string(key, value_str);
    }
  } else {
    eprintln!("WARN: Skipping malformed dependency line in input for '{}': {}", library_id, trimmed_line);
  }
}
cargo_do.put_object("dependencies", new_deps_do); // new_deps_do is moved

// Put the modified cargo_do back into meta_do
meta_do.put_object("cargo", cargo_do); // cargo_do is moved

// 6. Serialize meta_do
let output_json_string = meta_do.to_string();

// 7. Write to file
if let Some(parent_dir) = meta_json_path.parent() {
  if !parent_dir.exists() {
    if let Err(e) = fs::create_dir_all(parent_dir) {
      panic!("Failed to create directory for meta.json at {:?}: {}", parent_dir, e);
    }
  }
} else {
  panic!("Invalid path configuration for meta.json at {:?}", meta_json_path);
}

match fs::write(&meta_json_path, output_json_string) {
  Ok(_) => {
    let mut success_payload = DataObject::new();
    success_payload.put_string("id", &library_id);
    success_payload.put_string("action_status", "saved");
    success_payload.put_string("message", &format!("Library settings for '{}' saved successfully.", library_id));
    success_payload
  }
  Err(e) => {
    panic!("Failed to write meta.json for '{}' at {:?}: {}", library_id, meta_json_path, e);
  }
}