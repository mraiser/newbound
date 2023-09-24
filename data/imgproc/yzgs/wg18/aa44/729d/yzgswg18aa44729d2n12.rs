let good = Path::new("/export/train/batch/good");
let raw = Path::new("/export/train/batch/raw");

let paths = std::fs::read_dir(good).unwrap();
for path in paths {
  let path = path.unwrap().path();
  let basename = path.file_stem().unwrap().to_str().unwrap();
  let filename = &(basename[0..22].to_string()+".png");
  let img = raw.join(filename);
  let fullname = img.display().to_string();
  
  let mut jo = DataObject::new();
  jo.put_string("filename", &fullname);
  
  let c = Command::lookup("imgproc", "batch", "bod");
  return c.execute(jo).unwrap();
}

DataObject::new()