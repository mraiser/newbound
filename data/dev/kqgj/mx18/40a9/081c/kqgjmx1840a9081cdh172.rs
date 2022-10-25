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
  let store = DataStore::new();
  let datadir = store.root.join(&lib);
  remove_dir_all(&datadir);
  copy_dir(destdir.into_os_string().into_string().unwrap(), datadir.to_owned().into_os_string().into_string().unwrap());
  
  let appdata = datadir.join("_APPS");
  let appruntime = store.root.parent().unwrap().join("runtime");
  for file in fs::read_dir(&appdata).unwrap() {
    let appsrc = file.unwrap().path();
    let appname = &appsrc.file_name().unwrap();
    if appsrc.is_dir() {
      let appdest = appruntime.join(appname);
      if appdest.join("botd.properties").exists() {
        copy_dir(appsrc.to_owned().into_os_string().into_string().unwrap(), appdest.to_owned().into_os_string().into_string().unwrap());
        build_all();
        
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
        
        
        
        
        println!("UPDATED {:?}", appname);
      }    
    }
  }
  
  
}

true