let mut res = DataObject::new();

let (status, msg) = if log_in(&nn_sessionid, &user, &pass) { 
  ("ok".to_string(), format!("You are now logged in\", \"sessionid\": \"{}", nn_sessionid)) 
} else { 
  ("err".to_string(), format!("UNAUTHORIZED: {}", user)) 
};

res.put_string("status", &status);
res.put_string("msg", &msg);

res