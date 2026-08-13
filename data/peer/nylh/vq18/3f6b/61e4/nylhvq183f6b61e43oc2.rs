request.get_object("params").put_string("session_id", &nn_sessionid);
let session_id = prep_request(request.clone());
let mut x = do_get(request, session_id);
if x.has("code") && x.get_int("code") == 404 {
  x.put_string("body", "404");
  x.put_string("status", "err");
  x.put_string("msg", "File not found");
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

    x.put_int("stream_id", stream_id);
  }
  else {
    x.put_string("status", "err");
    x.put_string("msg", "File not found");
  }
}
else if x.has("body") && x.get_property("body").is_bytes() {
  // An InputStream command result is a process-local DataBytes that
  // cannot cross the wire: pump it through a peer stream exactly like
  // the file branch. The pump ends when the source closes its stream,
  // when the viewer goes away (its s_4 close-back retires the writer
  // and write_stream returns false), or after 30s of starvation.
  let bytes = x.get_bytes("body");
  let user = nn_session.get_object("user");
  let mut con = get_best(user).unwrap();
  let stream_id = con.begin_stream();

  if let Some(mime) = bytes.get_mime_type() { x.put_string("mimetype", &mime); }

  thread::spawn(move || {
    println!("Peer byte stream begin");
    let beat = core::time::Duration::from_millis(10);
    let mut starved = 0;
    loop {
      if !bytes.is_read_open() { break; }
      let chunk = bytes.read(0x4000);
      if chunk.len() == 0 {
        // no data yet - the source (e.g. a live remux) may just be
        // between frames; give up only after ~30s of starvation
        starved += 1;
        if starved > 3000 { break; }
        thread::sleep(beat);
        continue;
      }
      starved = 0;
      // write_stream returns false once the remote consumer is gone
      // (its s_4 close-back retired the writer) - stop pumping
      if !con.write_stream(stream_id, &chunk) { break; }
    }
    con.end_stream_write(stream_id);
    bytes.close_read();
    println!("Peer byte stream end");
  });

  x.remove_property("body");
  x.put_int("stream_id", stream_id);
}

x