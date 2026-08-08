use ndata::dataobject::DataObject;
use std::net::TcpStream;
use std::thread;
use crate::peer::service::listen::handshake;
use crate::peer::service::listen::handle_connection;
use crate::peer::service::listen::P2PStream;
use std::sync::Arc;
use std::sync::Mutex;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["uuid", "ipaddr", "port"] {
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
        let arg_1: String = o.get_string("ipaddr");
        let arg_2: i64 = o.get_int("port");
        tcp_connect(arg_0, arg_1, arg_2)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_boolean("a", ax);
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

pub fn tcp_connect(uuid: String, ipaddr: String, port: i64) -> bool {
let sock_addr = ipaddr+":"+&port.to_string();
let stream = TcpStream::connect(sock_addr);
if stream.is_ok() {
  let stream = stream.unwrap();
  //let remote_addr = stream.peer_addr().unwrap();
  //println!("P2P TCP outgoing request to {}", remote_addr);
  let mut stream = P2PStream::Tcp(Arc::new(stream), Arc::new(Mutex::new(())));
  let con = handshake(&mut stream, Some(uuid));
  if con.is_some() {
    thread::spawn(move || {
      let (conid, con) = con.unwrap();
      handle_connection(conid, con);
    });
    return true;
  }
}
false
}
