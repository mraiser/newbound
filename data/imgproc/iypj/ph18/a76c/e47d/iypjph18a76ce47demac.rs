let mut d = DataObject::new();

let paths = std::fs::read_dir("/home/mraiser/Newbound/runtime/chuckme/html/txt").unwrap();
for path in paths {
  let path = path.unwrap().path();
  let filename = path.file_name().unwrap().to_os_string().into_string().unwrap();
  let fullname = path.display().to_string();
  if fullname.ends_with(".txt") {
    let prompt = read_all_string(fullname);
    let mut o = DataObject::new();
    o.put_string("prompt", &prompt);
    o.put_string("id", &filename);
    
//    let genroot = Path::new("/home/mraiser/Newbound/runtime/chuckme/html/gen");
//    let f = genroot.join(filename.clone()+".png");
//    let b = std::fs::read(f).unwrap();
//    let v: Vec<char> = Base64::encode(b);
//    let img: String = v.into_iter().collect();
    let img = "../chuckme/gen/".to_string()+&filename+".png";
    let wav = "../chuckme/wav/".to_string()+&filename[0..12];
    o.put_string("img", &img);
    o.put_string("wav", &wav);

    d.put_object(&filename, o);
  }
}

d