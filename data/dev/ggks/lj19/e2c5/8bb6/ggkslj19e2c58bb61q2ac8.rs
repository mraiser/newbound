let store = DataStore::new();

// Read the master 'controls' list for the library
let controls_data = store.get_data(&lib, "controls").get_object("data");

// Check if the 'list' array exists
if controls_data.has("list") {
  let list: DataArray = controls_data.get_array("list");

  // Iterate through the array to find a matching name
  for i in 0..list.len() {
    let item: DataObject = list.get_object(i);

    if item.has("name") && item.get_string("name") == name {
      // Return the corresponding ID if a match is found
      if item.has("id") {
        return item.get_string("id");
      }
    }
  }
}

// Fallback: If not found, return the original input string
name.to_string()