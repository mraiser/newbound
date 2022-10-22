let session_id = prep_request(request.duplicate());
let mut x = do_get(request, session_id);
if x.has("code") && x.get_i64("code") == 404 {
  println!("GOT 404 {}", x.to_string());
  x.put_str("body", "404");
  x.put_str("status", "err");
  x.put_str("msg", "File not found");
}
else if x.has("file") {
  let path = x.get_string("file");
  if Path::new(&path).exists() {
    let user = nn_session.get_object("user");
    let mut con = get_best(user).unwrap();
    // FIXME - set remote stream len
  //  let len = fs::metadata(&path).unwrap().len() as i64;
    let stream_id = con.begin_stream();

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
  else {
    x.put_str("status", "err");
    x.put_str("msg", "File not found");
  }
}

x