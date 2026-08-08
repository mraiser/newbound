let mut ctl_data = app_read(lib.clone(), id.clone(), nn_sessionid.clone()).get_object("data");

// Update primitive string fields
ctl_data.put_string("html", &html);
ctl_data.put_string("css", &css);
ctl_data.put_string("js", &js);
ctl_data.put_string("groups", &groups);
ctl_data.put_string("desc", &desc);

let mut attachment_keys = DataArray::new();
attachment_keys.push_string("html");
attachment_keys.push_string("css");
attachment_keys.push_string("js");
ctl_data.put_array("attachmentkeynames", attachment_keys);

// Extract existing inline data mapping or create new
let existing_data_list = if ctl_data.has("data") {
  ctl_data.get_array("data")
} else {
  DataArray::new()
};

let mut new_data_list = DataArray::new();
let mut nowriters = DataArray::new();

// Iterate over the nested ndata object containing the inline test data
for key in inline_data.clone().keys() {
  let d = inline_data.get_object(&key);

  // Find existing id if present
  let mut data_id = "".to_string();
  for i in 0..existing_data_list.len() {
    let existing_item = existing_data_list.get_object(i);
    if existing_item.get_string("name") == key {
      data_id = existing_item.get_string("id");
      break;
    }
  }

  // If no ID exists, generate one
  if data_id.is_empty() {
    data_id = unique_session_id(); 
  }

  // Write the deeply nested inline data to the store using the same readers
  app_write(lib.clone(), DString(data_id.clone()), d, DArray(readers.data_ref), DArray(nowriters.data_ref), nn_sessionid.clone());

  // Push the reference to the parent map
  let mut data_ref = DataObject::new();
  data_ref.put_string("name", &key);
  data_ref.put_string("id", &data_id);
  new_data_list.push_object(data_ref);
}

// Move the newly constructed list into the main control data
ctl_data.put_array("data", new_data_list);

// Save the main control
app_write(lib, DString(id), ctl_data, DArray(readers.data_ref), DArray(nowriters.data_ref), nn_sessionid);

// Returning a string maps to the "msg" field in the standard OK response
"Control saved successfully".to_string()