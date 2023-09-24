let mut o = DataObject::new();

let src = Path::new("/export/train/batch/src");
std::fs::create_dir_all(src.clone());

let dest = Path::new("/export/train/batch/raw");
std::fs::create_dir_all(dest.clone());

let meta = Path::new("/export/train/batch/json");
std::fs::create_dir_all(meta.clone());

let paths = std::fs::read_dir(src).unwrap();
for path in paths {
  let path = path.unwrap().path();
  let fullname = path.display().to_string();
  let filename = path.file_name().unwrap().to_os_string().into_string().unwrap();
  if fullname.ends_with(".mp4") {
    let json = meta.join(filename.clone()+".json");
    if !json.exists(){
      println!("Extracting RAW images from SRC file: {:?}", filename);
      
      let mut jo = DataObject::new();
      jo.put_string("name", &filename);
      let x = calculate_hash(&filename);
      let id = format!("{:x}", x);
      jo.put_string("id", &id);
      
      let out = dest.join(id.clone()+"_%05d.png").into_os_string().into_string().unwrap();
            
      let mut ja = DataArray::new();
      ja.push_string("ffmpeg");
      ja.push_string("-i");
      ja.push_string(&fullname);
      ja.push_string("-vf");
      ja.push_string("fps=1/5");
      ja.push_string(&out);
      
      let _x = system_call(ja);
      
      let mut file = File::create(json).unwrap();
      let _x = file.write_all(jo.to_string().as_bytes()).unwrap();
      
      o.put_object(&id, jo);
    }
  }
}

println!("DONE extracting RAW images");
o
}

pub fn calculate_hash<T: Hash>(t: &T) -> u64 {
  let mut s = DefaultHasher::new();
  t.hash(&mut s);
  s.finish()
