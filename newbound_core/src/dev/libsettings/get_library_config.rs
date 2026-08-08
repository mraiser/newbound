use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::datastore::DataStore;
use std::fs;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["id"] {
        if !o.has(p) {
            let mut e = DataObject::new();
            e.put_string("status", "err");
            e.put_string("msg", &format!("missing required parameter: {}", p));
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", e);
            return result_obj;
        }
    }
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        let arg_0: String = o.get_string("id");
        get_library_config(arg_0)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
            result_obj
        }
        Err(err) => {
            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");

            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic occurred".to_string()
            };

            err_obj.put_string("msg", &msg);
            // Wrapped in the same `a` envelope a successful return uses.
            // Unwrapped, callers that unpack the envelope (newbound's
            // format_result, for one) report an opaque 500 — "Not an object:
            // DString(\"err\")" — instead of this message.
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", err_obj);
            result_obj
        }
    }
}

pub fn get_library_config(id: String) -> DataObject {
    // 1. Validate the input id
    if id.is_empty() {
        panic!("Input id cannot be empty.");
    }
    let library_id = id;

    // 2. Construct path to meta.json
    let base_path = DataStore::new().root;
    let meta_json_path = base_path.join(&library_id).join("meta.json");

    // 3. Read and parse meta.json
    let meta_do = match fs::read_to_string(&meta_json_path) {
        Ok(json_content) => {
            DataObject::from_string(&json_content) // Panics on bad JSON
        }
        Err(e) => {
            panic!("Failed to read meta.json for library '{}' at {:?}: {}", library_id, meta_json_path, e);
        }
    };

    // 4. Prepare the response DataObject (flat structure for the frontend)
    let mut config_response_do = DataObject::new();
    config_response_do.put_string("id", &library_id);

    // Get "root" from top-level meta_do
    let root_str_output = if meta_do.has("root") {
        let root_prop = meta_do.get_property("root");
        if root_prop.is_string() {
            meta_do.get_string("root")
        } else {
            eprintln!("WARN: Top-level 'root' field in meta.json for '{}' is not a string. Defaulting.", library_id);
            String::default()
        }
    } else {
        eprintln!("WARN: Missing top-level 'root' field in meta.json for '{}'. Defaulting.", library_id);
        String::default()
    };
    config_response_do.put_string("root", &root_str_output); // Output as "root"

    // Extract settings from meta_do.cargo object
    // Note: library_root is no longer sourced from here.
    let mut ffi_output = false;   // cargo.ffi — see the read below
    let mut response_types_array_output = DataArray::new(); // Made mutable
    let mut dependencies_string_lines_output: Vec<String> = Vec::new();

    if meta_do.has("cargo") {
        let cargo_prop = meta_do.get_property("cargo");
        if cargo_prop.is_object() {
            let cargo_do = meta_do.get_object("cargo"); // cargo_do is a new handle

            // Get "ffi" from cargo.ffi — the flag that makes this library's
            // crate a hot-loadable dylib (and excludes it from the cargo
            // workspace). Absent means false; a non-boolean is reported false
            // rather than panicking the read.
            if cargo_do.has("ffi") {
                let ffi_prop = cargo_do.get_property("ffi");
                if ffi_prop.is_boolean() {
                    ffi_output = cargo_do.get_boolean("ffi");
                } else {
                    eprintln!("WARN: 'cargo.ffi' in meta.json for '{}' is not a boolean.", library_id);
                }
            }

            // Get "library_types" from cargo.crate_types
            if cargo_do.has("crate_types") {
                let crate_types_prop = cargo_do.get_property("crate_types");
                if crate_types_prop.is_array() {
                    let crate_types_da = cargo_do.get_array("crate_types");
                    for i in 0..crate_types_da.len() {
                        let item_prop = crate_types_da.get_property(i);
                        if item_prop.is_string() {
                            response_types_array_output.push_string(&crate_types_da.get_string(i));
                        } else {
                            eprintln!("WARN: Skipping non-string item in 'cargo.crate_types' for '{}' at index {}.", library_id, i);
                        }
                    }
                } else {
                    eprintln!("WARN: 'cargo.crate_types' in meta.json for '{}' is not an array.", library_id);
                }
            }

            // Get and reformat "library_dependencies" from cargo.dependencies
            if cargo_do.has("dependencies") {
                let deps_prop = cargo_do.get_property("dependencies");
                if deps_prop.is_object() {
                    let deps_do = cargo_do.get_object("dependencies");
                    let dep_keys = deps_do.clone().keys(); // Clone for .keys()
                    for key in dep_keys {
                        if deps_do.has(&key) {
                           let dep_val_prop = deps_do.get_property(&key);
                           if dep_val_prop.is_string() {
                               let value_str = deps_do.get_string(&key);
                               dependencies_string_lines_output.push(format!("{} = {}", key, value_str));
                           } else {
                               eprintln!("WARN: Dependency value for key '{}' in '{}' (cargo.dependencies) is not a string.", key, library_id);
                           }
                        }
                    }
                } else {
                    eprintln!("WARN: 'cargo.dependencies' in meta.json for '{}' is not an object.", library_id);
                }
            }
        } else {
            eprintln!("WARN: 'cargo' field in meta.json for '{}' is not an object. Cannot retrieve nested settings.", library_id);
        }
    } else {
        eprintln!("WARN: Missing 'cargo' field in meta.json for '{}'. Cannot retrieve settings like crate_types or dependencies.", library_id);
    }

    // library_root is already put as "root"
    config_response_do.put_boolean("ffi", ffi_output);
    config_response_do.put_array("library_types", response_types_array_output); // response_types_array_output is moved
    config_response_do.put_string("library_dependencies", &dependencies_string_lines_output.join("\n"));

    config_response_do // Return the populated DataObject (flat structure)
}
