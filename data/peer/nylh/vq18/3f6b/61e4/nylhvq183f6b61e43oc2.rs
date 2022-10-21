let session_id = prep_request(request.duplicate());
let mut x = do_get(request, session_id);
if x.has("file") {
  let user = nn_session.get_object("user");
  x.put_object("xxx-user", user);
  
  
  x.put_i64("stream_id", 69);
}

x