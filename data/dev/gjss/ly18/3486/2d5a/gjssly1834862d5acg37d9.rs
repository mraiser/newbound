let store = DataStore::new();
let root = store.get_lib_root(&lib);
let b = build(&lib, &ctl, &cmd, &root);
if b {
  //compile_rust();
  let ja = build_compile_command();
  let (b, s) = execute_compile_command(ja, root.display().to_string());
  if b { panic!("{}",s); }
}

"OK".to_string()
}

pub fn system_call_in_dir(command:DataArray, dir:String) -> DataObject {
  let mut out = DataObject::new();

  let mut command = command.clone();
  let a = command.get_string(0);
  command.remove_property(0);

  let mut args = Vec::<String>::new();
  for arg in command.objects() {
    args.push(arg.string());
  }

  println!("executing command in directory {}", &dir);
  let cmd = Command::new(&a)
  .args(args)
  .current_dir(&dir)
  .stderr(Stdio::piped())
  .stdout(Stdio::piped())
  .spawn();

  if cmd.is_err() {
    let msg = "Unable to execute system call ".to_string()+&a+" "+&command.to_string();
    println!("{}", msg);
    out.put_string("err", &msg);
    out.put_string("status", "err");
  }
  else {
    let cmd = cmd.unwrap();
    let output = cmd.wait_with_output().unwrap();
    let result = std::str::from_utf8(&output.stdout).unwrap();
    let error = std::str::from_utf8(&output.stderr).unwrap();

    out.put_string("status", "ok");
    out.put_string("out", result);
    out.put_string("err", error);
  }

  out

}

pub fn execute_compile_command(ja:DataArray, dir:String) -> (bool, String) {
//pub fn execute_compile_command(ja:DataArray) -> (bool, String) {
  let o = system_call_in_dir(ja, dir);
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

pub fn build_compile_command() -> DataArray {
  let mut ja = DataArray::new();
  ja.push_string("cargo");
  ja.push_string("build");
  
//  let store = DataStore::new();
//  if root == store.root.parent().unwrap().join("cmd") {
//    ja.push_string("-p");
//    ja.push_string("cmd");
//  }

  #[cfg(not(debug_assertions))]
  ja.push_string("--release");

  let mut features = "".to_string();

  #[cfg(feature="serde_support")]
  {
    features += ",serde_support";
  }

  #[cfg(feature="reload")]
  {
    features += ",reload";
  }

  #[cfg(feature="python_runtime")]
  {
    features += ",python_runtime";
  }

  #[cfg(feature="javascript_runtime")]
  {
    features += ",javascript_runtime";
  }

  #[cfg(feature="java_runtime")]
  {
    features += ",java_runtime";
  }

  #[cfg(feature="webview")]
  {
    features += ",webview";
  }

  if features != "".to_string() {
    features = features[1..].to_string();
    features = "--features=".to_string() + &features;
    ja.push_string(&features);
  }
  ja
