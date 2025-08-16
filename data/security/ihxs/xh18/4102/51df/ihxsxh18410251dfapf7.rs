let system = DataStore::globals().get_object("system");
let sessions = system.get_object("sessions");
let nn_session = sessions.get_object(&nn_sessionid);

//println!("USER SESSION {}", nn_session.to_string());
let mut user = nn_session.get_object("user").shallow_copy();
user.put_string("sessionid", &nn_sessionid);
user