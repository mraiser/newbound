let mut a = DataArray::new();

let mut repodir = Path::new("repositories");
if repodir.exists() {
  for libdir in std::fs::read_dir(&repodir).unwrap() {
    let libdir = libdir.unwrap();
    let libid = libdir.file_name().into_string().unwrap();
    if libdir.path().join("data").exists(){
      a.push_string(&libid);
    }
  }
}

let mut d = DataObject::new();
d.put_array("list", a);
d