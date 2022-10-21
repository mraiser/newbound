let session_id = prep_request(request.duplicate());
let mut x = do_get(request, session_id);
if x.has("file") {
  x.put_object("xxx-user", nn_user);
  
  
  x.put_i64("stream_id", 69);
}

x