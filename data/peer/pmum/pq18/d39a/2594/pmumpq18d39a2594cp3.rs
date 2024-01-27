let user = get_user(&uuid).unwrap();

let mut timeout = 0;
while timeout < 500 {
  let con = get_best(user.clone());
  if con.is_some() {
    let mut con = con.unwrap();
	let v = data.get_data();
	return con.write_stream(stream_id, &v);
  }
  timeout += 1;
  if timeout > 500 { println!("Unable to write to stream {}", stream_id); return false; }
  let beat = Duration::from_millis(timeout);
  thread::sleep(beat);
}
false