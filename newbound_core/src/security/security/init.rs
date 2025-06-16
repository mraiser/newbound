use ndata::dataobject::DataObject;
use std::thread;
use std::fs;
use core::time::Duration;
use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use flowlang::appserver::fire_event;
use ndata::dataarray::DataArray;
use ndata::data::Data;
use flowlang::flowlang::object::index_of::index_of;
use flowlang::command::Command;
use flowlang::flowlang::file::write_properties::write_properties;
use std::fs::create_dir_all;
use flowlang::flowlang::system::unique_session_id::unique_session_id;
use flowlang::flowlang::file::read_properties::read_properties;

pub fn execute(_: DataObject) -> DataObject {
    let ax = init();
    let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
    result_obj
}

pub fn init() -> DataObject {
  load_users();

  thread::spawn(move || {
    let mut system = DataStore::globals().get_object("system");
    system.put_boolean("security_ready", true);
    
    // Check sessions
    let dur = Duration::from_millis(5000);
    let mut sessions = system.get_object("sessions");
    let sessiontimeoutmillis = system.get_object("config").get_int("sessiontimeoutmillis");

    while system.get_boolean("running") {
      let expired = time() - sessiontimeoutmillis; 
      for (k,v) in sessions.objects() {
        let v = v.object();
        let expire = v.get_int("expire");
        if expire < expired {
          println!("Session expired {} {} {}", k, v.get_string("username"), v.get_object("user").get_string("displayname"));
          sessions.remove_property(&k);
          fire_event("app", "SESSION_EXPIRE", v);
        }
      }
      thread::sleep(dur);
    }
  });

  DataObject::new()
}

pub fn check_auth(lib:&str, id:&str, session_id:&str, write:bool) -> bool {
  let store = DataStore::new();
  let system = DataStore::globals().get_object("system");
  
  if !system.get_object("config").get_boolean("security") { 
    return true; 
  }
  
  let libdata = system.get_object("libraries").get_object(lib);
  let libgroups = libdata.get_array("readers");
  
  let which;
  if write { which = "writers"; }
  else { which = "readers"; }
  
  let ogroups;
  if !store.get_data_file(lib, id).exists() {
    ogroups = libgroups.clone();
  }
  else {
    let data = store.get_data(lib, id);
    if data.has(which) { ogroups = data.get_array(which); }
    else { ogroups = DataArray::new(); }
  }
  
  let lg = Data::DArray(libgroups.data_ref);
  let og = Data::DArray(ogroups.data_ref);
    
  if index_of(lg.clone(), Data::DString("anonymous".to_string())) != -1 {
    if index_of(og.clone(), Data::DString("anonymous".to_string())) != -1 {
      return true;
    }
  }

  let sessions = system.get_object("sessions");
  let groups;
  if sessions.has(session_id) {
    let session = sessions.get_object(session_id);
    let user = session.get_object("user");
    groups = user.get_array("groups");
  }
  else { groups = DataArray::new(); }
  
  if index_of(Data::DArray(groups.data_ref), Data::DString("admin".to_string())) != -1 {
    return true;
  }
  
  for g in groups.objects() {
    if index_of(lg.clone(), g.clone()) != -1 {
      if index_of(og.clone(), g.clone()) != -1 {
        return true;
      }
    }
  }
    
  false
}

pub fn check_security(command:&Command, session_id:&str) -> bool {
//  println!("session id: {}", session_id);
  let system = DataStore::globals().get_object("system");
  
  if !system.get_object("config").get_boolean("security") { 
    return true; 
  }
    
  let lib = system.get_object("libraries").get_object(&command.lib);
  
  let libgroups = lib.get_property("readers");
  let cmdgroups = &command.readers;
  if index_of(libgroups.clone(), Data::DString("anonymous".to_string())) != -1 {
    if cmdgroups.iter().position(|r| r == "anonymous").is_some() {
      return true;
    }
  }
  
  let sessions = system.get_object("sessions");
  let groups;
  if sessions.has(session_id) {
    let session = sessions.get_object(session_id);
    let user = session.get_object("user");
    groups = user.get_array("groups");
  }
  else { groups = DataArray::new(); }
  
  if index_of(Data::DArray(groups.data_ref), Data::DString("admin".to_string())) != -1 {
    return true;
  }
  
  for g in groups.objects() {
    if index_of(libgroups.clone(), Data::DString("anonymous".to_string())) != -1 || index_of(libgroups.clone(), g.clone()) != -1 {
      if cmdgroups.iter().position(|r| r == &(g.string())).is_some() {
        return true;
      }
    }
  }
    
  false
}

