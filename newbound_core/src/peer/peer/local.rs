use ndata::dataobject::DataObject;
use crate::app::service::init::prep_request;
use crate::app::service::init::do_get;
use crate::peer::service::listen::get_best;
use std::fs;
use std::io::Read;
use std::thread;
use std::path::Path;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: DataObject = o.get_object("request");
    let arg_1: DataObject = o.get_object("nn_session");
    let arg_2: String = o.get_string("nn_sessionid");
    let ax = local(arg_0, arg_1, arg_2);
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn local(request: DataObject, nn_session: DataObject, nn_sessionid: String) -> DataObject {
request.get_object("params").put_string("session_id", &nn_sessionid);
let session_id = prep_request(request.clone());
let mut x = do_get(request, session_id);
if x.has("code") && x.get_int("code") == 404 {
  x.put_string("body", "404");
  x.put_string("status", "err");
  x.put_string("msg", "File not found");
}
else if x.has("file") {
  let path = x.get_string("file");
  if Path::new(&path).exists() {
    let user = nn_session.get_object("user");
    let mut con = get_best(user).unwrap();
    // FIXME - set remote stream len
  //  let len = fs::metadata(&path).unwrap().len() as i64;
    let stream_id = con.begin_stream();

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

    x.put_int("stream_id", stream_id);
  }
  else {
    x.put_string("status", "err");
    x.put_string("msg", "File not found");
  }
}

x
}
