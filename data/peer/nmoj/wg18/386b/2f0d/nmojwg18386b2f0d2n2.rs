let user = get_user(&uuid);
if user.is_none(){
  return DataObject::from_string("{\"status\":\"err\",\"msg\":\"No such peer\"}");
}
let user = user.unwrap();
let cons = user.get_array("connections");
if cons.len() == 0 {
  return DataObject::from_string("{\"status\":\"err\",\"msg\":\"No route to peer\"}");
}

let pid;
unsafe { pid = NEXT_CMD.fetch_add(1, Ordering::SeqCst) as i64;}

let mut d = DataObject::new();
d.put_string("bot", &app);
d.put_string("cmd", &cmd);
d.put_int("pid", pid);
d.put_object("params", params);

let con = get_best(user).unwrap();
let cipher = con.cipher;
let mut stream = con.stream;
let mut res = con.res;

let mut pending = con.pending;
pending.push_int(pid);

let s = "cmd ".to_string() + &d.to_string();
let buf = encrypt(&cipher, s.as_bytes());
let len = buf.len() as i16;
let mut bytes = len.to_be_bytes().to_vec();
bytes.extend_from_slice(&buf);
let _x = stream.write(&bytes).unwrap();

// FIXME - should timeout
let pidstr = &pid.to_string();
let mut timeout = 0;
while ! res.has(pidstr) {
  // TIGHTLOOP
  timeout += 1;
  let beat = Duration::from_millis(timeout);
  thread::sleep(beat);
  if timeout > 450 { println!("Unusually long wait in peer:service:exec [{}]", pid); timeout = 0; }
  
  wait();
}

let o = res.get_object(pidstr);
res.remove_property(pidstr);
pending.remove_data(Data::DInt(pid));

o
}

static mut NEXT_CMD: AtomicUsize = AtomicUsize::new(1);

fn wait(){
//  spin_loop();
//  yield_now();