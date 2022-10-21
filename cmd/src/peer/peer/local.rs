use ndata::dataobject::*;
use crate::app::service::init::prep_request;
use crate::app::service::init::do_get;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_object("request");
let a1 = o.get_object("nn_session");
let ax = local(a0, a1);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn local(request:DataObject, nn_session:DataObject) -> DataObject {
let session_id = prep_request(request.duplicate());
let mut x = do_get(request, session_id);
if x.has("file") {
  let user = nn_session.get_object("user");
  x.put_object("xxx-user", user);
  
  
  x.put_i64("stream_id", 69);
}

x
}

