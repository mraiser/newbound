use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("nn_sessionid");
    let ax = current_user(arg_0);
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn current_user(nn_sessionid: String) -> DataObject {
let system = DataStore::globals().get_object("system");
let sessions = system.get_object("sessions");
let nn_session = sessions.get_object(&nn_sessionid);

println!("USER SESSION {}", nn_session.to_string());
let mut user = nn_session.get_object("user").shallow_copy();
user.put_string("sessionid", &nn_sessionid);
user
}
