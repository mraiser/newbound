let x = get_user(&id);
let mut user;
if x.is_none() { user = DataObject::new(); }
else { user = x.unwrap(); }
user.put_string("displayname", &displayname);
user.put_string("password", &password);
user.put_array("groups", groups);
user.put_string("id", &id);
if Data::as_string(keepalive.clone()) == "true".to_string() { user.set_property("keepalive", keepalive); }
if Data::as_string(address.clone()) != "null".to_string() { user.set_property("address", address); }
if Data::as_string(port.clone()) != "null".to_string() { user.set_property("port", port.clone()); }
if Data::as_string(port.clone()) != "null".to_string() { user.set_property("p2pport", port); }
if !user.has("connections") { user.put_array("connections", DataArray::new()); }
set_user(&id, user.clone());

user