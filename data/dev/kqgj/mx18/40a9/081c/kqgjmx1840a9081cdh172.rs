/*
let mut d = DataObject::new();
d.put_string("lib", &lib);
let o = exec(uuid.to_owned(), "dev".to_string(), "lib_info".to_string(), d.clone());
let meta = o.get_object("data");
let v = meta.get_string("version").parse::<i64>().unwrap();
d.put_int("version", v);
let o = exec(uuid.to_owned(), "dev".to_string(), "lib_archive".to_string(), d);
let stream_id = o.get_int("stream_id");
let user = get_user(&uuid).unwrap();
let mut con = get_best(user.clone()).unwrap();
let buf = con.join_stream(stream_id);

let dir = temp_dir();
let dest = unique_session_id();
let filename = dest.to_owned()+".zip";
let download = dir.join(filename);
println!("download {:?}", download);
{
  let mut f = File::create(download.to_owned()).expect("Unable to create file");
  let beat = Duration::from_millis(100);
  let mut timeout = 0;
  while buf.is_read_open() {
    let bytes = buf.read(4096);
    if bytes.len() > 0 { let _x = f.write(&bytes).unwrap(); }
    else {
      timeout += 1;
      if timeout > 300 { panic!("No library stream data in 30 seconds... abort."); }
      thread::sleep(beat);
    }
  }
}

con.end_stream_read(stream_id);

let f = File::open(download.to_owned()).expect("Unable to open file");
let mut zip = zip::ZipArchive::new(f).unwrap();
let destdir = dir.join(dest);
let _x = zip.extract(&destdir).unwrap();
let h = hash(destdir.to_owned().into_os_string().into_string().unwrap());

let store = DataStore::new();
let mut rebuild = false;
if h != meta.get_string("hash") { panic!("Hashes do not match... abort."); }

let datadir = store.root.join(&lib);
let _x = remove_dir_all(&datadir);
copy_dir(destdir.to_owned().into_os_string().into_string().unwrap(), datadir.to_owned().into_os_string().into_string().unwrap());

let appdata = datadir.join("_APPS");
let appruntime = store.root.parent().unwrap().join("runtime");
for file in fs::read_dir(&appdata).unwrap() {
  let appsrc = file.unwrap().path();
  let appname = &appsrc.file_name().unwrap();
  if appsrc.is_dir() {
    let appdest = appruntime.join(appname);
    copy_dir(appsrc.to_owned().into_os_string().into_string().unwrap(), appdest.to_owned().into_os_string().into_string().unwrap());
    if build_lib(lib.to_owned()) { rebuild = true; }
    println!("UPDATED LIBRARY {:?}", appname);
  }
}
/ *
if rebuild {
  //let root = store.get_lib_root(&lib);
  let ja = build_compile_command();
  println!("{}", ja.to_string());

  let (b, s) = execute_compile_command(ja);
  if b { panic!("{}",s); }
}
* /
init_globals();

let _x = remove_dir_all(&destdir).unwrap();

let devroot = store.root.parent().unwrap().join("runtime").join("dev").join("libraries");
let _x = create_dir_all(&devroot);
let hashfile = devroot.join(&(lib.to_owned()+".hash"));
fs::write(hashfile, &h).expect("Unable to write file");

let mut x = v;
while x > 0 {
  x -= 1;
  let zipfile = devroot.join(&(lib.to_owned()+"_"+&x.to_string()+".zip"));
  let _x = remove_file(zipfile);
}
let zipfile = devroot.join(&(lib.to_owned()+"_"+&v.to_string()+".zip"));
fs::copy(download, zipfile).expect("Unable to copy file");

let metafile = devroot.join(&(lib.to_owned()+".json"));
fs::write(metafile, &meta.to_string()).expect("Unable to write file");

return rebuild;
*/

    let mut d = DataObject::new();
    d.put_string("lib", &lib);
    let o = exec(uuid.to_owned(), "dev".to_string(), "lib_info".to_string(), d.clone());
    let meta = o.get_object("data");
    let v = meta.get_string("version").parse::<i64>().unwrap();
    d.put_int("version", v);
    let o = exec(uuid.to_owned(), "dev".to_string(), "lib_archive".to_string(), d);
    let stream_id = o.get_int("stream_id");
    let user = get_user(&uuid).unwrap();
    let mut con = get_best(user.clone()).unwrap();
    let buf = con.join_stream(stream_id);

    let dir = temp_dir();
    let dest_session_id = unique_session_id(); // Renamed to avoid conflict with 'dest' variable name if any
    let filename = dest_session_id.to_owned()+".zip";
    let download_path = dir.join(&filename); // Renamed to avoid conflict
    println!("download {:?}", download_path);
    {
      let mut f = File::create(download_path.to_owned()).expect("Unable to create file");
      let beat = Duration::from_millis(100);
      let mut timeout = 0;
      while buf.is_read_open() {
        let bytes = buf.read(4096);
        if bytes.len() > 0 { let _x = f.write(&bytes).unwrap(); }
        else {
          timeout += 1;
          if timeout > 300 { panic!("No library stream data in 30 seconds... abort."); }
          thread::sleep(beat);
        }
      }
    }

    con.end_stream_read(stream_id);

    // --- Replacement for zip crate extraction ---
    let destdir = dir.join(&dest_session_id);
    fs::create_dir_all(&destdir).expect("Unable to create destination directory for unzip");

    let download_path_str = download_path.to_string_lossy().into_owned();
    let destdir_path_str = destdir.to_string_lossy().into_owned();

    // Command: unzip -oq {zipfile} -d {destination_directory}
    // -o: overwrite files without prompting
    // -q: quiet mode
    // Note: Simple string formatting for paths can be vulnerable.
    let unzip_command_string = format!(
        "unzip -oq '{}' -d '{}'",
        download_path_str,
        destdir_path_str
    );

    let mut cmd_array = DataArray::new();
    cmd_array.push_string("bash");
    cmd_array.push_string("-c");
    cmd_array.push_string(&unzip_command_string);

    // println!("UNZIP CMD {}", cmd_array.to_string()); // For debugging

    let result_array = system_call(cmd_array); // Assumed to be available

    // println!("UNZIP RESULT {}", result_array.to_string()); // For debugging

    match result_array.get_string("status") == "ok" { // Check exit code at index 0
        true => {
            // Unzip successful
        }
        false => {
            panic!(
                "system_call result for unzip did not contain a valid exit code at index 0. Output: {}",
                result_array.to_string()
            );
        }
    }
    // --- End of replacement ---

    let h = hash(destdir.to_owned().into_os_string().into_string().unwrap());

    let store = DataStore::new();
    let mut rebuild = false;
    if h != meta.get_string("hash") { panic!("Hashes do not match... abort."); }

    let datadir = store.root.join(&lib);
    let _x = remove_dir_all(&datadir);
    copy_dir(destdir.to_owned().into_os_string().into_string().unwrap(), datadir.to_owned().into_os_string().into_string().unwrap());

    let appdata = datadir.join("_APPS");
    let appruntime = store.root.parent().unwrap().join("runtime");
    if appdata.exists() && appdata.is_dir() { // Added checks for appdata existence
        for file_entry in fs::read_dir(&appdata).unwrap() { // Renamed 'file' to 'file_entry'
          let appsrc = file_entry.unwrap().path(); // Renamed 'file' to 'file_entry'
          let appname = &appsrc.file_name().unwrap();
          if appsrc.is_dir() {
            let appdest = appruntime.join(appname);
            copy_dir(appsrc.to_owned().into_os_string().into_string().unwrap(), appdest.to_owned().into_os_string().into_string().unwrap());
            if build_lib(lib.to_owned()) { rebuild = true; }
            println!("UPDATED LIBRARY {:?}", appname);
          }
        }
    }
    /*
    if rebuild {
      //let root = store.get_lib_root(&lib);
      let ja = build_compile_command();
      println!("{}", ja.to_string());

      let (b, s) = execute_compile_command(ja);
      if b { panic!("{}",s); }
    }
    */
    init_globals();

    let _x = remove_dir_all(&destdir).unwrap();

    let devroot = store.root.parent().unwrap().join("runtime").join("dev").join("libraries");
    let _x = create_dir_all(&devroot);
    let hashfile = devroot.join(&(lib.to_owned()+".hash"));
    fs::write(hashfile, &h).expect("Unable to write file");

    let mut x = v;
    while x > 0 {
      x -= 1;
      let zipfile_to_remove = devroot.join(&(lib.to_owned()+"_"+&x.to_string()+".zip")); // Renamed variable
      if zipfile_to_remove.exists() { // Added check before removing
        let _x = remove_file(zipfile_to_remove); // remove_file can error, consider handling
      }
    }
    let zipfile_dest = devroot.join(&(lib.to_owned()+"_"+&v.to_string()+".zip")); // Renamed variable
    fs::copy(download_path, zipfile_dest).expect("Unable to copy file"); // download_path was download

    let metafile = devroot.join(&(lib.to_owned()+".json"));
    fs::write(metafile, &meta.to_string()).expect("Unable to write file");

    return rebuild;