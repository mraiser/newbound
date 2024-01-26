use ndata::dataobject::*;
use ndata::databytes::DataBytes;
use crate::security::security::init::get_user;
use crate::peer::service::listen::get_best;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_int("stream_id");
let a2 = o.get_bytes("data");
let ax = stream_write(a0, a1, a2);
let mut o = DataObject::new();
o.put_boolean("a", ax);
o
}

pub fn stream_write(uuid:String, stream_id:i64, data:DataBytes) -> bool {
let user = get_user(&uuid).unwrap();
let con = get_best(user.clone());
if con.is_none() { return false; }

let mut con = con.unwrap();
let v = data.get_data();
con.write_stream(stream_id, &v)
}

