let session_id = prep_request(request.duplicate());
let mut x = do_get(request, session_id);
if x.get_string("return_type") == "File" {
  x.put_i64("stream_id", 69);
}

x