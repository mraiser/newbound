mod cmdinit;

use std::env;
use flowlang::appserver::*;
use flowlang::rustcmd::*;
use crate::cmdinit::cmdinit;

fn main() {
  flowlang::init("data");
  init_cmds();

  env::set_var("RUST_BACKTRACE", "1");
  {
    run();
  }
}

fn init_cmds(){
  let mut v = Vec::new();
  cmdinit(&mut v);
  for q in &v { RustCmd::add(q.0.to_owned(), q.1, q.2.to_owned()); }
}


pub mod nebula;
pub mod raspberry;
pub mod chuckme;