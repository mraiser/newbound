pub mod peer;
pub mod security;
pub mod dev;
pub mod app;
mod cmdinit;

use std::env;
use flowlang::appserver::*;
use flowlang::rustcmd::*;
use flowlang::buildrust::build_all;
use flowlang::buildrust::rebuild_rust_api;
use ndata::dataobject::DataObject;


#[cfg(feature = "reload")]
use hot_lib::*;
#[cfg(not(feature = "reload"))]
use cmd::*;

use crate::cmdinit::cmdinit;

#[cfg(feature = "reload")]
#[hot_lib_reloader::hot_module(dylib = "cmd")]
mod hot_lib {
    pub use cmd::Initializer;
    hot_functions_from_file!("cmd/src/lib.rs");
    #[lib_change_subscription]
    pub fn subscribe() -> hot_lib_reloader::LibReloadObserver {}
    #[lib_version]
    pub fn version() -> usize {}
}

fn main() {
  env::set_var("RUST_BACKTRACE", "1");
  {
    let mut initializer = Initializer { data_ref: flowlang::init("data"), cmds: Vec::new() };
    let mut v = Vec::new();
    cmdinit(&mut v);
    initializer.cmds = v;
    mirror(&mut initializer);
    for q in &initializer.cmds { RustCmd::add(q.0.to_owned(), q.1, q.2.to_owned()); }
    
    #[cfg(feature = "reload")]
    {
      use std::thread;
      thread::spawn(move || {
        loop {
          println!("waiting for library change...");
          let token = hot_lib::subscribe().wait_for_about_to_reload();
          drop(token);
          hot_lib::subscribe().wait_for_reload();
          println!("... library has been reloaded {} times", hot_lib::version());
          
          initializer.cmds.clear();
          let mut v = Vec::new();
          cmdinit(&mut v);
          initializer.cmds = v;
          mirror(&mut initializer);
          for q in &initializer.cmds { RustCmd::add(q.0.to_owned(), q.1, q.2.to_owned()); }
        }
      });
    }

    let params: Vec<String> = env::args().collect();
    if params.len() > 1{
      let x = &params[1];
      if x == "exec" {
        let lib = &params[2];
        let ctl = &params[3];
        let cmd = &params[4];
        let data = DataObject::from_string(&params[5]);
        let o = flowlang::command::Command::lookup(lib, ctl, cmd).execute(data);
//        println!("exec {}::{}::{} ->\n\n{}", lib, ctl, cmd, o.unwrap().to_string());
        println!("\n{}", o.unwrap().to_string());
        return;
      }
      
      if x == "rebuild" {
        println!("REBUILDING ALL");
        build_all();
        rebuild_rust_api();
        return;
      }
    }
    
    #[cfg(not(feature = "webview"))]
    run();
    
    #[cfg(feature = "webview")]
    {
      use crate::security::security::init::get_user;
      use flowlang::flowlang::system::unique_session_id::unique_session_id;
      use ndata::dataobject::DataObject;
      use flowlang::datastore::DataStore;
      use crate::security::security::init::log_in;
      use core::time::Duration;
      use std::thread;
      use wry::{
        application::{
          event::{Event, WindowEvent},
          event_loop::{ControlFlow, EventLoop},
          window::WindowBuilder,
        },
        webview::WebViewBuilder,
      };

      thread::spawn(move || {
        run();
      });

      let beat = Duration::from_millis(10);
      let globals = DataStore::globals();
      while !globals.has("system") { thread::sleep(beat); }
      let system = globals.get_object("system");
      while !system.has("http_ready") { thread::sleep(beat); }
          
      // FIXME - Make session creation a function
      let config = system.get_object("config");
      let user = get_user("admin").unwrap();
      let session_id = unique_session_id();
      let mut session = DataObject::new();
      session.put_int("count", 0);
      session.put_string("id", &session_id);
      session.put_string("username", "admin");
      session.put_object("user", user.clone());
      session.put_int("expire", i64::MAX);
      let mut sessions = system.get_object("sessions");
      sessions.put_object(&session_id, session.clone());
      
      let pass = user.get_string("password");
      if log_in(&session_id, "admin", &pass){
        let port = config.get_int("http_port");
        let default_app = system.get_string("default_app");
              
        let mut s = "http://localhost:".to_string();
        s += &port.to_string();
        s += "/";
        s += &default_app;
        s += "/index.html?sessionid=";
        s += &session_id;

        let event_loop = EventLoop::new();
        let window = WindowBuilder::new()
          .with_title("Newbound")
          .build(&event_loop).unwrap();
        let _webview = WebViewBuilder::new(window).unwrap()
          .with_url(&s).unwrap()
          .build().unwrap();

        event_loop.run(move |event, _, control_flow| {
          *control_flow = ControlFlow::Wait;

          match event {
            Event::WindowEvent {
              event: WindowEvent::CloseRequested,
              ..
            } => *control_flow = ControlFlow::Exit,
            _ => (),
          }
        });
      }
    }
  }
}
