let store = DataStore::new();
let id = "controls";
if store.exists(&lib, id) { 
  let o = store.get_data(&lib, &id);
  return o.get_object("data").get_array("list");
}
DataArray::new()