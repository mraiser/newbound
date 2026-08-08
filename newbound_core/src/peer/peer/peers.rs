use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;
use crate::peer::service::listen::get_tcp;
use crate::peer::service::listen::get_relay;
use crate::peer::service::listen::get_udp;

pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        peers()
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_array("a", ax);
            result_obj
        }
        Err(err) => {
            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");

            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic occurred".to_string()
            };

            err_obj.put_string("msg", &msg);
            // Wrapped in the same `a` envelope a successful return uses.
            // Unwrapped, callers that unpack the envelope (newbound's
            // format_result, for one) report an opaque 500 — "Not an object:
            // DString(\"err\")" — instead of this message.
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", err_obj);
            result_obj
        }
    }
}

pub fn peers() -> DataArray {
  let users = DataStore::globals().get_object("system").get_object("users");
  let mut peers = DataArray::new();
  for (id, o) in users.objects(){
    if id.len() == 36 {
      peers.push_object(user_to_peer(o.object(), id));
    }
  }

  peers
}
/*
pub fn get_relays(id:String) -> DataArray {
  let users = DataStore::globals().get_object("system").get_object("users");
  let mut v = DataArray::new();
  for (uuid, user) in users.objects(){
    if uuid != id {
      let user = user.object();
      if user.has("peers"){
        let peers = user.get_object("peers");
        if peers.has(&id) && peers.get_string(&id).starts_with("tcp#") {
          v.push_str(&uuid);
        }
      }
    }
  }
  v
}
*/
pub fn user_to_peer(o:DataObject, id:String) -> DataObject {
  let mut o = o.deep_copy();
  o.remove_property("password");
  o.remove_property("publickkey");
  o.put_string("id", &id);
  o.put_string("name", &o.get_string("displayname"));
  
  // One lookup per transport (the old code called each twice - once for the
  // flag, and the connection was needed again for last_contact).
  let tcpc = get_tcp(o.clone());
  let udpc = get_udp(o.clone());
  let relayc = get_relay(o.clone());
  let tcp = tcpc.is_some();
  let udp = udpc.is_some();
  let relay = relayc.is_some();
  let connected = tcp || udp || relay;

  // last_contact: epoch ms of the most recent traffic on whichever transport
  // is up, 0 when nothing is connected. NOTE a P2PStream::Tcp reports time()
  // - TCP keeps no per-read stamp - so a live TCP peer always reads "now";
  // only UDP and relay carry a real age. Clients must treat 0 as unknown.
  let last_contact = match (&tcpc, &udpc, &relayc) {
    (Some(c), _, _) => c.last_contact(),
    (_, Some(c), _) => c.last_contact(),
    (_, _, Some(c)) => c.last_contact(),
    _ => 0,
  };

  o.put_boolean("tcp", tcp);  
  o.put_boolean("udp", udp);  
  o.put_boolean("relay", relay);  
  o.put_boolean("connected", connected);  
  o.put_int("last_contact", last_contact);

  o
}
