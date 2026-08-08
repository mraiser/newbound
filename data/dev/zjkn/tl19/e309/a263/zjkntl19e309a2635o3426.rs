// 1. Fetch the command metadata to find the source code ID
let cmd_meta = app_read(lib.clone(), cmd_id.clone(), nn_sessionid.clone()).get_object("data");

// Determine the current language to find the source code reference
if cmd_meta.has("type") {
  let lang = cmd_meta.get_string("type");
  if cmd_meta.has(&lang) {
    let source_id = cmd_meta.get_string(&lang);
    // DELETE 1: Clean up the actual source code object!
    app_delete(lib.clone(), source_id.clone(), nn_sessionid.clone());
  }
}

// DELETE 2: Clean up the command metadata
app_delete(lib.clone(), cmd_id.clone(), nn_sessionid.clone());

// 3. Unlink from the Parent Control
let mut parent = app_read(lib.clone(), control_id.clone(), nn_sessionid.clone()).get_object("data");
if parent.has("cmd") {
  let cmd_list = parent.get_array("cmd");
  let mut new_cmd_list = DataArray::new();

  // Rebuild the array, skipping the deleted command
  for i in 0..cmd_list.len() {
    let item = cmd_list.get_object(i);
    if item.get_string("id") != cmd_id {
      new_cmd_list.push_object(item);
    }
  }

  // Replace the old array with the newly filtered one
  parent.put_array("cmd", new_cmd_list);

  // Save the parent
  app_write(lib.clone(), DString(control_id), parent, DNull, DNull, nn_sessionid);
}

"Command deleted successfully".to_string()