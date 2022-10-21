use ndata::dataobject::*;
use crate::app::service::init::prep_request;
use crate::app::service::init::do_get;
use crate::peer::service::listen::get_best;
use std::fs;
use std::io::Read;
use std::thread;

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
  let mut con = get_best(user).unwrap().duplicate();
  let stream_id = con.begin_stream();
  
  let path = x.get_string("file");
  thread::spawn(move || {
    let mut file = fs::File::open(&path).unwrap();
    let chunk_size = 0x4000;
    loop {
      let mut chunk = Vec::with_capacity(chunk_size);
      let n = std::io::Read::by_ref(&mut file).take(chunk_size as u64).read_to_end(&mut chunk).unwrap();
      if n == 0 { break; }
      //let x = 
      con.write_stream(stream_id, &chunk);
      //if x.is_err() { break; }
      if n < chunk_size { break; }
    }
    con.end_stream_write(stream_id);
  });
  
  x.put_i64("stream_id", stream_id);
}

x
}

