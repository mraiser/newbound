use ndata::dataobject::*;
use crate::security::security::users::users;
use ndata::data::Data;
use crate::peer::service::tcp_connect::tcp_connect;
use std::thread;
use crate::peer::service::exec::exec;
use flowlang::generated::flowlang::system::time::time;
use ndata::dataarray::DataArray;
use flowlang::appserver::fire_event;
use crate::peer::peer::peers::user_to_peer;
use flowlang::datastore::DataStore;
use crate::peer::service::listen::relay;
use crate::peer::service::listen::get_tcp;
use crate::peer::service::listen::P2PHEAP;
use std::net::Shutdown;
use blake2::{Blake2b, Digest, digest::consts::U10};
use flowlang::generated::flowlang::system::unique_session_id::unique_session_id;
use crate::peer::service::listen::to_hex;

type Blake2b80 = Blake2b<U10>;
pub fn execute(_o: DataObject) -> DataObject {
let ax = maintenance();
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn maintenance() -> String {
println!("begin maintenance");


let pollx2 = 60000;

// Kill any connection with no response over 2x poll period
let mut live = Vec::new();
{
  let now = time();
  let mut heap = P2PHEAP.get().write().unwrap();
  let pcons = heap.keys();
  for id in pcons {
    let con = heap.get(id);
    if con.last_contact() < now - pollx2 {
      con.shutdown(&con.uuid, id as i64);
    }
    else { live.push(con.duplicate()); }
  }
}

println!("more maintenance");

// Ping every live connection and update user data
// If no live connection, attempt UDP (or TCP?) 
// Upgrade relay to UDP
// Upgrade UDP to TCP

let users = users();
let mut ask = DataArray::new();
let salt = unique_session_id();

for (uuid, user) in users.objects(){
  if uuid.len() == 36 {
    let user = user.object();
    
    let mut hasher = Blake2b80::new();
    hasher.update(salt.as_bytes());
    hasher.update(uuid.as_bytes());
    let res = hasher.finalize();
    let hash = to_hex(&res);
    ask.push_str(&hash);
    
    //println!("MAINT hash {} {}", uuid, hash);
    
    if get_tcp(user.duplicate()).is_none() {
      if user.has("keepalive") && Data::as_string(user.get_property("keepalive")) == "true" {
        if user.has("address") && user.has("port") {
          let ipaddr = user.get_string("address");
          let port = Data::as_string(user.get_property("port")).parse::<i64>().unwrap();
          thread::spawn(move || {
            tcp_connect(uuid, ipaddr, port);
          });
        }
      }
    }
  }
}




println!("last maintenance");

//println!("PASS 2");
let adr = ask.data_ref;
for (uuid, user) in users.objects(){
  if uuid.len() == 36 {
    let mut user = user.object();
    //println!("USER A {}", user.to_string());
    if user.get_array("connections").len() > 0 {
      user.put_bool("connected", true);
      let salt = salt.to_owned();
      thread::spawn(move || {
        let system = DataStore::globals().get_object("system");
        
        let ask = DataArray::get(adr);
        let t1 = time();
        let mut d = DataObject::new();
        d.put_array("uuid", ask);
        d.put_str("salt", &salt);
        let o = exec(user.get_string("id"), "peer".to_string(), "info".to_string(), d);
        //println!("INFO {}", o.to_string());
        if o.get_string("status") == "ok" {
          let o = o.get_object("data");
          let t2 = time();
          let l = t2 - t1;
          user.put_i64("latency", l);
          if !user.has("addresses") { user.put_array("addresses", DataArray::new()); }
          let addrs = user.get_array("addresses");
          let v = o.get_array("addresses");
          for a in v.objects(){
            addrs.push_unique(a);
          }
          user.put_str("displayname", &o.get_string("name"));
          user.put_str("session_id", &o.get_string("session_id"));
          user.put_i64("http_port", o.get_i64("http_port"));
          user.put_i64("p2p_port", o.get_i64("p2p_port"));
          
          let cons = o.get_object("connections");
          //println!("CONS {}", cons.to_string());
          user.put_object("peers", cons.duplicate());
          
          if get_tcp(user.duplicate()).is_some() {
            let users = system.get_object("users");
            for (uuid2,_u) in users.objects() {
              if uuid2.len() == 36 && uuid != uuid2 {
                let b = cons.has(&uuid2) && cons.get_string(&uuid2).starts_with("tcp#");
                //println!("SUSPECT 3 {} -> {}", uuid,uuid2);
                // FIXME - remove if?
                if b { relay(&uuid, &uuid2, b); }
              }
            }
            //println!("USER B {}", user.to_string());
          }        
          // Fixme - notify if something changes (latency?)
          fire_event("peer", "UPDATE", user_to_peer(user, uuid));
        }
      });
    }
    else {
      user.put_bool("connected", false);
      /*
      let users = system.get_object("users");
      for (uuid2,_u) in users.objects() {
        if uuid2.len() == 36 && uuid != uuid2 {
          relay(&uuid, &uuid2, false);
        }
      }
      */
      // FIXME - notify on relay add
      fire_event("peer", "UPDATE", user_to_peer(user, uuid));
    }
  }
}

println!("end maintenance");

"OK".to_string()
}

