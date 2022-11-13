pub mod peer;
pub mod security;
pub mod dev;
pub mod app;
mod cmdinit;

use std::env;
use flowlang::appserver::*;
use flowlang::rustcmd::*;

#[cfg(feature = "reload")]
use std::thread;
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
    for q in &v { RustCmd::add(q.0.to_owned(), q.1, q.2.to_owned()); }
    
    mirror(&mut initializer);
    for q in &initializer.cmds { RustCmd::add(q.0.to_owned(), q.1, q.2.to_owned()); }

    #[cfg(feature = "reload")]
    {
      thread::spawn(move || {
        loop {
          println!("waiting for library change...");
          let token = hot_lib::subscribe().wait_for_about_to_reload();
          drop(token);
          hot_lib::subscribe().wait_for_reload();
          println!("... library has been reloaded {} times", hot_lib::version());
          
          mirror(&mut initializer);
          // FIXME - remove deleted commands
          for q in &initializer.cmds { RustCmd::add(q.0.to_owned(), q.1, q.2.to_owned()); }
        }
      });
    }
      
    run();
  }
}
