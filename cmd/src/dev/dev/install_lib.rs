use ndata::dataobject::*;
use crate::peer::service::exec::exec;
use crate::peer::peer::remote::remote;
use flowlang::appserver::get_user;
use crate::peer::service::listen::get_best;
use std::env::temp_dir;
use flowlang::generated::flowlang::system::unique_session_id::unique_session_id;
use std::fs::File;
use std::io::Write;
use std::thread;
use core::time::Duration;
use crate::app::util::hash::hash;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_string("lib");
let ax = install_lib(a0, a1);
let mut o = DataObject::new();
o.put_bool("a", ax);
o
}

pub fn install_lib(uuid:String, lib:String) -> bool {
let mut d = DataObject::new();
d.put_str("lib", &lib);
let o = exec(uuid.to_owned(), "dev".to_string(), "lib_info".to_string(), d.duplicate());
let meta = o.get_object("data");
let v = meta.get_string("version").parse::<i64>().unwrap();
d.put_i64("version", v);
let o = exec(uuid.to_owned(), "dev".to_string(), "lib_archive".to_string(), d);
let stream_id = o.get_i64("stream_id");
let user = get_user(&uuid).unwrap();
let mut con = get_best(user.duplicate()).unwrap();
let buf = con.join_stream(stream_id);

let dir = temp_dir();
let dest = unique_session_id();
let filename = dest.to_owned()+".zip";
let download = dir.join(filename);
println!("download {:?}", download);
{
  let mut f = File::create(download.to_owned()).expect("Unable to create file");
  let beat = Duration::from_millis(100);
  let mut timeout = 0;
  while buf.is_read_open() {
    let bytes = buf.read(4096);
    if bytes.len() > 0 { f.write(&bytes); }
    else {
      timeout += 1;
      if timeout > 300 { println!("No library stream data in 30 seconds... abort."); return false; }
      thread::sleep(beat);
    }
  }
}

con.end_stream_read(stream_id);

let f = File::open(download).expect("Unable to open file");
let mut zip = zip::ZipArchive::new(f).unwrap();
let destdir = dir.join(dest);
let _x = zip.extract(&destdir).unwrap();
let h = hash(destdir.to_owned().into_os_string().into_string().unwrap());
if h == meta.get_string("hash") {
  println!("yay {:?}", destdir);
}

true
}

