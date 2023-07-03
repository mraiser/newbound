  let path = Path::new(&file);
  let mut hasher = Blake2b512::new();
  hash_path(&path, &mut hasher);
  let res = hasher.finalize();
  let mut s = "".to_string();
  for b in res {
    s += &format!("{:02X?}", b);
  }
  s
}

pub fn hash_path(path:&Path, hasher:&mut Blake2b512) {
  if path.is_dir() { 
    hash_dir(path, hasher); 
  }
  else {
    hash_file(path, hasher);
  }
}

pub fn hash_file(path:&Path, hasher:&mut Blake2b512) {
  let mut f = File::open(path).unwrap();
  let mut buffer = Vec::new();
  let _x = f.read_to_end(&mut buffer).unwrap();
  hasher.update(&buffer);
}

pub fn hash_dir(path:&Path, hasher:&mut Blake2b512) {
  let mut vec = Vec::new();
  for file in fs::read_dir(path).unwrap() {
    let path = file.unwrap().path().into_os_string().into_string().unwrap();
    if !path.starts_with(".") {
      vec.push(path);
    }
  }
  vec.sort();
  for file in vec {
    let path = Path::new(&file);
    hash_path(&path, hasher);
  }