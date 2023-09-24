let matches = Path::new("/export/train/batch/match");
let faces = Path::new("/export/train/batch/faces");
let good = Path::new("/export/train/batch/good");
std::fs::remove_dir_all(good.clone());
std::fs::create_dir_all(good.clone());

let mut CACHE = DataObject::new();
let mut count = 0;

let mut paths: Vec<_> = std::fs::read_dir(matches).unwrap()
  .map(|r| r.unwrap())
  .collect();
paths.sort_by_key(|dir| 0 - dir.metadata().unwrap().len() as i64);
for path in paths {
  let path = path.path();
  //let fullname = path.display().to_string();
  //let filename = path.file_name().unwrap().to_os_string().into_string().unwrap();
  let basename = path.file_stem().unwrap().to_str().unwrap();
  let basename = &(basename[0..22].to_string()+".png");
  if !CACHE.has(&basename){
    CACHE.put_boolean(&basename, true);
    count += 1;
    let size_of_file = path.metadata().unwrap().len();
    println!("Scanning: {} / {}", path.display(), size_of_file);
    
    let src = faces.join(basename);
    let dst = good.join(size_of_file.to_string()+"_"+basename);

    println!("MOVE {:?} TO {:?}", src, dst);
    std::fs::copy(src, dst);
    
    let file = File::open(path).unwrap();
    let lines = std::io::BufReader::new(file).lines();
    for line in lines {
      let line = line.unwrap();
      CACHE.put_boolean(&line, true);
    }
  }
  
  
  
}

DataObject::new()