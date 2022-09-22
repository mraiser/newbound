build(&lib, &ctl, &cmd);
let mut ja = DataArray::new();
ja.push_str("cargo");
ja.push_str("build");
ja.push_str("-p");
ja.push_str("cmd");
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

if b { panic!("{}",s); }

"OK".to_string()