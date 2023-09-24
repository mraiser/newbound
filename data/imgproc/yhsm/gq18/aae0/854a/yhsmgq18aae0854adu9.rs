let good = Path::new("/export/train/batch/good_original");
let raw = Path::new("/export/train/batch/raw");
let dest = Path::new("/export/train/batch/classify");

let mut stackx = DataArray::new();
let paths = std::fs::read_dir(good).unwrap();
for path in paths {
  let path = path.unwrap().path();
  let filename = path.file_name().unwrap().to_os_string().into_string().unwrap();
  let i = filename.find("_").unwrap();
  let filename = &filename[i+1..];
  stackx.push_string(filename);
}

let mut groupsx = DataArray::new();
let num_threads = 16; //num_threads as u64;
for n in 0..num_threads {
  let mut stack = stackx.clone();
  let mut groups = groupsx.clone();
  std::thread::spawn(move || {
    println!("Starting thread {} EXTRACT FACES", n);
    
    let detector = FaceDetector::default();
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
      let b = process(fullname, detector.clone(), landmarks.clone(), face_encoder.clone(), groups.clone(), dest.to_path_buf()); //, meta.to_path_buf(), faces.to_path_buf(), cnn_detector.clone(), landmarks.clone(), face_encoder.clone());
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

DataObject::new()
}

fn addTo(dest:PathBuf, fullname:&str, index:i64){
  let path1 = Path::new(fullname);
  let filename = path1.file_name().unwrap().to_os_string().into_string().unwrap();
  let path2 = dest.join(index.to_string());
  std::fs::create_dir_all(&path2);
  let path2 = path2.join(filename);
  std::fs::copy(path1, path2);
}

const SIMILAR:f64 = 0.6;

fn process(fullname:String, detector:FaceDetector, landmarks:LandmarkPredictor, face_encoder:FaceEncoderNetwork, mut groups:DataArray, dest:PathBuf) -> bool {
  println!("Processing: {:?}", fullname);
  let mut img = image::open(fullname.clone()).unwrap().to_rgb8();
  let mut img = image::imageops::resize(&img, 960, 540, image::imageops::Nearest);
  let matrix = ImageMatrix::from_image(&img);
  let face_locations = detector.face_locations(&matrix);
  for r in face_locations.iter() {
    let landmarks = landmarks.face_landmarks(&matrix, &r);
    let encodings = face_encoder.get_face_encodings(&matrix, &[landmarks], 0);
    if encodings.len() > 0 {
      let enc1 = &encodings[0];
      let mut i = 0;
      for enc2 in groups.objects() {
        let xxx = enc2.string();
        let yyy = Base64::decode(xxx.chars().collect());
        let enc2;
        unsafe {
          let zzz = std::slice::from_raw_parts(yyy.as_ptr() as *const f64, yyy.len() / 8);    
          enc2 = FaceEncoding::from_vec(&zzz.to_vec()).unwrap();
        }
        let d = enc1.distance(&enc2);
        if d <= SIMILAR {
          addTo(dest.clone(), &fullname, i);
          return true;
        }
        i += 1;
      }
      
      println!("FOUND {}", fullname);
      let b:&[f64] = enc1.as_ref();
      let xxx;
      unsafe {
        xxx = std::slice::from_raw_parts(b.as_ptr() as *const u8, b.len() * 8);
      }
      let yyy = Base64::encode(xxx.to_vec());
      let zzz:String = yyy.into_iter().collect();
      groups.push_string(&zzz);
      addTo(dest.clone(), &fullname, i);

      return true;
    }    
  }
  false