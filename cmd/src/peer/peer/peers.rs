use ndata::dataobject::*;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;
use crate::peer::service::listen::get_tcp;

pub fn execute(_o: DataObject) -> DataObject {
let ax = peers();
let mut o = DataObject::new();
o.put_array("a", ax);
o
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

pub fn user_to_peer(o:DataObject, id:String) -> DataObject {
  let mut o = o.deep_copy();
  o.remove_property("password");
  o.remove_property("publickkey");
  o.put_str("id", &id);
  o.put_str("name", &o.get_string("displayname"));
  
  let relays = get_relays(id);
  
  let tcp = get_tcp(o.duplicate()).is_some();
  let udp = false;
  let relay = relays.len()>0;
  let connected = tcp || udp || relay;
  
  o.put_bool("tcp", tcp);  
  o.put_bool("udp", udp);  
  o.put_bool("relay", relay);  
  o.put_bool("connected", connected);  
  o.put_array("relays", relays);  

  o
}

