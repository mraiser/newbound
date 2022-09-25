let x = get_user(&id);
let mut user;
if x.is_none() { user = DataObject::new(); }
else { user = x.unwrap(); }
user.put_str("displayname", &displayname);
user.put_str("password", &password);
user.put_array("groups", groups);
set_user(&id, user.duplicate());

user