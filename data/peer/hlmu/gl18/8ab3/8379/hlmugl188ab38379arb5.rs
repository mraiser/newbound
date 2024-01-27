let mut timeout = 0;
while timeout < 246 {
  let user = get_user(&uuid);
  if user.is_some() {
    let user = user.unwrap();
	let con = get_best(user.clone());
    if con.is_some() {
      let mut con = con.unwrap();
      return con.join_stream(stream_id);
    }
  }
  timeout += 1;
  let beat = Duration::from_millis(timeout);
  thread::sleep(beat);
}
panic!("NO SUCH STREAM! {}/{}", stream_id, uuid);