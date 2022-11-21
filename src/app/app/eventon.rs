use ndata::dataobject::*;
use flowlang::appserver::*;
pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("id");
let a1 = o.get_string("app");
let a2 = o.get_string("event");
let a3 = o.get_string("cmdlib");
let a4 = o.get_string("cmdid");
let ax = eventon(a0, a1, a2, a3, a4);
let mut o = DataObject::new();
o.put_string("a", &ax);
o
}

pub fn eventon(id:String, app:String, event:String, cmdlib:String, cmdid:String) -> String {
add_event_listener(&id, &app, &event, &cmdlib, &cmdid);
"OK".to_string()
}

