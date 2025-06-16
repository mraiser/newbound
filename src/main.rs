mod generated_initializer;

use std::env;
use flowlang::appserver::*;
use flowlang::buildrust::build_all;
use flowlang::buildrust::rebuild_rust_api;
use ndata::dataobject::DataObject;

fn main() {
  env::set_var("RUST_BACKTRACE", "1");
  {
    let _data_ref = flowlang::init("data");
    generated_initializer::initialize_all_commands();

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

      if x == "mcp" {
        init_globals();
        flowlang::mcp::mcp::mcp::run();
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
