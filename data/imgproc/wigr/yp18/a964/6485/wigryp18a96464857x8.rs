let raw = Path::new("/export/train/batch/raw");
let faces = Path::new("/export/train/batch/faces");
std::fs::create_dir_all(faces.clone());

let meta = Path::new("/export/train/batch/json");
std::fs::create_dir_all(meta.clone());

let mut stackx = DataArray::new();
let paths = std::fs::read_dir(raw).unwrap();
for path in paths {
  let path = path.unwrap().path();
  let filename = path.file_name().unwrap().to_os_string().into_string().unwrap();
  stackx.push_string(&filename);
}

let num_threads = num_threads as u64;
for n in 0..num_threads {
  let mut stack = stackx.clone();
  std::thread::spawn(move || {
    println!("Starting thread {} EXTRACT FACES", n);
    
    let Ok(cnn_detector) = FaceDetectorCnn::default() else {
      panic!("Unable to load cnn face detector!");
    };
    let Ok(landmarks) = LandmarkPredictor::default() else {
      panic!("Unable to load landmark predictor!");
    };
    let Ok(face_encoder) = FaceEncoderNetwork::default() else {
      panic!("Error loading Face Encoder.");
    };
    
    let mut count = 0;
    while stack.len() > 0 {
      let filename = stack.pop_property(0).string();
      let path = raw.join(filename);
      let fullname = path.display().to_string();
      let b = process(fullname, meta.to_path_buf(), faces.to_path_buf(), cnn_detector.clone(), landmarks.clone(), face_encoder.clone());
      if b {
        count += 1;
      }
    }
    println!("END THREAD {}/{}", n, count);
  });
}
  
let beat = Duration::from_millis(100);
while stackx.len() > 0 {
  std::thread::sleep(beat);
}

println!("DONE EXTRACTING FACES");
DataObject::new()
}

fn process(fullname:String, meta:PathBuf, faces:PathBuf, cnn_detector:FaceDetectorCnn, landmarks:LandmarkPredictor, face_encoder:FaceEncoderNetwork) -> bool{
  let mut gotone = false;
  let mut ja = DataArray::new();
  let path = Path::new(&fullname);
  let filename = path.file_name().unwrap().to_os_string().into_string().unwrap();
  let json = meta.join(filename.clone()+".json");
  if !json.exists() && filename.ends_with(".png") {
    println!("Processing: {:?}", filename);
    
    let mut image = image::open(fullname.clone()).unwrap().to_rgb8();
    let width = image.width();
    let height = image.height();
    
    let matrix = ImageMatrix::from_image(&image);
    let detector = FaceDetector::default();
    let face_locations = detector.face_locations(&matrix);
    for r in face_locations.iter() {
      let mut x = r.left as u32;
      let mut y = r.top as u32;
      let mut x2 = r.right as u32;
      let mut y2 = r.bottom as u32;
      
      if x > x2 {
        let x3 = x;
        x = x2;
        x2 = x3;
      }
      
      if y > y2 {
        let y3 = y;
        y = y2;
        y2 = y3;
      }
      
      let w = x2 - x;
      let h = y2 - y;
      let c = crop_imm(&image, x, y, w, h);

      let cfile = faces.join(filename.clone());
      let ggg = c.to_image().save_with_format(&cfile, ImageFormat::Png);
      if ggg.is_ok(){
        let ggg = ggg.unwrap();

        let mut rekt = DataObject::new();

        let landmarks = landmarks.face_landmarks(&matrix, &r);
        let encodings = face_encoder.get_face_encodings(&matrix, &[landmarks], 0);
        let b:&[f64] = encodings[0].as_ref();
        let xxx;
        unsafe {
          xxx = std::slice::from_raw_parts(b.as_ptr() as *const u8, b.len() * 8);
        }
        let yyy = Base64::encode(xxx.to_vec());
        let zzz:String = yyy.into_iter().collect();
        rekt.put_string("encodings", &zzz);
        //println!("{:?}", encodings[0]);

        rekt.put_int("x", x as i64);
        rekt.put_int("y", y as i64);
        rekt.put_int("w", w as i64);
        rekt.put_int("h", h as i64);

        let mut jo = DataObject::new();
        jo.put_string("filename", &fullname);
        let c = Command::lookup("imgproc", "batch", "bod");
        let jo = c.execute(jo).unwrap();
        let msg = jo.get_string("msg");
        if msg.starts_with("["){
          let bod = DataArray::from_string(&msg);
          rekt.put_array("body", bod);
        }

        ja.push_object(rekt);

        // FIXME - Handle more faces than just the first
        gotone = true;
        break;
      }
    }
    
    gc();
    
    let mut jo = DataObject::new();
    jo.put_array("faces", ja);

    let mut file = File::create(json).unwrap();
    let _x = file.write_all(jo.to_string().as_bytes()).unwrap();
  }

  return gotone;