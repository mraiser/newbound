use ndata::dataobject::*;
use crate::peer::service::exec::exec;
use flowlang::appserver::get_user;
use crate::peer::service::listen::get_best;
use std::env::temp_dir;
use flowlang::generated::flowlang::system::unique_session_id::unique_session_id;
use std::fs::File;
use std::io::Write;
use std::thread;
use core::time::Duration;
use crate::app::util::hash::hash;
use flowlang::datastore::DataStore;
use flowlang::generated::flowlang::file::copy_dir::copy_dir;
use std::fs::remove_dir_all;
use std::fs;
use ndata::dataarray::DataArray;
use flowlang::generated::flowlang::system::system_call::system_call;
use std::io::BufReader;
use std::io::BufRead;
use flowlang::buildrust::build_lib;
use flowlang::appserver::init_globals;
use std::fs::create_dir_all;
use std::fs::remove_file;

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
    if bytes.len() > 0 { let _x = f.write(&bytes).unwrap(); }
    else {
      timeout += 1;
      if timeout > 300 { println!("No library stream data in 30 seconds... abort."); return false; }
      thread::sleep(beat);
    }
  }
}

con.end_stream_read(stream_id);

let f = File::open(download.to_owned()).expect("Unable to open file");
let mut zip = zip::ZipArchive::new(f).unwrap();
let destdir = dir.join(dest);
let _x = zip.extract(&destdir).unwrap();
let h = hash(destdir.to_owned().into_os_string().into_string().unwrap());

let store = DataStore::new();
if h == meta.get_string("hash") {
  let datadir = store.root.join(&lib);
  let _x = remove_dir_all(&datadir).unwrap();
  copy_dir(destdir.to_owned().into_os_string().into_string().unwrap(), datadir.to_owned().into_os_string().into_string().unwrap());
  
  let appdata = datadir.join("_APPS");
  let appruntime = store.root.parent().unwrap().join("runtime");
  for file in fs::read_dir(&appdata).unwrap() {
    let appsrc = file.unwrap().path();
    let appname = &appsrc.file_name().unwrap();
    if appsrc.is_dir() {
      let appdest = appruntime.join(appname);
      if appdest.join("botd.properties").exists() {
        copy_dir(appsrc.to_owned().into_os_string().into_string().unwrap(), appdest.to_owned().into_os_string().into_string().unwrap());
        build_lib(lib.to_owned());
        
        let mut ja = DataArray::new();
        ja.push_str("cargo");
        ja.push_str("build");
        ja.push_str("-p");
        ja.push_str("cmd");
        let o = system_call(ja);
        let e = o.get_string("err");
        let lines = BufReader::new(e.as_bytes()).lines();
        let mut b = false;
        let mut c = false;
        let mut s = "".to_string();
        for line in lines {
          let line = line.unwrap();
          if c {
            s += &line;
            s += "\n";
            c = line != "";
          }
          else if line.starts_with("error") {
            s += &line;
            s += "\n";
            b = true;
            c = true;
          }
        }

        if b { panic!("{}",s); }
        
        println!("UPDATED LIBRARY {:?}", appname);
      }    
    }
  }

  init_globals();

  let _x = remove_dir_all(&destdir).unwrap();
  
  let devroot = store.root.parent().unwrap().join("runtime").join("dev").join("libraries");
  let _x = create_dir_all(&devroot);
  let hashfile = devroot.join(&(lib.to_owned()+".hash"));
  fs::write(hashfile, &h).expect("Unable to write file");

  let mut x = v;
  while x > 0 {
    x -= 1;
    let zipfile = devroot.join(&(lib.to_owned()+"_"+&x.to_string()+".zip"));
    let _x = remove_file(zipfile);
  }
  let zipfile = devroot.join(&(lib.to_owned()+"_"+&v.to_string()+".zip"));
  fs::copy(download, zipfile).expect("Unable to copy file");

  let metafile = devroot.join(&(lib.to_owned()+".json"));
  fs::write(metafile, &meta.to_string()).expect("Unable to write file");
  
  return true;
}


false
}
