use ndata::dataobject::*;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;
use ndata::databytes::DataBytes;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let ax = new_stream(a0);
let mut o = DataObject::new();
o.put_int("a", ax);
o
}

pub fn new_stream(uuid:String) -> i64 {
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

