use ndata::dataobject::DataObject;
use flowlang::appserver::*;

pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("id");
  let ax = eventoff(arg_0);
  let mut result_obj = DataObject::new();
  result_obj.put_string("a", &ax);
  result_obj
}

pub fn eventoff(id: String) -> String {
let b = remove_event_listener(&id);
if b { return "OK".to_string(); }
format!("Not found: {}", id)
}
