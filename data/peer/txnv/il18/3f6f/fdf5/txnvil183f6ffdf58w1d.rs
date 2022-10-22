let uuid = &nn_path[13..49];
let path = &nn_path[49..];
let user = get_user(uuid).unwrap();
let mut con = get_best(user.duplicate()).unwrap();

let mut d = DataObject::new();
d.put_str("path", path);
if (user.has("session_id")) { d.put_str("sessionid", &user.get_string("session_id")); }
d.put_object("params", nn_params.duplicate());
d.put_object("headers", nn_headers);

let mut o = DataObject::new();
o.put_object("request", d);

let d = exec(uuid.to_string(), "peer".to_string(), "local".to_string(), o);
let d = d.get_object("data");
if d.has("stream_id") {
  let id = d.get_i64("stream_id");
  return con.join_stream(id);
}
if d.has("body") {
  let body = d.get_string("body");
  let s;
  if nn_params.has("callback") {
    s = nn_params.get_string("callback") + "(" + &body + ")";
  }
  else {
    s = body;
  }
  return DataBytes::from_bytes(&s.as_bytes().to_vec());
}
DataBytes::from_bytes(&"404".as_bytes().to_vec())