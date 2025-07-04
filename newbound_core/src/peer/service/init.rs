use ndata::dataobject::DataObject;
use std::thread;
use ndata::data::*;
use flowlang::datastore::DataStore;
use flowlang::flowlang::file::write_properties::write_properties;
use crate::peer::service::listen::listen;
use crate::peer::service::listen_udp::listen_udp;
use crate::peer::service::discovery::discovery;
use core::time::Duration;

pub fn execute(_: DataObject) -> DataObject {
    let ax = init();
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn init() -> DataObject {
let beat = Duration::from_millis(10);
let system = DataStore::globals().get_object("system");
while !system.has("security_ready") { thread::sleep(beat); }

let mut meta = DataStore::globals().get_object("system").get_object("apps").get_object("peer").get_object("runtime");
let mut b = false;
let ipaddr;
if meta.has("ip_address") { ipaddr = meta.get_string("ip_address"); }
else { ipaddr = "0.0.0.0".to_string(); meta.put_string("ip_address", &ipaddr); b=true; }
let port;
if meta.has("port") { port = Data::as_string(meta.get_property("port")).parse::<i64>().unwrap(); }
else { 
  let config = system.get_object("config");
  if config.has("p2p_port") { port = Data::as_string(config.get_property("p2p_port")).parse::<i64>().unwrap(); }  
  else { port = 0; } 
  meta.put_int("port", port); 
  b=true; 
}
if b {
  let file = DataStore::new().root
                .parent().unwrap()
                .join("runtime")
                .join("peer")
                .join("botd.properties");
  let _x = write_properties(file.into_os_string().into_string().unwrap(), meta.clone());
}

// FIXME - move threads to listen methods and pass returned port from tcp to udp
let x = ipaddr.to_owned();
let port = listen(x, port);

thread::spawn(move || {
  thread::sleep(Duration::from_millis(3000));
  listen_udp(ipaddr, port);
});

discovery();
  
meta
}
