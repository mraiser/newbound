use ndata::dataobject::DataObject;
use flowlang::appserver::*;

pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("id");
  let arg_1: DataObject = o.get_object("data");
  let ax = timeron(arg_0, arg_1);
  let mut result_obj = DataObject::new();
  result_obj.put_string("a", &ax);
  result_obj
}

pub fn timeron(id: String, data: DataObject) -> String {
add_timer(&id, data);
"OK".to_string()
}
