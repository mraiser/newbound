use ndata::dataobject::DataObject;
use crate::security::security::init::delete_user;

pub fn execute(o: DataObject) -> DataObject {
  let arg_0: String = o.get_string("id");
  let ax = deleteuser(arg_0);
  let mut result_obj = DataObject::new();
  result_obj.put_string("a", &ax);
  result_obj
}

pub fn deleteuser(id: String) -> String {
delete_user(&id);
"OK".to_string()
}
