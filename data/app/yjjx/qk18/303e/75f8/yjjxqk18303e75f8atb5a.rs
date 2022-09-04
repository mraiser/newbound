if check_auth(&lib, &id, &nn_sessionid, false) {
  let _x = data::write::write(lib, id, data, readers, writers);
  return "OK".to_string();
}
panic!("UNAUTHORIZED write {}:{}", lib, id);