use ndata::dataobject::*;
use crate::security::security::init::delete_user;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("id");
let ax = deleteuser(a0);
let mut o = DataObject::new();
o.put_string("a", &ax);
o
}

pub fn deleteuser(id:String) -> String {
delete_user(&id);
"OK".to_string()
}

