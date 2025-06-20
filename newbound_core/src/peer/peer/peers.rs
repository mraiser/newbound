use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;
use crate::peer::service::listen::get_tcp;
use crate::peer::service::listen::get_relay;
use crate::peer::service::listen::get_udp;

pub fn execute(_: DataObject) -> DataObject {
    let ax = peers();
    let mut result_obj = DataObject::new();
    result_obj.put_array("a", ax);
    result_obj
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
  
  // FIXME - Each call gets the same lock
  let tcp = get_tcp(o.clone()).is_some();
  let udp = get_udp(o.clone()).is_some();
  let relay = get_relay(o.clone()).is_some();
  let connected = tcp || udp || relay;
  
  o.put_boolean("tcp", tcp);  
  o.put_boolean("udp", udp);  
  o.put_boolean("relay", relay);  
  o.put_boolean("connected", connected);  

  o
}
