use ndata::dataobject::DataObject;
use crate::security::security::init::log_in;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("user");
    let arg_1: String = o.get_string("pass");
    let arg_2: String = o.get_string("nn_sessionid");
    let ax = login(arg_0, arg_1, arg_2);
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn login(user: String, pass: String, nn_sessionid: String) -> String {
if !log_in(&nn_sessionid, &user, &pass) { panic!("UNAUTHORIZED: {}", user); }
format!("You are now logged in\", \"sessionid\": \"{}", nn_sessionid)
}
