use ndata::dataobject::*;
use std::net::UdpSocket;
use std::sync::Once;
use std::sync::RwLock;
use state::Storage;
use flowlang::datastore::DataStore;
use std::thread;
use core::time::Duration;
use ndata::data::Data;
use crate::peer::service::udp_connect::udp_connect;
use crate::peer::service::listen::get_udp;
use crate::peer::service::listen::get_tcp;
use flowlang::flowlang::system::time::time;
use crate::security::security::init::get_user;

pub fn execute(_o: DataObject) -> DataObject {
let ax = discovery();
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn discovery() -> String {
  let socket_address = "0.0.0.0:5770".to_string();
  START.call_once(|| { 
    let sock = UdpSocket::bind(socket_address).unwrap();
    sock.set_broadcast(true).unwrap();
    unsafe { DISCOVERYCON.set(RwLock::new(sock)); }
    println!("DISCOVERY UDP listening on port 5770");
  });

  thread::spawn(move || {
    do_listen();
  });
  
  thread::spawn(move || {
    do_send();
  });
  
  "OK".to_string()
}

static START: Once = Once::new();
static mut DISCOVERYCON:Storage<RwLock<UdpSocket>> = Storage::new();

fn do_send() {
  let system = DataStore::globals().get_object("system");
  let runtime = system.get_object("apps").get_object("app").get_object("runtime");
  let meta = system.get_object("apps").get_object("peer").get_object("runtime");
  let config = system.get_object("config");
  
  let my_uuid = runtime.get_string("uuid");
  let my_name = config.get_string("machineid");
  let p2pport = Data::as_string(meta.get_property("port")).parse::<u16>().unwrap();
  let httpport = Data::as_string(config.get_property("http_port")).parse::<u16>().unwrap();
  let mut buf = my_uuid.as_bytes().to_vec();
  buf.extend_from_slice(&p2pport.to_be_bytes());
  buf.extend_from_slice(&httpport.to_be_bytes());
  buf.extend_from_slice(&my_name.as_bytes());
  
  let broad = "255.255.255.255:5770";
  let beat = Duration::from_millis(10000);
  while system.get_bool("running") {
    let sock;
    unsafe { sock = DISCOVERYCON.get().write().unwrap().try_clone().unwrap(); }
    sock.send_to(&buf, &broad).unwrap();
    
    thread::sleep(beat);
  }
}

fn do_listen() {
  let mut system = DataStore::globals().get_object("system");
  if !system.has("discovery") { system.put_object("discovery", DataObject::new()); }
  let mut discovery = system.get_object("discovery");
  let runtime = system.get_object("apps").get_object("app").get_object("runtime");
  let my_uuid = runtime.get_string("uuid");
  let mut buf = [0; 508]; 
  while system.get_bool("running") {
    let sock;
    unsafe { sock = DISCOVERYCON.get().write().unwrap().try_clone().unwrap(); }
    let (amt, src) = sock.recv_from(&mut buf).unwrap();
    let buf = &mut buf[..amt];
    let s = String::from_utf8(buf[0..36].to_vec()).unwrap();
    if s != my_uuid { 
      let bytes: [u8; 2] = buf[36..38].try_into().unwrap();
      let p2pport = u16::from_be_bytes(bytes) as usize;
      let bytes: [u8; 2] = buf[38..40].try_into().unwrap();
      let httpport = u16::from_be_bytes(bytes) as usize;
      let displayname = String::from_utf8(buf[40..].to_vec()).unwrap();
      let ipaddress = src.ip().to_string();
        
      let mut o = DataObject::new();
      o.put_i64("p2pport", p2pport as i64);
      o.put_i64("httpport", httpport as i64);
      o.put_str("address", &ipaddress);
      o.put_str("uuid", &s);
      o.put_str("name", &displayname);
      o.put_i64("time", time());
      
      let src = ipaddress.to_owned()+":"+&p2pport.to_string();
      discovery.put_object(&src, o);

      let user = get_user(&s);
      if user.is_some() {
        let user = user.unwrap();
        if user.has("keepalive") && Data::as_string(user.get_property("keepalive")) == "true" {
          if get_udp(user.duplicate()).is_none() && get_tcp(user.duplicate()).is_none() {
            let _x = udp_connect(ipaddress, p2pport as i64);
          }        
        }
      }
    }
  }
}

