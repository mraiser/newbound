use ndata::dataobject::*;
use std::fs;
use std::fs::*;
use ndata::data::Data;
use ndata::dataarray::DataArray;
use flowlang::datastore::*;
use flowlang::generated::flowlang::file::read_properties::read_properties;
use flowlang::generated::flowlang::file::write_properties::write_properties;
use flowlang::generated::flowlang::file::copy_dir::copy_dir;
use flowlang::generated::flowlang::file::read_all_string::read_all_string;
use crate::app::util::zip::zip;
use crate::app::util::hash::hash;
use flowlang::appserver::*;
use core::num::ParseIntError;
use rand::rngs::OsRng;
use x25519_dalek::{StaticSecret, PublicKey};
use aes::Aes256;
use aes::cipher::{
    BlockEncrypt, KeyInit,
    generic_array::GenericArray,
};



pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_object("data");
let ax = publishapp(a0);
let mut o = DataObject::new();
o.put_array("a", ax);
o
}

pub fn publishapp(data:DataObject) -> DataArray {
/*

1. build _APPS/[APPNAME]
2. build runtime/dev/libraries
3. install app

*/
let mut out = DataArray::new();

let store = DataStore::new();

let system = DataStore::globals().get_object("system");
let o = system.get_object("apps").get_object("app").get_object("runtime");
let bytes: [u8; 32] = decode_hex(&o.get_string("privatekey")).unwrap().try_into().unwrap();
let private = StaticSecret::from(bytes);
let public = o.get_string("publickey");
let uuid = o.get_string("uuid");
let metaidentity = store.get_data("runtime", "metaidentity").get_object("data");

let mut data = data.duplicate();
let appversion = Data::as_string(data.get_property("version")).parse::<i64>().unwrap() + 1;
data.put_i64("version", appversion);

let appid = data.get_string("id");
let appname = data.get_string("name");
let applib = data.get_string("ctldb");
let ctlid = data.get_string("ctlid");

let approot = store.root.parent().unwrap().join("runtime").join(&appid);
let appsrc = approot.join("src");
let devroot = store.root.parent().unwrap().join("runtime").join("dev").join("libraries");
let _x = create_dir_all(&approot);
let _x = create_dir_all(&devroot);

/* 1. build _APPS/[APPNAME] */
let path = store.root.join(&applib).join("_APPS").join(&appid);
let _x = create_dir_all(&path);
let propfile = path.join("app.properties");
write_properties(propfile.into_os_string().into_string().unwrap(), data.duplicate());
let propfile = approot.join("app.properties");
write_properties(propfile.into_os_string().into_string().unwrap(), data.duplicate());
let propfile = approot.join("botd.properties");
if !propfile.exists() {
  write_properties(propfile.into_os_string().into_string().unwrap(), DataObject::new());
}
let dest = path.join("src");
let _x = create_dir_all(&dest);

let htmlpath = appsrc.join("html").join(&appid);
let destfile = htmlpath.join("index.html");
if !destfile.exists() {
  let _x = create_dir_all(&htmlpath);
  let templatepath = store.root.parent().unwrap()
        .join("runtime")
        .join("dev")
        .join("src")
        .join("html")
        .join("dev");
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
copy_dir(appsrc.into_os_string().into_string().unwrap(), dest.into_os_string().into_string().unwrap());

/* 2. build runtime/dev/libraries */
let libs = data.get_string("libraries");
let libs = libs.split(",");
for lib in libs {
  let datapath = store.root.join(lib);
  let dir = datapath.to_owned().into_os_string().into_string().unwrap().to_owned();
  let hashfile = devroot.join(&(lib.to_owned()+".hash"));
  let mut b = true;
  if hashfile.exists() {
    let oldhash = fs::read_to_string(&hashfile).unwrap();
    let h = hash(dir.to_owned());
    if h == oldhash { b = false; }
  }
  if b {
    out.push_str(&lib);
    let propfile = datapath.join("meta.json");
    let mut meta = DataObject::from_string(&read_all_string(propfile.to_owned().into_os_string().into_string().unwrap()));
    let libversion;
    if meta.has("version") { libversion = meta.get_i64("version"); }
    else { libversion = 0; }
    let libversion = libversion + 1;
    meta.put_i64("version", libversion);
    fs::write(propfile, &meta.to_string()).expect("Unable to write file");
    let propfile = datapath.join("version.txt");
    fs::write(propfile, &libversion.to_string()).expect("Unable to write file");
    let zipfile = devroot.join(&(lib.to_owned()+"_"+&(libversion-1).to_string()+".zip"));
    let _x = remove_file(zipfile);
    let zipfile = devroot.join(&(lib.to_owned()+"_"+&libversion.to_string()+".zip"));
    zip(dir.to_owned(), zipfile.into_os_string().into_string().unwrap());
    let h = hash(dir.to_owned());
    fs::write(hashfile, &h).expect("Unable to write file");
    
    let app_private = StaticSecret::new(OsRng);
    let app_public = PublicKey::from(&app_private);
    let shared_secret = private.diffie_hellman(&app_public);
    let key = GenericArray::from(shared_secret.to_bytes());
    let cipher = Aes256::new(&key);
    let buf = decode_hex(&h).unwrap();
    let blocks: Vec<&[u8]> = buf.chunks(16).collect();
    let mut buf = Vec::new();
    for ba in blocks {
      let block: [u8; 16] = ba.try_into().expect("slice with incorrect length");
      let mut block = GenericArray::from(block);
      cipher.encrypt_block(&mut block);
      buf.extend_from_slice(&block[0..15]);
    }
    let sig = to_hex(&buf);
    
    let mut meta = DataObject::new();
    meta.put_str("signature", &sig);
    meta.put_str("author", &uuid);
    meta.put_str("authorname", &metaidentity.get_string("displayname"));
    meta.put_str("authororg", &metaidentity.get_string("organization"));
    meta.put_str("id", &lib);
    meta.put_str("version", &libversion.to_string());
    meta.put_str("hash", &h);
    meta.put_str("key", &to_hex(&app_private.to_bytes()));
    meta.put_str("authorkey", &public);
    let metafile = devroot.join(&(lib.to_owned()+".json"));
    fs::write(metafile, &meta.to_string()).expect("Unable to write file");
  }
}

/* 3. install app */
let configfile = store.root.parent().unwrap().join("config.properties");
let mut config = read_properties(configfile.to_owned().into_os_string().into_string().unwrap());
let s = config.get_string("apps");
let vec:Vec<&str> = s.split(",").collect();
if !vec.contains(&appid.as_ref()) {
  let s = s + "," + &appid;
  config.put_str("apps", &s);
  write_properties(configfile.into_os_string().into_string().unwrap(), config);
}

init_globals();
out
}

fn to_hex(ba:&[u8]) -> String {
  let mut s = "".to_string();
  for b in ba {
    s += &format!("{:02X?}", b);
  }
  s
}

pub fn decode_hex(s: &str) -> Result<Vec<u8>, ParseIntError> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16))
        .collect()

}

