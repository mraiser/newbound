use ndata::dataobject::DataObject;
use flowlang::appserver::*;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("id");
    let ax = timeroff(arg_0);
    let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
    result_obj
}

pub fn timeroff(id: String) -> String {
let b = remove_timer(&id);
if b { return "OK".to_string(); }
format!("Not found: {}", id)
}
