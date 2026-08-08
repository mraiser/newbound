use ndata::dataobject::DataObject;
use crate::peer::service::listen::P2PConnection;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["user"] {
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
        let arg_0: DataObject = o.get_object("user");
        session_expire(arg_0)
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

pub fn session_expire(user: DataObject) -> DataObject {
//FIXME - Param should be sessionid not user. Don't kill all their cons because a session died!!!
if user.has("id") {
  let username = user.get_string("id");
  if username.len() == 36 {
    let connections = user.get_array("connections");
    println!("Peer {} session expire, cons {}", username, connections.to_string());
    for con in connections.objects(){
      let conid = con.int();
      let con = P2PConnection::get(conid).duplicate();
      con.shutdown(&username, conid).expect("shutdown call failed");
    }
  }
}
DataObject::new()
}
