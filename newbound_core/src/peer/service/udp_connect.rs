use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use crate::peer::service::listen_udp::UDPCON;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("ipaddr");
    let arg_1: i64 = o.get_int("port");
    let ax = udp_connect(arg_0, arg_1);
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn udp_connect(ipaddr: String, port: i64) -> DataObject {
let system = DataStore::globals().get_object("system");
if system.has("session_pubkey"){
  // Temp key pair for initial exchange
  let my_session_public: [u8; 32] = system.get_bytes("session_pubkey").get_data().try_into().unwrap();
  //let my_session_public = PublicKey::from(my_session_public);
  //let my_session_public = my_session_public.as_bytes();

  let mut buf = Vec::new();
  buf.push(0);
  buf.extend_from_slice(&my_session_public);
  let socket_address = ipaddr+":"+&port.to_string();
  //let _x = UDPCON.get().write().unwrap().send_to(&buf, socket_address).unwrap();
  let _x = UDPCON.lock().send_to(&buf, socket_address).unwrap();
}
DataObject::new()
}
