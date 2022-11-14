let store = DataStore::new();
let root = store.get_lib_root(&lib);
let b = build(&lib, &ctl, &cmd, &root);
if b {
  let ja = build_compile_command(root);
  println!("{}", ja.to_string());

  let (b, s) = execute_compile_command(ja);
  if b { panic!("{}",s); }
}

"OK".to_string()
}

pub fn execute_compile_command(ja:DataArray) -> (bool, String) {
  let o = system_call(ja);
  let e = o.get_string("err");
  let lines = io::BufReader::new(e.as_bytes()).lines();
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
  (b, s)
}

pub fn build_compile_command(root:PathBuf) -> DataArray {
  let mut ja = DataArray::new();
  ja.push_str("cargo");
  ja.push_str("build");
  
  let store = DataStore::new();
  if root == store.root.parent().unwrap().join("cmd") {
    ja.push_str("-p");
    ja.push_str("cmd");
  }

  #[cfg(not(debug_assertions))]
  ja.push_str("--release");

  let mut features = "".to_string();

  #[cfg(feature="serde_support")]
  {
    features += ",serde_support";
  }

  #[cfg(feature="reload")]
  {
    features += ",reload";
  }

  if features != "".to_string() {
    features = features[1..].to_string();
    features = "--features=".to_string() + &features;
    ja.push_str(&features);
  }
  ja