/*

1. build _APPS/[APPNAME]
2. build runtime/dev/libraries
3. install _APPS/[APPNAME]

*/

let mut data = data.duplicate();
let appversion = Data::as_string(data.get_property("version")).parse::<i64>().unwrap() + 1;
data.put_i64("version", appversion);

let store = DataStore::new();

let appid = data.get_string("id");
let appname = data.get_string("name");
let applib = data.get_string("ctldb");
let ctlid = data.get_string("ctlid");

let approot = store.root.parent().unwrap().join("runtime").join(&appid);
let appsrc = approot.join("src");
let devroot = store.root.parent().unwrap().join("runtime").join("dev").join("libraries");
create_dir_all(&devroot);

/* 1. build _APPS/[APPNAME] */
let path = store.root.join(&applib).join("_APPS").join(&appid);
create_dir_all(&path);
let propfile = path.join("app.properties");
write_properties(propfile.into_os_string().into_string().unwrap(), data.duplicate());
let dest = path.join("src");
create_dir_all(&dest);
if appsrc.exists() { copy_dir(appsrc.into_os_string().into_string().unwrap(), dest.into_os_string().into_string().unwrap()); }
else {
  let htmlpath = dest.join("html").join(appid);
  create_dir_all(&htmlpath);
  let templatepath = store.root.parent().unwrap()
  						.join("runtime")
  						.join("dev")
  						.join("src")
  						.join("html")
  						.join("dev");
  let destfile = htmlpath.join("index.html");
  if !destfile.exists() {
    let srcfile = templatepath.join("template.html");
    let html = read_all_string(srcfile.into_os_string().into_string().unwrap());
    let html = html.replace("\r", "\n");
    let html = html.replace("[TITLE]", &appname);
    let html = html.replace("[LIB]", &applib);
    let html = html.replace("[CTL]", &ctlid);
    fs::write(destfile, &html).expect("Unable to write file");
    let destfile = htmlpath.join("index.css");
    if !destfile.exists() {
      let srcfile = templatepath.join("template.css");
      let html = read_all_string(srcfile.into_os_string().into_string().unwrap());
      fs::write(destfile, &html).expect("Unable to write file");
    }
    let destfile = htmlpath.join("index.js");
    if !destfile.exists() {
      let srcfile = templatepath.join("template.js");
      let html = read_all_string(srcfile.into_os_string().into_string().unwrap());
      fs::write(destfile, &html).expect("Unable to write file");
    }
  }
}

/* 2. build runtime/dev/libraries */
//let tmp = unique_session_id();
//let tmp = std::env::temp_dir().as_path().join(tmp.to_owned());
let libs = data.get_string("libraries");
let libs = libs.split(",");
for lib in libs {
//  let build = tmp.to_owned().join(lib);
//  create_dir_all(&build);
  let datapath = store.root.join(lib);
  let propfile = datapath.join("meta.json");
  let mut meta = DataObject::from_string(&read_all_string(propfile.to_owned().into_os_string().into_string().unwrap()));
  let libversion;
  if meta.has("version") { libversion = meta.get_i64("version"); }
  else { libversion = 0; }
  let libversion = libversion + 1;
  meta.put_i64("version", libversion);
  fs::write(propfile, &meta.to_string()).expect("Unable to write file");
//  let dest = build.into_os_string().into_string().unwrap();
//  copy_dir(datapath.into_os_string().into_string().unwrap(), dest.to_owned());
  let zipfile = devroot.join(&(lib.to_owned()+"_"+&(libversion-1).to_string()+".zip"));
  remove_file(zipfile);
  let zipfile = devroot.join(&(lib.to_owned()+"_"+&libversion.to_string()+".zip"));
  zip(datapath.into_os_string().into_string().unwrap(), zipfile.into_os_string().into_string().unwrap());
}
//remove_dir_all(tmp);







/*






*/
DataObject::new()