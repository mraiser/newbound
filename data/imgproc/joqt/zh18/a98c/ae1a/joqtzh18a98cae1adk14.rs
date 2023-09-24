let SIMILAR = 0.4;

let faces = Path::new("/export/train/batch/faces");
let meta = Path::new("/export/train/batch/json");
let matches = Path::new("/export/train/batch/match");
std::fs::remove_dir_all(matches.clone());
std::fs::create_dir_all(matches.clone());

//let stackx = DataArray::new();

//let num_threads = num_threads as u64;
//for n in 0..num_threads {
//  let mut stack = stackx.clone();
//  stack.push_null();
//  std::thread::spawn(move || {
//    println!("Starting thread {} INDEX FACES", n);


    let paths = std::fs::read_dir(faces).unwrap();
    for path in paths {
      let path = path.unwrap().path();
      let fullname = path.display().to_string();
      let filename = path.file_name().unwrap().to_os_string().into_string().unwrap();
      let h = calculate_hash(&fullname);
      
      
//      if h % num_threads == n {
        let json = meta.join(filename.clone()+".json");
        let index = matches.join(filename.clone()+".txt");
        if json.exists() {
          println!("Processing: {:?}", filename);
          let enc1 = get_enc(json);
          if enc1.is_some(){
            let enc1 = enc1.unwrap();
            let paths = std::fs::read_dir(faces).unwrap();
            for path2 in paths {
              let path2 = path2.unwrap().path();
              let fullname2 = path2.display().to_string();
              let h2 = calculate_hash(&fullname2);
              if h2 > h{
                let filename2 = path2.file_name().unwrap().to_os_string().into_string().unwrap();
                let json2 = meta.join(filename2.clone()+".json");
                if json2.exists() {
                  let enc2 = get_enc(json2);
                  if enc2.is_some(){
                    let enc2 = enc2.unwrap();
                    let d = enc1.distance(&enc2);
                    if d <= SIMILAR {
                      let index2 = matches.join(filename2.clone()+".txt");
                      write_index(index.clone(), &filename2);
                      write_index(index2.clone(), &filename);
                    }
                  }
                }
              }
            }
          }
        }
//      }
      gc();
    }
    
//    stack.remove_property(0);
//  });
//}
    
//let beat = Duration::from_millis(100);
//while stackx.len() > 0 {
//  std::thread::sleep(beat);
//}

println!("DONE INDEXING");
DataObject::new()
}

fn write_index(path:PathBuf, id:&str) {
  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(path)
    .unwrap();
  let _x = file.write_all(&(id.to_string()+"\n").into_bytes());
}

fn get_enc(path:PathBuf) -> Option<FaceEncoding> {
  let mut f = File::open(path).unwrap();
  let mut s = String::new();
  f.read_to_string(&mut s).unwrap();
  let jo = DataObject::from_string(&s);
  let ja = jo.get_array("faces");
  if ja.len() > 0 {
    let face = ja.get_object(0);
    let xxx = face.get_string("encodings");
    //      let b = xxx.as_ref().iter().map(|c| *c as u8).collect::<Vec<_>>();
    let yyy = Base64::decode(xxx.chars().collect());
    let enc;
    unsafe {
      let zzz = std::slice::from_raw_parts(yyy.as_ptr() as *const f64, yyy.len() / 8);    
      enc = FaceEncoding::from_vec(&zzz.to_vec()).unwrap();
      return Some(enc);
    }
  }
  None