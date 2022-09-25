use ndata::dataobject::*;
use flowlang::datastore::DataStore;
use rand::rngs::OsRng;
use x25519_dalek::{StaticSecret, PublicKey};
use flowlang::generated::flowlang::file::write_properties::write_properties;
use uuid::Uuid;

pub fn execute(_o: DataObject) -> DataObject {
let ax = init();
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn init() -> String {
let system = DataStore::globals().get_object("system");
let mut o = system.get_object("apps").get_object("app").get_object("runtime");
let mut b = false;
if !o.has("uuid"){
  o.put_str("uuid", &Uuid::new_v4().to_string());
  b = true;
}
if !o.has("privatekey"){
  let secret = StaticSecret::new(OsRng);
  let public = PublicKey::from(&secret);
  o.put_str("privatekey", &to_hex(&secret.to_bytes()));
  o.put_str("publickey", &to_hex(&public.to_bytes()));
  b = true;
}

if b {
  let root = DataStore::new().root.parent().unwrap().join("runtime").join("app").join("botd.properties");
  write_properties(root.into_os_string().into_string().unwrap(), o.duplicate());
}

"OK".to_string()
}

fn to_hex(ba:&[u8]) -> String {
  let mut s = "".to_string();
  for b in ba {
    s += &format!("{:02X?}", b);
  }
  s
}

