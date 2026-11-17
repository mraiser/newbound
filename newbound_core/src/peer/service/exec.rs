use ndata::dataobject::DataObject;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use std::thread;
use ndata::data::Data;
use crate::peer::service::listen::get_best;
use crate::security::security::init::get_user;
use flowlang::command::Command;
use flowlang::flowlang::system::time::time;
use crate::peer::service::listen::P2PConnection;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["uuid", "app", "cmd", "params"] {
        if !o.has(p) {
            let mut e = DataObject::new();
            e.put_string("status", "err");
            e.put_string("msg", &format!("missing required parameter: {}", p));
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", e);
            return result_obj;
        }
    }
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        let arg_0: String = o.get_string("uuid");
        let arg_1: String = o.get_string("app");
        let arg_2: String = o.get_string("cmd");
        let arg_3: DataObject = o.get_object("params");
        exec(arg_0, arg_1, arg_2, arg_3)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
            result_obj
        }
        Err(err) => {
            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");

            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic occurred".to_string()
            };

            err_obj.put_string("msg", &msg);
            // Wrapped in the same `a` envelope a successful return uses.
            // Unwrapped, callers that unpack the envelope (newbound's
            // format_result, for one) report an opaque 500 — "Not an object:
            // DString(\"err\")" — instead of this message.
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", err_obj);
            result_obj
        }
    }
}

pub fn exec(uuid: String, app: String, cmd: String, params: DataObject) -> DataObject {
if uuid == "local" {
  let cmd = Command::lookup(&app.clone(), &app.clone(), &cmd.clone());
  let o = cmd.execute(params);
  if let Err(e) = &o { return e.to_envelope(); }
  let mut o = o.unwrap();
  if !o.has("status") { o.put_string("status", "ok"); }
  if o.has("a") {
    let a = o.get_property("a");
    if a.is_string() { o.set_property("msg", a); } else { o.set_property("data", a); }
  }
  return o;
}

let user = get_user(&uuid);
if user.is_none() {
  let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", "No such peer"); return o;
}
let user = user.unwrap();
if user.get_array("connections").len() == 0 {
  let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", "No route to peer"); return o;
}

let pid;
#[allow(static_mut_refs)]
unsafe { pid = NEXT_CMD.fetch_add(1, Ordering::SeqCst) as i64; }
let mut d = DataObject::new();
d.put_string("bot", &app);
d.put_string("cmd", &cmd);
d.put_int("pid", pid);
d.put_object("params", params);

let con = match get_best(user.clone()) {
  Some(con) => con,
  None => { let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", "No live route to peer"); return o; },
};
let conid = P2PConnection::list().into_iter().find(|id| {
  P2PConnection::try_get(*id).map(|other| other.sessionid == con.sessionid).unwrap_or(false)
}).unwrap_or(-1);
let mut res = con.res.clone();
let mut pending = con.pending.clone();
pending.push_int(pid);

if con.send_command("cmd ", d.to_string().as_bytes()).is_err() {
  pending.remove_data(Data::DInt(pid));
  con.alive.store(false, Ordering::SeqCst);
  if conid >= 0 { let _ = con.shutdown(&con.uuid, conid); }
  let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", "P2P request could not be sent within the legacy frame limit or its connection failed"); return o;
}

let pidstr = pid.to_string();
let name = if user.has("displayname") { user.get_string("displayname") } else { uuid.to_string() };
let started = time();
let mut last_notice = started;
while !res.has(&pidstr) {
  if !con.alive.load(Ordering::SeqCst) {
    pending.remove_data(Data::DInt(pid));
    let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", "P2P connection closed while awaiting response"); return o;
  }
  let now = time();
  if now - last_notice > 30000 {
    println!("P2P still awaiting response [{}/{}/{}/{}] after {} ms", &name, &app, &cmd, pid, now-started);
    last_notice = now;
  }
  let limit = if app == "peer" && cmd == "info" { 15000 } else { 120000 };
  if now - started > limit {
    pending.remove_data(Data::DInt(pid));
    con.alive.store(false, Ordering::SeqCst);
    if conid >= 0 { let _ = con.shutdown(&con.uuid, conid); }
    let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", "SERVICE EXEC TIMEOUT; stale P2P connection closed for reconnect"); return o;
  }
  thread::sleep(Duration::from_millis(10));
}

let o = res.get_object(&pidstr);
res.remove_property(&pidstr);
pending.remove_data(Data::DInt(pid));
o
}

static mut NEXT_CMD: AtomicUsize = AtomicUsize::new(1);

fn wait() {
  thread::yield_now();
}
