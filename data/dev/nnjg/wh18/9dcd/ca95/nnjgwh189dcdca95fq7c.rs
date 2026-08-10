// FIXME - assumes Newbound folder is in working directory

let repodirx = Path::new("repositories");
if !repodirx.exists() { let _x = std::fs::create_dir_all(repodirx); }
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
    let repodir = repodirx.join(libid.clone());
    let datadir = Path::new("data").join(libid.clone());
    let runtimedir = Path::new("runtime").join(libid.clone());
    if repodir.exists() || datadir.exists() || runtimedir.exists() { 
      let _x = std::fs::remove_dir_all(tempdir);
      return "ERROR: There is already a Library named ".to_string()+&libid; 
    }
    else {
      let _x = std::fs::rename(tempdir.clone(), repodir.clone());
      let _x = symlink(repodir.join("data").join(libid.clone()).canonicalize().unwrap(), datadir);
      let _x = symlink(repodir.join("runtime").join(libid.clone()).canonicalize().unwrap(), runtimedir);
      
      load_library(&libid);

      // For an FFI library the repo may carry its tracked crate dir
      // (reviewable src, manifest with the feature wiring) - link it
      // before activation so the build uses it.
      let meta_path = repodir.join("data").join(libid.clone()).join("meta.json");
      if let Ok(s) = std::fs::read_to_string(&meta_path) {
        let meta = DataObject::from_string(&s);
        if meta.has("cargo") {
          let cargo = meta.get_object("cargo");
          if cargo.has("ffi") && cargo.get_boolean("ffi") {
            let root = if meta.has("root") { meta.get_string("root") } else { libid.to_owned() };
            let cratesrc = repodir.join(&root);
            let cratedst = Path::new(&root).to_path_buf();
            if cratesrc.exists() && !cratedst.exists() {
              let _x = symlink(cratesrc.canonicalize().unwrap(), cratedst);
            }
          }
        }
      }

      // Shared activation: rebuild for static libs, initializer + crate +
      // host build for FFI libs (dev.dev.activate_lib).
      let r = activate_lib(libid.to_owned());
      println!("UPDATED LIBRARY {:?}", libid);
      if r.starts_with("ERROR") { return r; }
      if r.starts_with("RESTART") {
        return "OK: ".to_string()+&libid+" - restart Newbound once to activate the new hot-reload crate";
      }
      return "OK: ".to_string()+&libid;
    }
  }
}
"ERROR: No Newbound Library found".to_string()