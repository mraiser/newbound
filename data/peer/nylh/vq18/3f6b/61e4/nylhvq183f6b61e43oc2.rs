let session_id = prep_request(request.duplicate());
let mut x = do_get(request, session_id);
if x.has("file") {
  let user = nn_session.get_object("user");
  let mut con = get_best(user).unwrap();
  let stream_id = con.begin_stream();
  
  let path = x.get_string("file");
  thread::spawn(move || {
    let mut file = fs::File::open(&path).unwrap();
    let chunk_size = 0x4000;
    loop {
      let mut chunk = Vec::with_capacity(chunk_size);
      let n = std::io::Read::by_ref(&mut file).take(chunk_size as u64).read_to_end(&mut chunk).unwrap();
      if n == 0 { break; }
      //let x = 
      con.write_stream(stream_id, &chunk);
      //if x.is_err() { break; }
      if n < chunk_size { break; }
    }
    con.end_stream_write(stream_id);
  });
  
  x.put_i64("stream_id", stream_id);
}

x