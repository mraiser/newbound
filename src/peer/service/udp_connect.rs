use ndata::dataobject::*;
use flowlang::datastore::DataStore;
//use x25519_dalek::PublicKey;
use crate::peer::service::listen_udp::UDPCON;
use flowlang::rand::fill_bytes;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("ipaddr");
let a1 = o.get_int("port");
let ax = udp_connect(a0, a1);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn udp_connect(ipaddr:String, port:i64) -> DataObject {
let system = DataStore::globals().get_object("system");

// Temp key pair for initial exchange
let my_session_public: [u8; 32] = system.get_bytes("session_pubkey").get_data().try_into().unwrap();
//let my_session_public = PublicKey::from(my_session_public);
//let my_session_public = my_session_public.as_bytes();

let mut buf = Vec::new();
buf.push(0);
buf.extend_from_slice(&my_session_public);
let socket_address = ipaddr+":"+&port.to_string();
let _x = UDPCON.get().write().unwrap().send_to(&buf, socket_address).unwrap();
DataObject::new()
}

