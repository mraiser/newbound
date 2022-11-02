use ndata::dataobject::*;
use flowlang::appserver::log_in;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("user");
let a1 = o.get_string("pass");
let a2 = o.get_string("nn_sessionid");
let ax = login(a0, a1, a2);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn login(user:String, pass:String, nn_sessionid:String) -> String {
if !log_in(&nn_sessionid, &user, &pass) { panic!("UNAUTHORIZED: {}", user); }
format!("You are now logged in\", \"sessionid\": \"{}", nn_sessionid)
}

