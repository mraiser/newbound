use ndata::dataobject::*;
use ndata::dataarray::DataArray;
use flowlang::appserver::*;
use ndata::data::Data;
pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("id");
let a1 = o.get_string("displayname");
let a2 = o.get_string("password");
let a3 = o.get_array("groups");
let a4 = o.get_property("keepalive");
let a5 = o.get_property("address");
let a6 = o.get_property("port");
let ax = setuser(a0, a1, a2, a3, a4, a5, a6);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn setuser(id:String, displayname:String, password:String, groups:DataArray, keepalive:Data, address:Data, port:Data) -> DataObject {
let x = get_user(&id);
let mut user;
if x.is_none() { user = DataObject::new(); }
else { user = x.unwrap(); }
user.put_str("displayname", &displayname);
user.put_str("password", &password);
user.put_array("groups", groups);
user.put_str("id", &id);
if Data::as_string(keepalive.clone()) == "true".to_string() { user.set_property("keepalive", keepalive); }
if Data::as_string(address.clone()) != "null".to_string() { user.set_property("address", address); }
if Data::as_string(port.clone()) != "null".to_string() { user.set_property("port", port.clone()); }
if Data::as_string(port.clone()) != "null".to_string() { user.set_property("p2pport", port); }
if !user.has("connections") { user.put_array("connections", DataArray::new()); }
set_user(&id, user.duplicate());

user
}

