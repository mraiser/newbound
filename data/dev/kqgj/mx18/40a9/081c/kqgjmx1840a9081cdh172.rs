let mut d = DataObject::new();
d.put_str("lib", &lib);
let o = exec(uuid.to_owned(), "dev".to_string(), "lib_info".to_string(), d.duplicate());
let o = o.get_object("data");
let v = o.get_string("version").parse::<i64>().unwrap();
d.put_i64("version", v);
let o = exec(uuid.to_owned(), "dev".to_string(), "lib_archive".to_string(), d);
let stream_id = o.get_i64("stream_id");
let user = get_user(&uuid).unwrap();
let mut con = get_best(user.duplicate()).unwrap();
let buf = con.join_stream(stream_id);

let dir = temp_dir();
let filename = unique_session_id();
let path = dir.join(filename);
println!("path {:?}", path);
let mut f = File::create(path).expect("Unable to create file");
let beat = Duration::from_millis(100);
let mut timeout = 0;
while buf.is_read_open() {
  let bytes = buf.read(4096);
  if bytes.len() > 0 { f.write(&bytes); }
  else {
    timeout += 1;
    if timeout > 300 { println!("No library stream data in 30 seconds... abort."); return false; }
    thread::sleep(beat);
  }
}

con.end_stream_read(stream_id);

println!("yay");

true