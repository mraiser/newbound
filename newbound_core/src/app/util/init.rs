use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
//use rand::rngs::OsRng;
//use x25519_dalek::{StaticSecret, PublicKey};
use flowlang::flowlang::file::write_properties::write_properties;
//use uuid::Uuid;
use flowlang::x25519::*;
use flowlang::rand::uuid;

pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        init()
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
            result_obj
        }
        Err(err) => {
            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");

            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic occurred".to_string()
            };

            err_obj.put_string("msg", &msg);
            // Wrapped in the same `a` envelope a successful return uses.
            // Unwrapped, callers that unpack the envelope (newbound's
            // format_result, for one) report an opaque 500 — "Not an object:
            // DString(\"err\")" — instead of this message.
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", err_obj);
            result_obj
        }
    }
}

pub fn init() -> String {
let system = DataStore::globals().get_object("system");
let mut o = system.get_object("apps").get_object("app").get_object("runtime");
let mut b = false;
if !o.has("uuid"){
  o.put_string("uuid", &uuid().unwrap());
  b = true;
}
if !o.has("privatekey"){
  //let secret = StaticSecret::new(OsRng);
  //let public = PublicKey::from(&secret);
  //o.put_string("privatekey", &to_hex(&secret.to_bytes()));
  //o.put_string("publickey", &to_hex(&public.to_bytes()));
  
  
  let (secret, public) = generate_x25519_keypair();  
  o.put_string("privatekey", &to_hex(&secret));
  o.put_string("publickey", &to_hex(&public));
  
  
  b = true;
}

if b {
  let root = DataStore::new().root.parent().unwrap().join("runtime").join("app").join("botd.properties");
  write_properties(root.into_os_string().into_string().unwrap(), o.clone());
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
