if check_auth(&lib, &id, &nn_sessionid, false) {
  return DataStore::new().get_data(&lib, &id);
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")