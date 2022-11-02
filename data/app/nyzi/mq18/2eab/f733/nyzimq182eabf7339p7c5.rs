if check_auth(&lib, &id, &nn_sessionid, false) {
  let store = DataStore::new();
  if store.exists(&lib, &id) { return store.get_data(&lib, &id); }
  else { return DataObject::from_string("{\"status\":\"err\",\"msg\":\"NOT FOUND\"}"); }
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")