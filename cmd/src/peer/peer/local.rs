use ndata::dataobject::*;
use crate::app::service::init::prep_request;
use crate::app::service::init::do_get;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_object("request");
let ax = local(a0);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn local(request:DataObject) -> DataObject {
let session_id = prep_request(request.duplicate());
do_get(request, session_id)
}

