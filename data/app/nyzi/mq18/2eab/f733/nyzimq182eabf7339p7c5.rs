if !DataStore::globals().get_object("system").get_object("libraries").has(&lib) {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("msg", &format!("NO SUCH LIBRARY: {}", lib));
  return o;
}
if check_auth(&lib, &id, &nn_sessionid, false) {
  let store = DataStore::new();
  if store.exists(&lib, &id) { return store.get_data(&lib, &id); }
  else { return DataObject::from_string("{\"status\":\"err\",\"msg\":\"NOT FOUND\"}"); }
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")