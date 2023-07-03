use ndata::dataobject::*;
use ndata::databytes::DataBytes;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_int("stream_id");
let ax = get_stream(a0, a1);
let mut o = DataObject::new();
o.put_bytes("a", ax);
o
}

pub fn get_stream(uuid:String, stream_id:i64) -> DataBytes {
let user = get_user(&uuid).unwrap();
let mut con = get_best(user.clone()).unwrap();
con.join_stream(stream_id)
}

