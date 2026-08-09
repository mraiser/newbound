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

      // An FFI library roots its own hot-reload crate. Link the repo's
      // tracked crate dir (its Cargo.toml carries the feature wiring the
      // builder's default lacks) and teach the initializer about the new
      // crate - that regeneration is what the one restart activates.
      let mut ffi_root = "".to_string();
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
            build_all();
            rebuild_rust_api();
            ffi_root = root;
          }
        }
      }

      let _x = rebuild_lib(libid.to_owned());
      println!("UPDATED LIBRARY {:?}", libid);      
      
      if ffi_root != "" {
        // Build the crate dylib unconditionally: rebuild_lib skips the build
        // when the repo's tracked generated src already matches the store,
        // which on a fresh install means no artifact was ever built.
        let ja = build_compile_command();
        let (bad, err) = execute_compile_command(ja, ffi_root.to_owned());
        if bad { return "ERROR: crate build failed: ".to_string()+&err; }

        // Rebuild the host so the next start loads the new crate.
        let ja = build_compile_command();
        let (bad, err) = execute_compile_command(ja, ".".to_string());
        if bad { return "ERROR: host rebuild failed: ".to_string()+&err; }
        return "OK: ".to_string()+&libid+" - restart Newbound once to activate the new hot-reload crate";
      }

      return "OK: ".to_string()+&libid;
    }
  }
}
"ERROR: No Newbound Library found".to_string()