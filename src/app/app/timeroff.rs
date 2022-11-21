use ndata::dataobject::*;
use flowlang::appserver::*;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("id");
let ax = timeroff(a0);
let mut o = DataObject::new();
o.put_string("a", &ax);
o
}

pub fn timeroff(id:String) -> String {
let b = remove_timer(&id);
if b { return "OK".to_string(); }
format!("Not found: {}", id)
}

