use ndata::dataobject::*;
use flowlang::appserver::*;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("id");
let a1 = o.get_object("data");
let ax = timeron(a0, a1);
let mut o = DataObject::new();
o.put_string("a", &ax);
o
}

pub fn timeron(id:String, data:DataObject) -> String {
add_timer(&id, data);
"OK".to_string()
}