pub fn log_in(sessionid:&str, username:&str, password:&str) -> bool {
  let user = get_user(username);
  let mut e = DataObject::new();
  e.put_string("user", username);
  e.put_string("sessionid", sessionid);
  if user.is_some() {
    let user = user.unwrap();
    if user.get_string("password") == password {
      let system = DataStore::globals().get_object("system");
      let sessions = system.get_object("sessions");
      let mut session = sessions.get_object(sessionid);
      session.put_string("username", username);
      session.put_object("user", user);
      
      fire_event("security", "LOGIN", e);

      return true;
    }
  }

  fire_event("security", "LOGIN_FAIL", e);
  
  false
}

pub fn get_user(username:&str) -> Option<DataObject> {
  let system = DataStore::globals().get_object("system");
  if system.get_object("config").get_boolean("security") { 
    let users = system.get_object("users");
    if users.has(username) {
      return Some(users.get_object(username));
    }
  }
  None
}

pub fn delete_user(username:&str) -> bool{
  let system = DataStore::globals().get_object("system");
  if system.get_object("config").get_boolean("security") { 
    let mut users = system.get_object("users");
    if users.has(&username) {
      users.remove_property(&username);
      let root = DataStore::new().root.parent().unwrap().join("users");
      let propfile = root.join(&(username.to_owned()+".properties"));
      let x = fs::remove_file(propfile);
      if x.is_ok() { return true; }
    }
  }
  false
}

pub fn set_user(username:&str, user:DataObject) {
  let system = DataStore::globals().get_object("system");
  if system.get_object("config").get_boolean("security") { 
    let mut users = system.get_object("users");
    if !users.has(&username) { users.put_object(username, user.deep_copy()); }
    
    let mut user = user.deep_copy();
    let groups = user.get_array("groups");
    let mut s = "".to_string();
    for g in groups.objects() {
      let g = g.string();
      if s != "" { s += ","; }
      s += &g
    }
    user.put_string("groups", &s);
    let root = DataStore::new().root.parent().unwrap().join("users");
    let propfile = root.join(&(username.to_owned()+".properties"));
    write_properties(propfile.into_os_string().into_string().unwrap(), user);
  }
}

pub fn load_users() {
  let mut system = DataStore::globals().get_object("system");
  if system.get_object("config").get_boolean("security") { 
    let mut users;
    let mut b = false;
    if system.has("users") { users = system.get_object("users"); }
    else {
      b = true;
      users = DataObject::new();
    }
    
    let root = DataStore::new().root.parent().unwrap().join("users");
    let propfile = root.join("admin.properties");
    if !propfile.exists() {
      let _x = create_dir_all(&root);
      let mut admin = DataObject::new();
      admin.put_string("displayname", "System Administrator");
      admin.put_string("groups", "admin");
      admin.put_string("password", &unique_session_id());
      write_properties(propfile.into_os_string().into_string().unwrap(), admin);
    }
    
    for file in fs::read_dir(&root).unwrap() {
      let file = file.unwrap();
      let name = file.file_name().into_string().unwrap();
      if name.ends_with(".properties") {
        let mut user = read_properties(file.path().into_os_string().into_string().unwrap());
        let id = &name[..name.len()-11];
        let groups = user.get_string("groups");
        let mut da = DataArray::new();
        for group in groups.split(",") { da.push_string(group); }
        user.put_array("groups", da);
        user.put_array("connections", DataArray::new());
        user.put_string("id", &id);
        
        if user.has("addresses"){
          let s = user.get_string("addresses");
          let da = DataArray::from_string(&s);
          user.put_array("addresses", da);
        }
        
        users.put_object(id, user);
      }
    }
    
    if b { system.put_object("users", users.clone()); }
  }
}
