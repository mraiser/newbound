use ndata::dataobject::DataObject;
use flowlang::appserver::*;
pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("id");
    let arg_1: String = o.get_string("app");
    let arg_2: String = o.get_string("event");
    let arg_3: String = o.get_string("cmdlib");
    let arg_4: String = o.get_string("cmdid");
    let ax = eventon(arg_0, arg_1, arg_2, arg_3, arg_4);
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn eventon(id: String, app: String, event: String, cmdlib: String, cmdid: String) -> String {
add_event_listener(&id, &app, &event, &cmdlib, &cmdid);
"OK".to_string()
}
