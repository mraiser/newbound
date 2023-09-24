const face_padding: [f64; 4] = [0.1,0.33,0.1,0.1];
const body_padding: [f64; 4] = [0.1,0.1,0.1,0.1];

let good = Path::new("/export/train/batch/good");
let raw = Path::new("/export/train/batch/raw");
let json = Path::new("/export/train/batch/json");
let matches = Path::new("/export/train/batch/match");
let dest = Path::new("/export/train/batch/out");
std::fs::remove_dir_all(dest.clone());
std::fs::create_dir_all(dest.join("face").clone());
std::fs::create_dir_all(dest.join("body").clone());

let mut CACHE = DataArray::new();

fn pad(a:[u32; 4], w:u32, h:u32, d:[f64; 4]) -> [u32; 4]{
  let foundw = a[2] as i64 - a[0] as i64;
  let foundh = a[3] as i64 - a[1] as i64;

  let mut x = a[0] as i64 - (foundw as f64 * d[0]) as i64;
  let mut y = a[1] as i64 - (foundw as f64 * d[1]) as i64;
  let mut x2 = a[2] as i64 + (foundh as f64 * d[2]) as i64;
  let mut y2 = a[3] as i64 + (foundh as f64 * d[3]) as i64;
  
  if x < 0 { x = 0; }
  if y < 0 { y = 0; }
  if x2 > w as i64 { x2 = w as i64; }
  if y2 > h as i64  { y2 = h as i64; }

  [x as u32, y as u32, (x2-x) as u32, (y2-y) as u32]
}

fn process(filename:&str, raw:PathBuf, json:PathBuf, dest:PathBuf){
  println!("pull {}", filename.to_string());
  let f = raw.join(filename);
  let mut image = image::open(f).unwrap().to_rgb8();
  let imgw = image.width();
  let imgh = image.height();
  
  let f = json.join(filename.to_string()+".json");
  let d = DataObject::from_string(&read_all_string(f.display().to_string()).to_string());
  //println!("{}", d.to_string());
  
  let jo = d.get_array("faces").get_object(0);
  let x = jo.get_int("x") as u32;
  let y = jo.get_int("y") as u32;
  let w = jo.get_int("w") as u32;
  let h = jo.get_int("h") as u32;
  
  let a = pad([x, y, x+w, y+h], imgw, imgh, face_padding);
  //println!("{:?}", a);
  let c = crop_imm(&image, a[0], a[1], a[2], a[3]);
  let cfile = dest.join("face").join(filename.clone());
  let _x = c.to_image().save_with_format(&cfile, ImageFormat::Png).unwrap();
  
  if jo.has("body"){
    let bod = jo.get_array("body");
    let x = bod.get_int(0) as u32;
    let y = bod.get_int(1) as u32;
    let w = bod.get_int(2) as u32 - x;
    let h = bod.get_int(3) as u32 - y;

    let a = pad([x, y, x+w, y+h], imgw, imgh, face_padding);
    let c = crop_imm(&image, a[0], a[1], a[2], a[3]);
    let cfile = dest.join("body").join(filename.clone());
    let _x = c.to_image().save_with_format(&cfile, ImageFormat::Png).unwrap();
  }
}

let paths = std::fs::read_dir(good).unwrap();
for path in paths {
  let path = path.unwrap().path();
  let basename = path.file_name().unwrap().to_str().unwrap();
  let i = basename.find("_").unwrap()+1;
  let basename = basename[i..i+22].to_string();
  
  let filename = basename.clone()+".png";
  //println!("check {}", filename.to_string());
  CACHE.push_string(&filename);
  //process(&filename, raw.to_path_buf(), json.to_path_buf(), dest.to_path_buf());
  
  let filename = &(basename.clone()+".png.txt");
  let f = matches.join(filename);
  let file = File::open(f).unwrap();
  let lines = std::io::BufReader::new(file).lines();
  for line in lines {
    let line = line.unwrap();
    //println!("pull {}", line.to_string());
    CACHE.push_string(&line);
  //process(&line, raw.to_path_buf(), json.to_path_buf(), dest.to_path_buf());
  }
}
  
let num_threads = 16; //num_threads as u64;
for n in 0..num_threads {
  let mut stack = CACHE.clone();
  std::thread::spawn(move || {
    println!("Starting thread {} EXTRACT FACES", n);
    let mut count = 0;
    while stack.len() > 0 {
      let filename = stack.pop_property(0).string();
      process(&filename, raw.to_path_buf(), json.to_path_buf(), dest.to_path_buf());
    }
  });
}

DataObject::new()