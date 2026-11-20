use ndata::dataobject::DataObject;
use crate::security::security::init::log_in; 
use crate::security::security::init::secure_id;
use flowlang::datastore::DataStore;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["user", "pass", "nn_sessionid"] {
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
        let arg_0: String = o.get_string("user");
        let arg_1: String = o.get_string("pass");
        let arg_2: String = o.get_string("nn_sessionid");
        login(arg_0, arg_1, arg_2)
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

pub fn login(user: String, pass: String, nn_sessionid: String) -> DataObject {
let mut res = DataObject::new();

let (status, msg) = if log_in(&nn_sessionid, &user, &pass) { 
  // Session fixation: the id this login arrived on may have been chosen by
  // someone else (a link carrying ?session_id= / ?sessionid=). Move the now
  // authenticated session to a fresh id and retire the old one. The session
  // object itself moves, so an HTTP login's Set-Cookie carries the new id;
  // websocket clients read it from "sessionid" in the reply.
  let mut sid = nn_sessionid.clone();
  let mut sessions = DataStore::globals().get_object("system").get_object("sessions");
  if sessions.has(&nn_sessionid) {
    let mut session = sessions.get_object(&nn_sessionid);
    let newid = secure_id();
    session.put_string("id", &newid);
    sessions.put_object(&newid, session);
    sessions.remove_property(&nn_sessionid);
    sid = newid;
  }
  res.put_string("sessionid", &sid);
  ("ok".to_string(), format!("You are now logged in\", \"sessionid\": \"{}", sid)) 
} else { 
  ("err".to_string(), format!("UNAUTHORIZED: {}", user)) 
};

res.put_string("status", &status);
res.put_string("msg", &msg);

res
}
