use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use ndata::data::Data;
use crate::security::security::init::get_user;
use crate::security::security::init::set_user;

pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("id");
  let arg_1: String = o.get_string("displayname");
  let arg_2: String = o.get_string("password");
  let arg_3: DataArray = o.get_array("groups");
  let arg_4: Data = o.get_property("keepalive");
  let arg_5: Data = o.get_property("address");
  let arg_6: Data = o.get_property("port");
  let ax = setuser(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6);
  let mut result_obj = DataObject::new();
  result_obj.put_object("a", ax);
  result_obj
}

pub fn setuser(id: String, displayname: String, password: String, groups: DataArray, keepalive: Data, address: Data, port: Data) -> DataObject {
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
}
