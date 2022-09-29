use ndata::dataobject::*;
use flowlang::appserver::get_user;
use crate::peer::service::listen::P2PHEAP;
use crate::peer::service::listen::encrypt;
use std::io::Write;
use std::hint::spin_loop;
use std::thread::yield_now;
use std::sync::atomic::{AtomicUsize, Ordering};

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_string("app");
let a2 = o.get_string("cmd");
let a3 = o.get_object("params");
let ax = exec(a0, a1, a2, a3);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn exec(uuid:String, app:String, cmd:String, params:DataObject) -> DataObject {
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

// FIXME - should timeout
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
}

