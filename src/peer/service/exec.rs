use ndata::dataobject::DataObject;
use crate::peer::service::listen::encrypt;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use std::thread;
use ndata::data::Data;
use crate::peer::service::listen::get_best;
use crate::security::security::init::get_user;
use flowlang::command::Command;

pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("uuid");
  let arg_1: String = o.get_string("app");
  let arg_2: String = o.get_string("cmd");
  let arg_3: DataObject = o.get_object("params");
  let ax = exec(arg_0, arg_1, arg_2, arg_3);
  let mut result_obj = DataObject::new();
  result_obj.put_object("a", ax);
  result_obj
}

pub fn exec(uuid: String, app: String, cmd: String, params: DataObject) -> DataObject {
if uuid == "local" {
  let cmd = Command::lookup(&app.clone(), &app.clone(), &cmd.clone());
  let o = cmd.execute(params);
  if o.is_err(){
    let mut res = DataObject::new();
    res.put_string("status", "err");
    let msg = format!("{:?}", o.err().unwrap());
    res.put_string("msg", &msg);
    return res;
  }
  else {
    let mut o = o.unwrap();
    if !o.has("status") { o.put_string("status", "ok"); }
    if o.has("a") {
      let a = o.get_property("a");
      if a.is_string() {
        o.set_property("msg", a);
      }
      else {
        o.set_property("data", a);
      }
      //o.remove_property("a");
    }
    return o;
  }
}


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
#[allow(static_mut_refs)]
unsafe { pid = NEXT_CMD.fetch_add(1, Ordering::SeqCst) as i64;}

let mut d = DataObject::new();
d.put_string("bot", &app);
d.put_string("cmd", &cmd);
d.put_int("pid", pid);
d.put_object("params", params);

let con = get_best(user.clone()).unwrap();
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
let _x = stream.write(&bytes, con.sessionid).unwrap();

// FIXME - should timeout
let pidstr = &pid.to_string();
let name = match user.has("displayname") {
  true => user.get_string("displayname"),
  _ => uuid.to_string()
};
let mut timeout = 0;
while ! res.has(pidstr) {
  // TIGHTLOOP
  timeout += 1;
  let beat = Duration::from_millis(timeout);
  thread::sleep(beat);
  if timeout > 450 { println!("Unusually long wait in peer:service:exec [{}/{}/{}/{}]", &name, &app, &cmd, pid); timeout = 0; }
  
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
