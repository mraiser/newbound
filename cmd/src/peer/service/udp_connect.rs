use ndata::dataobject::*;
use std::net::UdpSocket;
use flowlang::datastore::DataStore;
use crate::peer::service::listen::decode_hex;
use x25519_dalek::StaticSecret;
use rand::rngs::OsRng;
use x25519_dalek::PublicKey;
use crate::peer::service::listen_udp::UDPCON;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_string("ipaddr");
let a2 = o.get_i64("port");
let ax = udp_connect(a0, a1, a2);
let mut o = DataObject::new();
o.put_object("a", ax);
o
}

pub fn udp_connect(uuid:String, ipaddr:String, port:i64) -> DataObject {
let system = DataStore::globals().get_object("system");
let runtime = system.get_object("apps").get_object("app").get_object("runtime");
let my_uuid = runtime.get_string("uuid");

// FIXME - move cipher generation to its own function
let my_public = runtime.get_string("publickey");
let my_private = runtime.get_string("privatekey");
let my_private = decode_hex(&my_private).unwrap();
let my_private: [u8; 32] = my_private.try_into().expect("slice with incorrect length");
let my_private = StaticSecret::from(my_private);

// Temp key pair for initial exchange
let my_session_private = StaticSecret::new(OsRng);
let my_session_public = PublicKey::from(&my_session_private);

let mut buf = Vec::new();
buf.push(0);
buf.extend_from_slice(my_session_public.as_bytes());





let socket_address = ipaddr+":"+&port.to_string();
UDPCON.get().write().unwrap().send_to(&buf, socket_address);
DataObject::new()
}

