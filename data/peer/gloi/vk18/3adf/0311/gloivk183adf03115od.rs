let system = DataStore::globals().get_object("system");

// Temp key pair for initial exchange
let my_session_public: [u8; 32] = system.get_bytes("session_pubkey").get_data().try_into().unwrap();
let my_session_public = PublicKey::from(my_session_public);

let mut buf = Vec::new();
buf.push(0);
buf.extend_from_slice(my_session_public.as_bytes());
let socket_address = ipaddr+":"+&port.to_string();
let _x = UDPCON.get().write().unwrap().send_to(&buf, socket_address).unwrap();
DataObject::new()