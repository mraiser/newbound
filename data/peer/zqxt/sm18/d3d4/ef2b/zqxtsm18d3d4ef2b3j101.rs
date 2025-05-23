let user = get_user(&uuid).unwrap();
let con = get_best(user.clone());
if con.is_some() {
  let mut con = con.unwrap();
  if write {
    con.end_stream_write(streamid);
  }
  else {
    con.end_stream_read(streamid);
  }
}
DataObject::new()