// 1. Fetch the command's primary metadata object
let mut cmd_meta = app_read(lib.clone(), cmd_id.clone(), nn_sessionid.clone()).get_object("data");

// Ensure the metadata knows its language type
cmd_meta.put_string("type", &lang);

// 2. Identify (or generate) the ID for the actual source code object
let source_id = if cmd_meta.has(&lang) {
  cmd_meta.get_string(&lang)
} else {
  let new_id = unique_session_id();
  cmd_meta.put_string(&lang, &new_id);
  new_id
};

// 3. Build the source code object (the 'cmddata' from the JS)
let mut source_obj = DataObject::new();
source_obj.put_string("type", &lang);

// Rust stores code under "rs", others use their name
let code_key = if lang == "rust" { "rs" } else { &lang };
source_obj.put_string(code_key, &code);

source_obj.put_string("import", &imports);
source_obj.put_string("returntype", &returntype);
source_obj.put_string("desc", &desc);
source_obj.put_array("params", params); // Move the params array in

let mut attachment_keys = DataArray::new();
attachment_keys.push_string(code_key);
source_obj.put_array("attachmentkeynames", attachment_keys);

if !groups.is_empty() {
  source_obj.put_string("groups", &groups);
}

// 4. Save the source code object
app_write(lib.clone(), DString(source_id), source_obj, DArray(readers.data_ref), DNull, nn_sessionid.clone());

// 5. Save the updated metadata object
app_write(lib.clone(), DString(cmd_id), cmd_meta, DArray(readers.data_ref), DNull, nn_sessionid);

"Command saved successfully".to_string()