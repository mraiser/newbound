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
d.put_str("bot", &app);
d.put_str("cmd", &cmd);
d.put_i64("pid", pid);
d.put_object("params", params);

let conid = cons.get_i64(0);
let mut heap = P2PHEAP.get().write().unwrap();
let con = heap.get(conid as usize);
let cipher = con.cipher.to_owned();
let mut stream = con.stream.try_clone().unwrap();
let mut res = con.res.duplicate();
let s = "cmd ".to_string() + &d.to_string();
let buf = encrypt(&cipher, s.as_bytes());
let len = buf.len() as i16;
let _x = stream.write(&len.to_be_bytes()).unwrap();
let _x = stream.write(&buf).unwrap();

let pid = &pid.to_string();
while ! res.has(pid) {
  xxx();
}

let o = res.get_object(pid);
res.remove_property(pid);

o
}

static mut NEXT_CMD: AtomicUsize = AtomicUsize::new(1);

fn xxx(){
  spin_loop();
  yield_now();