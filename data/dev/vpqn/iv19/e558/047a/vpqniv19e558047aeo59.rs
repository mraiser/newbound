let store = DataStore::new();
let real_id = lookup_id(lib.clone(), ctl.clone());
let control_data = store.get_data(&lib, &real_id).get_object("data");
if control_data.has("cmd") {
  let list: DataArray = control_data.get_array("cmd");
  for i in 0..list.len() {
    let item: DataObject = list.get_object(i);

    if item.has("name") && item.get_string("name") == cmd {
      // Return the corresponding ID if a match is found
      if item.has("id") {
        return item.get_string("id");
      }
    }
  }
}

// Fallback: If not found, return the original input string
cmd.to_string()
