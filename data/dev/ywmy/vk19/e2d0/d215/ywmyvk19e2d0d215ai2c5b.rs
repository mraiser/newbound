// 1. Create the new ID by writing an empty payload
let new_id = app_write(lib.clone(), DNull, DataObject::new(), DNull, DNull, nn_sessionid.clone()).get_string("id");

let mut comp_data = DataObject::new();
comp_data.put_string("name", &name);
comp_data.put_string("id", &new_id);

// If it's a Command, we must initialize the legacy java target
// TODO - Verify this is no longer referenced prior to removing legacy java field
if component_type == "cmd" {
  let mut empty_java = DataObject::new();
  empty_java.put_string("java", "return null;");
  let java_id = app_write(lib.clone(), DNull, empty_java, DNull, DNull, nn_sessionid.clone()).get_string("id");
  comp_data.put_string("java", &java_id);
} 

// Save the component's metadata
app_write(lib.clone(), DString(new_id), comp_data.clone(), DNull, DNull, nn_sessionid.clone());

// 2. Attach the new component to its parent control
let mut parent = app_read(lib.clone(), control_id.clone(), nn_sessionid.clone()).get_object("data");
let mut arr = if parent.has(&component_type) {
  parent.get_array(&component_type)
} else {
  DataArray::new()
};

arr.push_object(comp_data.clone());
parent.put_array(&component_type, arr);

app_write(lib, DString(control_id), parent, DNull, DNull, nn_sessionid.clone());

// Return the new component configuration
comp_data