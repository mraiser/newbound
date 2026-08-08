use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use crate::peer::service::listen_udp::UDPCON;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["ipaddr", "port"] {
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
        let arg_0: String = o.get_string("ipaddr");
        let arg_1: i64 = o.get_int("port");
        udp_connect(arg_0, arg_1)
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

pub fn udp_connect(ipaddr: String, port: i64) -> DataObject {
let system = DataStore::globals().get_object("system");
if system.has("session_pubkey"){
  // Temp key pair for initial exchange
  let my_session_public: [u8; 32] = system.get_bytes("session_pubkey").get_data().try_into().unwrap();
  //let my_session_public = PublicKey::from(my_session_public);
  //let my_session_public = my_session_public.as_bytes();

  let mut buf = Vec::new();
  buf.push(0);
  buf.extend_from_slice(&my_session_public);
  let socket_address = ipaddr+":"+&port.to_string();
  //let _x = UDPCON.get().write().unwrap().send_to(&buf, socket_address).unwrap();
  let _x = UDPCON.lock().send_to(&buf, socket_address).unwrap();
}
DataObject::new()
}
