pub mod generated;
pub mod http;

use std::env;
use ndata::dataobject::*;
use flowlang::datastore::*;
use flowlang::command::*;
use std::thread;
use std::time::Duration;

use crate::generated::*;
use crate::http::*;

use flowlang::generated::flowlang::file::read_properties::read_properties;
use flowlang::generated::flowlang::system::time::time;

fn main() {
  DataStore::init("data");
  flowlang::generated::Generated::init();
  Generated::init();

  env::set_var("RUST_BACKTRACE", "1");
  {
/*
    let lib = "botmanager";
    let ctl = "startup";
    let cmd = "main";
    
    let args = DataObject::new();
    let cmd = Command::lookup(lib, ctl, cmd);
    let res = cmd.execute(args).unwrap();
    println!("{}", res.to_string());
*/

    let store = DataStore::new();

    let system = init_globals();
    
    // Init Timers
    let libraries = system.get_object("libraries");
    for (lib, libdata) in libraries.objects() {
      let libdata = libdata.object();
      let mut timers = libdata.get_object("timers");
      let controls = store.get_data(&lib, "controls").get_object("data").get_array("list");
      for ctldata in controls.objects() {
        let ctldata = ctldata.object();
        let ctlid = ctldata.get_string("id");
        let ctlname = ctldata.get_string("name");
        let ctl = store.get_data(&lib, &ctlid).get_object("data");
        if ctl.has("timer") {
          let ctimers = ctl.get_array("timer");
          for timer in ctimers.objects() {
            let timer = timer.object();
            let tname = timer.get_string("name");
            let tid = timer.get_string("id");
            let mut tdata = store.get_data(&lib, &tid).get_object("data");
            let start = tdata.get_i64("start");
            let start = to_millis(start, tdata.get_string("startunit"));
            let interval = tdata.get_i64("interval");
            let interval = to_millis(interval, tdata.get_string("intervalunit"));
            tdata.put_str("ctlname", &ctlname);
            tdata.put_str("name", &tname);
            tdata.put_i64("startmillis", start);
            tdata.put_i64("intervalmillis", interval);
            timers.put_object(&tid, tdata);
          }
        }
      }
    }
    
    // FIXME: Start Events
    
    // Start Timers
    thread::spawn(timer_loop);
    
    // Start HTTP
    thread::spawn(http_listen);
    
    // FIXME - Check sessions
    loop {
      let dur = Duration::from_millis(5000);
      thread::sleep(dur);
    }
  }
}

fn timer_loop() {
  let system = DataStore::globals().get_object("system");
  loop {
    if system.get_bool("running") {
      let now = time();
      let libraries = system.get_object("libraries");
      for (lib, libdata) in libraries.objects() {
        let libdata = libdata.object();
        let mut timers = libdata.get_object("timers");
        for (id, timer) in timers.objects() {
          let mut timer = timer.object();
          let when = timer.get_i64("startmillis");
          if when <= now {
            timers.remove_property(&id);
            let cmdid = timer.get_string("cmd");
            let params = timer.get_object("params");
            let repeat = timer.get_bool("repeat");
            let db = lib.to_owned();
            let mut ts = timers.duplicate();
            thread::spawn(move || {
              let cmd = Command::new(&db, &cmdid);
              let _x = cmd.execute(params).unwrap();
              
              if repeat {
                let next = now + timer.get_i64("intervalmillis");
                timer.put_i64("startmillis", next);
                ts.put_object(&id, timer);
              }
            });
          }
        }
      }
    }
    else {
      break;
    }

    let dur = Duration::from_millis(1000);
    thread::sleep(dur);
  }
}

fn init_globals() -> DataObject {
  let mut system = read_properties("config.properties".to_string());
  if !system.has("socket_address") {
    let ip;
    let port;
    if system.has("http_address") { ip = system.get_string("http_address"); }
    else { ip = "127.0.0.1".to_string(); }
    if system.has("http_port") { port = system.get_string("http_port"); }
    else { port = "5773".to_string(); }
    let socket_address = ip+":"+&port;
    system.put_str("socket_address", &socket_address);
  }
    
  let s = system.get_string("apps");
  let s = s.trim().to_string();
  let sa = s.split(",");
  
  let mut apps = DataObject::new();
  let default_app = sa.to_owned().nth(0).unwrap().to_string();
  
  let mut libraries = DataObject::new();
  
  for i in sa {
    let mut o = DataObject::new();
    o.put_str("id", i);
    let path_base = "runtime/".to_string()+i+"/";
    let path = path_base.to_owned()+"botd.properties";
    let p = read_properties(path);
    o.put_object("runtime", p);
    let path = path_base+"app.properties";
    let p = read_properties(path);
    o.put_object("app", p.duplicate());
    apps.put_object(i, o);
    
    let s = p.get_string("libraries");
    let sa2 = s.split(",");
    for j in sa2 {
      if !libraries.has(j) {
        let mut o2 = DataObject::new();
        o2.put_object("timers", DataObject::new());
        o2.put_object("events", DataObject::new());
        libraries.put_object(j, o2);
      }
    }
  }
  
  system.put_str("default_app", &default_app);
  system.put_object("apps", apps);
  system.put_object("sessions", DataObject::new());
  system.put_bool("running", true);
  system.put_object("libraries", libraries);
  
  DataStore::globals().put_object("system", system.duplicate());

  system
}

fn to_millis(i:i64, s:String) -> i64 {
  if s == "milliseconds" { return i; }
  let i = i * 1000;
  if s == "seconds" { return i; }
  let i = i * 60;
  if s == "minutes" { return i; }
  let i = i * 60;
  if s == "hours" { return i; }
  let i = i * 24;
  if s != "days" { panic!("Unknown time unit for timer ({})", &s); }
  
  i
}
