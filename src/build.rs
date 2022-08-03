use std::env;
use flowlang::buildrust::*;
use flowlang::datastore::*;

fn main() {
  DataStore::init("data");

  env::set_var("RUST_BACKTRACE", "1");
  {
    let params: Vec<String> = env::args().collect();
    let lib = &params[1];
    if lib == "all" {
      build_all();
    }
    else {
      let ctl = &params[2];
      let cmd = &params[3];
      build(lib, ctl, cmd);
    }
  }
}
