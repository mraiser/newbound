use ndata::dataobject::*;
use flowlang::appserver::*;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("id");
let ax = deleteuser(a0);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn deleteuser(id:String) -> String {
delete_user(&id);
"OK".to_string()
}

