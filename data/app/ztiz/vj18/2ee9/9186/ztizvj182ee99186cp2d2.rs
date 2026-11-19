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