let tid = id;
let id;
if tid.clone().is_null() { id = system::unique_session_id::unique_session_id(); }
else { id = tid.string(); }

let tid = readers;
let readers;
if tid.clone().is_null() { readers = DataArray::new(); }
else { readers = DataArray::from_string(&Data::as_string(tid)); }

let tid = writers;
let writers;
if tid.clone().is_null() { writers = DataArray::new(); }
else { writers = DataArray::from_string(&Data::as_string(tid)); }

if check_auth(&lib, &id, &nn_sessionid, false) {
  return data::write::write(lib, id, data, readers, writers);
}
panic!("UNAUTHORIZED write {}:{}", lib, id);