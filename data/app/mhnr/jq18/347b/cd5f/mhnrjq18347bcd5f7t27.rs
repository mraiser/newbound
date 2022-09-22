// FIXME - Does not delete attachments or empty parent folders
// Move to DataStore::delete()
if check_auth(&lib, &id, &nn_sessionid, true) {
  let s = DataStore::new();
  let f = s.get_data_file(&lib, &id);
  let _x = std::fs::remove_file(f);
  return "OK".to_string()
}
panic!("UNAUTHORIZED read {}:{}", lib, id);