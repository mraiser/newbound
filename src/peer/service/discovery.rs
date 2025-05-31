use ndata::dataobject::DataObject;
use ndata::data::Data;
use ndata::sharedmutex::SharedMutex;
use std::net::UdpSocket;
use std::sync::Once;
use flowlang::datastore::DataStore;
use std::thread;
use core::time::Duration;

// Assuming these are from your project structure
use crate::peer::service::udp_connect::udp_connect;
use crate::peer::service::listen::get_udp;
use crate::peer::service::listen::get_tcp;
use flowlang::flowlang::system::time::time;
use crate::security::security::init::get_user;

static mut DISCOVERY_SOCKET_MUTEX: Option<SharedMutex<UdpSocket>> = None;
static INIT_DISCOVERY_MUTEX: Once = Once::new();
pub fn execute(_: DataObject) -> DataObject {
  let ax = discovery();
  let mut result_obj = DataObject::new();
  result_obj.put_string("a", &ax);
  result_obj
}

pub fn discovery() -> String {
INIT_DISCOVERY_MUTEX.call_once(|| {
  let socket_address = "0.0.0.0:5770".to_string();
  let sock_res = UdpSocket::bind(&socket_address);

  if let Ok(sock) = sock_res { // sock: UdpSocket
    sock.set_broadcast(true).expect("DISCOVERY: Failed to set broadcast on socket");

    unsafe {
      DISCOVERY_SOCKET_MUTEX = Some(SharedMutex::new());
    }

    let mutex_in_static_location = unsafe {
      #[allow(static_mut_refs)]
      DISCOVERY_SOCKET_MUTEX.as_mut().expect("Mutex should be Some after first init step")
    };

    mutex_in_static_location.set(sock);

    println!("DISCOVERY UDP listening on port 5770");

    thread::spawn(move || {
      do_listen();
    });

    thread::spawn(move || {
      do_send();
    });

  } else {
    println!("DISCOVERY COULD NOT START. Error binding to {}: {:?}", socket_address, sock_res.err());
  }
});
"OK".to_string()
}

fn do_send() {
  let system = DataStore::globals().get_object("system");

  // Safely get nested DataObjects
  let runtime: DataObject;
  let meta: DataObject;
  let config: DataObject;

  if system.has("apps") {
    let apps = system.get_object("apps");
    if apps.has("app") && apps.get_object("app").has("runtime") {
      runtime = apps.get_object("app").get_object("runtime");
    } else {
      println!("DISCOVERY (send): Path system/apps/app/runtime not found. Send thread cannot proceed.");
      return;
    }
    if apps.has("peer") && apps.get_object("peer").has("runtime") {
      meta = apps.get_object("peer").get_object("runtime");
    } else {
      println!("DISCOVERY (send): Path system/apps/peer/runtime not found. Send thread cannot proceed.");
      return;
    }
  } else {
    println!("DISCOVERY (send): Path system/apps not found. Send thread cannot proceed.");
    return;
  }

  if system.has("config") {
    config = system.get_object("config");
  } else {
    println!("DISCOVERY (send): Path system/config not found. Send thread cannot proceed.");
    return;
  }

  let my_uuid = runtime.get_string("uuid");
  let my_name = config.get_string("machineid");
  let p2pport = Data::as_string(meta.get_property("port"))
  .parse::<u16>()
  .expect("DISCOVERY (send): Failed to parse p2pport");
  let httpport = Data::as_string(config.get_property("http_port"))
  .parse::<u16>()
  .expect("DISCOVERY (send): Failed to parse httpport");

  let mut buf_template = my_uuid.as_bytes().to_vec();
  buf_template.extend_from_slice(&p2pport.to_be_bytes());
  buf_template.extend_from_slice(&httpport.to_be_bytes());
  buf_template.extend_from_slice(my_name.as_bytes());

  let broad = "255.255.255.255:5770";
  let beat = Duration::from_millis(10000);

  #[allow(static_mut_refs)]
  let discovery_mutex_ref = unsafe { DISCOVERY_SOCKET_MUTEX.as_ref() };

  if let Some(mutex) = discovery_mutex_ref {
    if mutex.is_initialized() {
      while system.get_boolean("running") {
        let socket_clone = {
          let guard = mutex.lock();
          (*guard).try_clone().expect("DISCOVERY (send): Failed to clone socket")
        };

        match socket_clone.send_to(&buf_template, broad) {
          Ok(_) => { /* Successfully sent */ }
          Err(e) => println!("DISCOVERY (send) ERROR: {:?}. UUID: {}, Name: {}, P2P: {}, HTTP: {}", e, my_uuid, my_name, p2pport, httpport),
        }

        thread::sleep(beat);
      }
      println!("DISCOVERY (send): Loop terminated as system.running is false.");
    } else {
      println!("DISCOVERY (send): SharedMutex is present but not fully initialized (set may not have completed). Send thread will not run.");
    }
  } else {
    println!("DISCOVERY (send): Socket Mutex not available. Send thread will not run.");
  }
}

