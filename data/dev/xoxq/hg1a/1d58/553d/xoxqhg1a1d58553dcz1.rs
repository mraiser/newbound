// Set up the apps a LOCAL library carries. A library ships its apps as
// data/<lib>/_APPS/<app>/ (app.properties + html), but the Applications
// page only lists an app once runtime/<app>/app.properties exists.
// install_lib copies the bundles when it downloads a library from a peer;
// a library that arrived any other way (dev.github.import linking a repo
// with no runtime/ folder, a hand-made link, a copied store) never got
// that step, so its apps show as "Available" on a peer and the Install
// button had nothing to download. This is that step on its own.
//
// It COPIES (as install_lib does) rather than links: runtime/<app> also
// holds the app's own state (botd.properties), which must never be
// written back into a library's store or a repo checkout. An app that is
// already set up (runtime/<app>/app.properties present, including a
// runtime/<app> link to a repo) is left untouched, so this never clobbers
// local settings and is safe to call again.
//
// Returns {status, lib, apps: [names set up now], present: [names already there]}.
let bad = lib.is_empty() || lib == "." || lib == ".." || lib.contains('/') || lib.contains('\\');
if bad { panic!("Invalid library name: '{}'", lib); }
let store = DataStore::new();
let libdir = store.root.join(&lib);
if !libdir.is_dir() { panic!("No library named '{}' on this device", lib); }
let appdata = libdir.join("_APPS");
let appruntime = store.root.parent().unwrap().join("runtime");
let mut made = DataArray::new();
let mut present = DataArray::new();
if appdata.is_dir() {
  let mut ents: Vec<std::path::PathBuf> = fs::read_dir(&appdata).unwrap().flatten().map(|e| e.path()).collect();
  ents.sort();
  for src in ents {
    if !src.is_dir() || !src.join("app.properties").is_file() { continue; }
    let name = src.file_name().unwrap().to_string_lossy().to_string();
    let dest = appruntime.join(&name);
    if dest.join("app.properties").exists() { present.push_string(&name); continue; }
    copy_dir(src.to_string_lossy().to_string(), dest.to_string_lossy().to_string());
    if !dest.join("app.properties").exists() { panic!("Could not set up app '{}' from library '{}'", name, lib); }
    println!("dev.dev.materialize_apps: set up app {:?} from library {:?}", name, lib);
    made.push_string(&name);
  }
}
let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("lib", &lib);
o.put_array("apps", made);
o.put_array("present", present);
o
