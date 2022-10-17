use ndata::dataobject::*;
use ndata::dataarray::DataArray;
use flowlang::appserver::*;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("id");
let a1 = o.get_string("displayname");
let a2 = o.get_string("password");
let a3 = o.get_array("groups");
let ax = setuser(a0, a1, a2, a3);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn setuser(id:String, displayname:String, password:String, groups:DataArray) -> DataObject {
let x = get_user(&id);
let mut user;
if x.is_none() { user = DataObject::new(); }
else { user = x.unwrap(); }
user.put_str("displayname", &displayname);
user.put_str("password", &password);
user.put_array("groups", groups);
if !user.has("connections") { user.put_array("connections", DataArray::new()); }
set_user(&id, user.duplicate());

user
}

