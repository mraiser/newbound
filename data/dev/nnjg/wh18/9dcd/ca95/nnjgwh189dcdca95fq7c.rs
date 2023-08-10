// FIXME - assumes Newbound folder is in working directory

let mut repodirx = Path::new("repositories");
if !repodirx.exists() { std::fs::create_dir_all(repodirx); }
let tempdir = repodirx.join(unique_session_id());

let mut a = DataArray::new();
a.push_string("git");
a.push_string("clone");
a.push_string(&url);
a.push_string(&tempdir.clone().into_os_string().into_string().unwrap());
system_call(a);

if !tempdir.exists() { return "ERROR: Unable to clone git repository at ".to_string()+&url; }

let datadirxx = tempdir.join("data");
let runtimedirxx = tempdir.join("runtime");
for datadirx in std::fs::read_dir(&datadirxx).unwrap() {
  let datadirx = datadirx.unwrap();
  let libid = datadirx.file_name().into_string().unwrap();
  let runtimedirx = runtimedirxx.join(libid.clone());
  if runtimedirx.exists() {
    let mut repodir = repodirx.join(libid.clone());
    let mut datadir = Path::new("data").join(libid.clone());
    let mut runtimedir = Path::new("runtime").join(libid.clone());
    if repodir.exists() || datadir.exists() || runtimedir.exists() { 
      std::fs::remove_dir_all(tempdir);
      return "ERROR: There is already a Library named ".to_string()+&libid; 
    }
    else {
      let _x = std::fs::rename(tempdir.clone(), repodir.clone());
      symlink(repodir.join("data").join(libid.clone()).canonicalize().unwrap(), datadir);
      symlink(repodir.join("runtime").join(libid.clone()).canonicalize().unwrap(), runtimedir);
      
      load_library(&libid);
      let _x = rebuild_lib(libid.to_owned());
      println!("UPDATED LIBRARY {:?}", libid);      
      
      return "OK: ".to_string()+&libid;
    }
  }
}
"ERROR: No Newbound Library found".to_string()