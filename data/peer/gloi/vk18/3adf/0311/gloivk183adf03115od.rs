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
let my_session_public: [u8; 32] = system.get_bytes("session_pubkey").get_data().try_into().unwrap();
let my_session_public = PublicKey::from(my_session_public);

let mut buf = Vec::new();
buf.push(0);
buf.extend_from_slice(my_session_public.as_bytes());
let socket_address = ipaddr+":"+&port.to_string();
UDPCON.get().write().unwrap().send_to(&buf, socket_address);
DataObject::new()