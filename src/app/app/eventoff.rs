use ndata::dataobject::*;
use flowlang::appserver::*;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("id");
let ax = eventoff(a0);
let mut o = DataObject::new();
o.put_string("a", &ax);
o
}

pub fn eventoff(id:String) -> String {
let b = remove_event_listener(&id);
if b { return "OK".to_string(); }
format!("Not found: {}", id)
}

