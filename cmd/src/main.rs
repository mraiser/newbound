use std::env;
use flowlang::appserver::*;
use flowlang::rustcmd::*;

fn main() {
  flowlang::init("data");
  init_cmds();

  env::set_var("RUST_BACKTRACE", "1");
  {
    run();
  }
}

fn init_cmds(){
}
