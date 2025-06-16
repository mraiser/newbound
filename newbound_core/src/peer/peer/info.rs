use ndata::dataobject::DataObject;
//use local_ip_address::list_afinet_netifas;
use ndata::dataarray::DataArray;
use flowlang::datastore::DataStore;
use ndata::data::Data;
use crate::peer::peer::peers::user_to_peer;
use crate::security::security::users::users;
use blake2::{Blake2b, Digest, digest::consts::U10};
use crate::peer::service::listen::to_hex;
use std::collections::HashMap;
use flowlang::flowlang::system::time::time;
type Blake2b80 = Blake2b<U10>;
use flowlang::flowlang::system::system_call::system_call;

pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("nn_sessionid");
    let arg_1: Data = o.get_property("uuid");
    let arg_2: Data = o.get_property("salt");
    let ax = info(arg_0, arg_1, arg_2);
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn info(nn_sessionid: String, uuid: Data, salt: Data) -> DataObject {
/*
let mut g = DataStore::globals();

let mut o = DataObject::new();

let a = match g.has("network_interfaces") && time() - g.get_object("network_interfaces").get_int("timestamp") < 30000 {
  true => g.get_object("network_interfaces").get_array("list"),
  false => {
    let mut a = DataArray::new();

    let network_interfaces = list_afinet_netifas().unwrap();
    for (_name, ip) in network_interfaces.iter() {
      let s = ip.to_string();
      if s != "127.0.0.1" && s != "::1" {
        a.push_string(&s);
      }
    }
    let mut wrap = DataObject::new();
    wrap.put_array("list", a.clone());
    wrap.put_int("timestamp", time());
    g.put_object("network_interfaces", wrap);
    a
  }
};

//println!("ADDRESSES {}", a.to_string());

o.put_array("addresses", a.clone());

{
  let system = g.get_object("system");
  let name = system.get_object("config").get_string("machineid");
  let http_port = Data::as_string(system.get_object("config").get_property("http_port")).parse::<i64>().unwrap();
  let port = Data::as_string(system.get_object("apps").get_object("peer").get_object("runtime").get_property("port")).parse::<i64>().unwrap();
  let id = system.get_object("apps").get_object("app").get_object("runtime").get_string("uuid");
  o.put_string("name", &name);
  o.put_string("uuid", &id);
  o.put_string("session_id", &nn_sessionid);
  o.put_int("p2p_port", port);
  o.put_int("http_port", http_port);
}
let mut cons = DataObject::new();
o.put_object("connections", cons.clone());

if uuid.is_array() || (uuid.is_string() && uuid.string().starts_with("[")) {
  let salt = salt.string();
  let users = users();
  let mut map = HashMap::new();
  for (uuid, user) in users.objects() {
    if uuid.len() == 36 {
      let mut hasher = Blake2b80::new();
      hasher.update(salt.to_owned().as_bytes());
      hasher.update(uuid.as_bytes());
      let res = hasher.finalize();
      let hash = to_hex(&res);
      //println!("INFO hash {} {}", uuid, hash);
      map.insert(hash, user.object());
    }
  }
  
  for uhash in DataArray::from_string(&Data::as_string(uuid)).objects() {
    let uhash = uhash.string();
    let u = map.get(&uhash);
    if u.is_some(){
      let u = u.unwrap();
      let uuid = u.get_string("id");
      let mut p = user_to_peer(u.clone(), uuid.to_owned());
      if p.has("p2pport") && !p.has("p2p_port") { p.set_property("p2p_port", p.get_property("p2pport")); }
      if p.has("p2p_port") && p.has("address") && p.get_boolean("tcp") { cons.put_string(&uuid, &("tcp#".to_string()+&p.get_string("address")+"#"+&Data::as_string(p.get_property("p2p_port")))); }
      else if p.has("p2p_port") && p.has("address") && p.get_boolean("udp") { cons.put_string(&uuid, &("udp#".to_string()+&p.get_string("address")+"#"+&Data::as_string(p.get_property("p2p_port")))); }
      else if p.get_boolean("relay") { cons.put_string(&uuid, "relay#"); }
    }
  }
}

o
*/

    let mut g = DataStore::globals();
    let mut o = DataObject::new();

    let a = match g.has("network_interfaces") && time() - g.get_object("network_interfaces").get_int("timestamp") < 30000 {
        true => g.get_object("network_interfaces").get_array("list"),
        false => {
            let mut a = DataArray::new();

            // --- Replacement for local_ip_address::list_afinet_netifas() ---
            // This command is Linux-specific. For cross-platform support,
            // OS-specific commands would be needed (e.g., using #[cfg(target_os)]).
            let command_string = r#"
ip -o -4 addr list | awk '{print $4}' | cut -d/ -f1 | grep -v -E '^127\.0\.0\.1$'; \
ip -o -6 addr list | awk '{print $4}' | cut -d/ -f1 | grep -v -E '^::1$'
"#.to_string();

            let mut cmd_array = DataArray::new();
            cmd_array.push_string("bash");
            cmd_array.push_string("-c");
            cmd_array.push_string(&command_string);

            // println!("NET CMD {}", cmd_array.to_string()); // For debugging

            let result_data_object = system_call(cmd_array); // Assumed to be available and returns DataObject

            // println!("NET RESULT {}", result_data_object.to_string()); // For debugging

            // Original code used .unwrap(), so we panic on failure to maintain consistency.
            let status = result_data_object.get_string("status");

            if status == "ok" {
                // .expect() used assuming 'out' field will exist if status is "ok".
                let stdout = result_data_object.get_string("out");
                for line in stdout.lines() {
                    let ip_str = line.trim();
                    if !ip_str.is_empty() {
                        a.push_string(ip_str);
                    }
                }
            } else { // Assuming any status other than "ok" is an error (e.g., "err")
                let stderr = result_data_object.get_string("err");
                panic!(
                    "Failed to get network interfaces via system_call. Status: '{}'. Stderr: {}",
                    status,
                    stderr
                );
            }
            // --- End of replacement ---

            let mut wrap = DataObject::new();
            wrap.put_array("list", a.clone());
            wrap.put_int("timestamp", time());
            g.put_object("network_interfaces", wrap);
            a
        }
    };

    o.put_array("addresses", a.clone());

    {
      let system = g.get_object("system");
      let name = system.get_object("config").get_string("machineid");
      let http_port = Data::as_string(system.get_object("config").get_property("http_port")).parse::<i64>().unwrap();
      let port = Data::as_string(system.get_object("apps").get_object("peer").get_object("runtime").get_property("port")).parse::<i64>().unwrap();
      let id = system.get_object("apps").get_object("app").get_object("runtime").get_string("uuid");
      o.put_string("name", &name);
      o.put_string("uuid", &id);
      o.put_string("session_id", &nn_sessionid);
      o.put_int("p2p_port", port);
      o.put_int("http_port", http_port);
    }
    let mut cons = DataObject::new();
    o.put_object("connections", cons.clone());

    if uuid.is_array() || (uuid.is_string() && uuid.string().starts_with("[")) {
      let salt = salt.string();
      let users = users();
      let mut map = HashMap::new();
      for (user_id_key, user_obj) in users.objects() {
        if user_id_key.len() == 36 {
          let mut hasher = Blake2b80::new();
          hasher.update(salt.to_owned().as_bytes());
          hasher.update(user_id_key.as_bytes());
          let res = hasher.finalize();
          let hash = to_hex(&res);
          map.insert(hash, user_obj.object());
        }
      }
      
      for uhash_data in DataArray::from_string(&Data::as_string(uuid)).objects() {
        let uhash = uhash_data.string();
        let u_option = map.get(&uhash);
        if u_option.is_some(){
          let u = u_option.unwrap();
          let current_uuid = u.get_string("id");
          let mut p = user_to_peer(u.clone(), current_uuid.to_owned());
          if p.has("p2pport") && !p.has("p2p_port") { p.set_property("p2p_port", p.get_property("p2pport")); }
          if p.has("p2p_port") && p.has("address") && p.get_boolean("tcp") { cons.put_string(&current_uuid, &("tcp#".to_string()+&p.get_string("address")+"#"+&Data::as_string(p.get_property("p2p_port")))); }
          else if p.has("p2p_port") && p.has("address") && p.get_boolean("udp") { cons.put_string(&current_uuid, &("udp#".to_string()+&p.get_string("address")+"#"+&Data::as_string(p.get_property("p2p_port")))); }
          else if p.get_boolean("relay") { cons.put_string(&current_uuid, "relay#"); }
        }
      }
    }

    o
}
