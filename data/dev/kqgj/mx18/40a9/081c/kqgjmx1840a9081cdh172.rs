    fn gitc(path: &std::path::Path, args: &[&str]) -> (bool, String) {
        match std::process::Command::new("git").arg("--no-optional-locks").arg("-C").arg(path).args(args).output() {
            Ok(o) => (o.status.success(), String::from_utf8_lossy(&o.stdout).to_string()),
            Err(_) => (false, String::new()),
        }
    }
    fn walk_files(base: &std::path::Path, dir: &std::path::Path, out: &mut Vec<String>) {
        if let Ok(rd) = fs::read_dir(dir) {
            for e in rd.flatten() {
                let p = e.path();
                if fs::symlink_metadata(&p).map(|m| m.is_dir()).unwrap_or(false) { walk_files(base, &p, out); }
                else if let Ok(r) = p.strip_prefix(base) { out.push(r.to_string_lossy().replace('\\', "/")); }
            }
        }
    }

    // data/<lib> may be a symlink into a git checkout (dev.github.import).
    // A push from a peer is then written THROUGH the link - the link survives
    // and the checkout becomes a marked "peer overlay" (dev.git.overlay) that
    // the sweepers never commit and the update verbs restore before pulling.
    // Refused when the checkout already holds this box's own uncommitted
    // edits to the library: the later restore would discard them.
    let link = DataStore::new().root.join(&lib);
    let mut link_target: Option<std::path::PathBuf> = None;
    let (mut ov_repo, mut ov_rel, mut ov_head) = (String::new(), String::new(), String::new());
    if fs::symlink_metadata(&link).map(|m| m.file_type().is_symlink()).unwrap_or(false) {
        let target = match link.canonicalize() {
            Ok(t) => t,
            Err(_) => panic!("data/{} is a symlink whose target is missing - fix or remove the link first", lib),
        };
        let (ok, top) = gitc(&target, &["rev-parse", "--show-toplevel"]);
        if ok && !top.trim().is_empty() {
            if let Ok(topc) = std::path::Path::new(top.trim()).canonicalize() {
                if let Ok(rel) = target.strip_prefix(&topc) {
                    let rel = rel.to_string_lossy().replace('\\', "/");
                    if !rel.is_empty() {
                        let marked = crate::dev::git::overlay::overlay("list".to_string(), String::new(), lib.clone(), DataObject::new())
                            .try_get_int("count").unwrap_or(0) > 0;
                        if !marked {
                            let (_, st) = gitc(&topc, &["status", "--porcelain", "--", &rel]);
                            if !st.trim().is_empty() {
                                panic!("Refused: {} is installed from the git checkout {} and has uncommitted edits there ({} path(s)). Commit or discard them first - a push from a peer is undone by restoring the checkout, which would discard them.", lib, topc.display(), st.lines().count());
                            }
                        }
                        ov_head = gitc(&topc, &["rev-parse", "HEAD"]).1.trim().to_string();
                        ov_repo = topc.to_string_lossy().to_string();
                        ov_rel = rel;
                    }
                }
            }
        }
        link_target = Some(target);
    }

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
    let dest_session_id = unique_session_id();
    let filename = dest_session_id.to_owned()+".zip";
    let download_path = dir.join(&filename);
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

    let destdir = dir.join(&dest_session_id);
    fs::create_dir_all(&destdir).expect("Unable to create destination directory for unzip");

    let download_path_str = download_path.to_string_lossy().into_owned();
    let destdir_path_str = destdir.to_string_lossy().into_owned();

    let unzip_command_string = format!(
        "unzip -oq '{}' -d '{}'",
        download_path_str,
        destdir_path_str
    );

    let mut cmd_array = DataArray::new();
    if cfg!(windows) {
        // No bash or unzip on Windows. Its own tar (bsdtar, in System32
        // since Windows 10 1803) reads zip; called by full path because
        // Git for Windows puts a GNU tar earlier on PATH, and that one can't.
        let tar = std::path::Path::new(&std::env::var("SystemRoot").unwrap_or_else(|_| "C:/Windows".to_string())).join("System32").join("tar.exe");
        cmd_array.push_string(&tar.to_string_lossy());
        cmd_array.push_string("-xf");
        cmd_array.push_string(&download_path_str);
        cmd_array.push_string("-C");
        cmd_array.push_string(&destdir_path_str);
    } else {
        cmd_array.push_string("bash");
        cmd_array.push_string("-c");
        cmd_array.push_string(&unzip_command_string);
    }

    let result_array = system_call(cmd_array);

    match result_array.get_string("status") == "ok" {
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

    let h = hash(destdir.to_owned().into_os_string().into_string().unwrap());

    let store = DataStore::new();
    if h != meta.get_string("hash") { panic!("Hashes do not match... abort."); }

    let datadir = store.root.join(&lib);
    // what the old bundle shipped, so files the new one dropped leave runtime/ too
    let mut shipped_before: Vec<String> = Vec::new();
    walk_files(&datadir.join("_APPS"), &datadir.join("_APPS"), &mut shipped_before);

    match &link_target {
        Some(target) => {
            // write through the link: empty the directory it points at, keep the link
            if let Ok(rd) = fs::read_dir(target) {
                for e in rd.flatten() {
                    let p = e.path();
                    if fs::symlink_metadata(&p).map(|m| m.is_dir()).unwrap_or(false) { let _ = remove_dir_all(&p); }
                    else { let _ = remove_file(&p); }
                }
            }
            copy_dir(destdir.to_owned().into_os_string().into_string().unwrap(), target.to_owned().into_os_string().into_string().unwrap());
            if !ov_repo.is_empty() {
                let mut e = DataObject::new();
                e.put_string("peer", &uuid);
                e.put_string("peer_name", &user.try_get_string("displayname").unwrap_or_default());
                e.put_int("version", v);
                e.put_string("repo_path", &ov_repo);
                e.put_string("rel", &ov_rel);
                e.put_string("head", &ov_head);
                e.put_string("hash", &h);
                let m = crate::dev::git::overlay::overlay("mark".to_string(), String::new(), lib.clone(), e);
                if m.try_get_string("status").unwrap_or_default() != "ok" {
                    println!("WARNING: peer overlay of {} could not be marked: {}", lib, m.try_get_string("msg").unwrap_or_default());
                }
            }
        }
        None => {
            let _x = remove_dir_all(&datadir);
            copy_dir(destdir.to_owned().into_os_string().into_string().unwrap(), datadir.to_owned().into_os_string().into_string().unwrap());
        }
    }

    // runtime/<app> by the shared rule (dev.dev.refresh_apps): shipped files
    // replaced, botd.properties kept, apps= never written, a new app copied
    // in inactive, a symlinked runtime/<app> left alone.
    let mut removed = DataArray::new();
    for r in &shipped_before {
        if r.contains('/') && !datadir.join("_APPS").join(r).exists() { removed.push_string(r); }
    }
    let lid = lib.to_owned();
    match std::panic::catch_unwind(move || crate::dev::dev::refresh_apps::refresh_apps(lid, DataArray::new(), removed)) {
        Ok(r) => println!("UPDATED LIBRARY APPS {}", r.to_string()),
        Err(_) => println!("WARNING: app refresh of {} failed", lib),
    }

    // Shared activation (dev.dev.activate_lib): a static library rebuilds in
    // place; an FFI library gets its crate manifest mended, its crate and the
    // host built, and needs ONE restart - the true return signals that, and
    // the caller must surface it to the user.
    let r = activate_lib(lib.to_owned());
    if r.starts_with("ERROR") { panic!("{}", r); }
    println!("{}", r);
    let rebuild = r.starts_with("RESTART");

    init_globals();

    let _x = remove_dir_all(&destdir).unwrap();

    let devroot = store.root.parent().unwrap().join("runtime").join("dev").join("libraries");
    let _x = create_dir_all(&devroot);
    let hashfile = devroot.join(&(lib.to_owned()+".hash"));
    fs::write(hashfile, &h).expect("Unable to write file");

    let mut x = v;
    while x > 0 {
      x -= 1;
      let zipfile_to_remove = devroot.join(&(lib.to_owned()+"_"+&x.to_string()+".zip"));
      if zipfile_to_remove.exists() {
        let _x = remove_file(zipfile_to_remove);
      }
    }
    let zipfile_dest = devroot.join(&(lib.to_owned()+"_"+&v.to_string()+".zip"));
    fs::copy(download_path, zipfile_dest).expect("Unable to copy file");

    let metafile = devroot.join(&(lib.to_owned()+".json"));
    fs::write(metafile, &meta.to_string()).expect("Unable to write file");

    return rebuild;