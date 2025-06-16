use ndata::dataobject::DataObject;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("uuid");
    let ax = new_stream(arg_0);
    let mut result_obj = DataObject::new();
    result_obj.put_int("a", ax);
    result_obj
}

pub fn new_stream(uuid: String) -> i64 {
let user = get_user(&uuid); 
if user.is_some(){
  let user = user.unwrap();
  let con = get_best(user.clone());
  if con.is_some() {
    let mut con = con.unwrap();
    return con.begin_stream();
  }
}
-1

}