fn do_listen() {
  // Check if DataStore::globals() itself provides a valid "system" DataObject
  // Assuming DataStore::globals() always returns a valid DataObject that might represent the root or global store.
  // If DataStore::globals().get_object("system") could fail (e.g. "system" is not mandatory at the root),
  // that would need a different check. For now, assuming it's like the original code's direct get.
  let mut system = DataStore::globals().get_object("system");


  if !system.has("discovery") {
    system.put_object("discovery", DataObject::new());
  }
  let mut discovery_data_obj = system.get_object("discovery");

  let my_uuid: String;
  if system.has("apps") {
    let apps = system.get_object("apps");
    if apps.has("app") && apps.get_object("app").has("runtime") {
      let runtime = apps.get_object("app").get_object("runtime");
      my_uuid = runtime.get_string("uuid");
    } else {
      println!("DISCOVERY (listen): Path system/apps/app/runtime not found for UUID. Listen thread may not filter own messages correctly.");
      my_uuid = String::new(); // Proceed with an empty UUID, won't filter effectively
    }
  } else {
    println!("DISCOVERY (listen): Path system/apps not found for UUID. Listen thread may not filter own messages correctly.");
    my_uuid = String::new(); // Proceed with an empty UUID
  }

  let mut recv_buf = [0; 508];

  #[allow(static_mut_refs)]
  let discovery_mutex_ref = unsafe { DISCOVERY_SOCKET_MUTEX.as_ref() };

  if let Some(mutex) = discovery_mutex_ref {
    if mutex.is_initialized() {
      while system.get_boolean("running") {
        let socket_clone = {
          let guard = mutex.lock();
          (*guard).try_clone().expect("DISCOVERY (listen): Failed to clone socket")
        };

        match socket_clone.recv_from(&mut recv_buf) {
          Ok((amt, src)) => {
            let data_slice = &recv_buf[..amt];

            if data_slice.len() < 40 {
              // println!("DISCOVERY (listen): Received packet too short ({} bytes) from {}", data_slice.len(), src);
              continue;
            }

            let received_uuid = match String::from_utf8(data_slice[0..36].to_vec()) {
              Ok(s) => s,
              Err(_e) => {
                // println!("DISCOVERY (listen): Failed to parse UUID from packet from {}: {:?}", src, e);
                continue;
              }
            };

            if !my_uuid.is_empty() && received_uuid == my_uuid {
              continue; 
            }

            let p2p_port_bytes: [u8; 2] = match data_slice[36..38].try_into() {
              Ok(b) => b, Err(_) => { /* println!("DISCOVERY (listen): Failed to slice p2p_port_bytes from {}", src); */ continue; }
            };
            let p2pport = u16::from_be_bytes(p2p_port_bytes) as usize;

            let http_port_bytes: [u8; 2] = match data_slice[38..40].try_into() {
              Ok(b) => b, Err(_) => { /* println!("DISCOVERY (listen): Failed to slice http_port_bytes from {}", src); */ continue; }
            };
            let httpport = u16::from_be_bytes(http_port_bytes) as usize;

            let displayname = String::from_utf8(data_slice[40..].to_vec()).unwrap_or_else(|_| "invalid_name".to_string());
            let ipaddress = src.ip().to_string();

            let mut o = DataObject::new();
            o.put_int("p2pport", p2pport as i64);
            o.put_int("httpport", httpport as i64);
            o.put_string("address", &ipaddress);
            o.put_string("uuid", &received_uuid);
            o.put_string("name", &displayname);
            o.put_int("time", time());

            let src_key = ipaddress.clone() + ":" + &p2pport.to_string();
            discovery_data_obj.put_object(&src_key, o.clone());

            let user_opt = get_user(&received_uuid);
            if let Some(user) = user_opt {
              if user.has("keepalive") && Data::as_string(user.get_property("keepalive")) == "true" {
                if get_udp(user.clone()).is_none() && get_tcp(user.clone()).is_none() {
                  let _ = udp_connect(ipaddress, p2pport as i64);
                }
              }
            }
          }
          Err(_e) => {
            if system.get_boolean("running") {
              // println!("DISCOVERY (listen) RECV ERROR: {:?}", e); 
            } else {
              break; 
            }
            thread::sleep(Duration::from_millis(100));
          }
        }
      }
      println!("DISCOVERY (listen): Loop terminated.");
    } else {
      println!("DISCOVERY (listen): SharedMutex is present but not fully initialized. Listen thread will not run.");
    }
  } else {
    println!("DISCOVERY (listen): Socket Mutex not available. Listen thread will not run.");
  }
}
