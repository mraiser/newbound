let ctl = app_read(lib.clone(), control_id.clone(), nn_sessionid.clone()).get_object("data");

// Construct the payload expected by the appdata() function
let mut ad_req = DataObject::new();
ad_req.put_string("name", &ctl.get_string("name"));
ad_req.put_string("db", &lib);
ad_req.put_string("ctl", &control_id);

let props = appdata(ad_req); 
let system_libraries = libs();

let mut res = DataObject::new();

// Transfer ownership of props and system_libraries into the return object
res.put_object("properties", props);
res.put_array("system_libraries", system_libraries);

res