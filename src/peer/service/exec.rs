use ndata::dataobject::*;
use crate::peer::service::listen::encrypt;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use std::thread;
use ndata::data::Data;
use crate::peer::service::listen::get_best;
use crate::security::security::init::get_user;

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

let con = get_best(user).unwrap();
let cipher = con.cipher;
let mut stream = con.stream;
let mut res = con.res;

let mut pending = con.pending;
pending.push_i64(pid);

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
}

