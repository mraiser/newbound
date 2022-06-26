use std::env;
use std::io;
use std::io::BufRead;
use flow::buildrust::*;
use flow::datastore::*;

fn main() {
  DataStore::init("data");

  env::set_var("RUST_BACKTRACE", "1");
  {
    let params: Vec<String> = env::args().collect();
    let lib = &params[1];
    if lib == "all" {
      buildAll();
    }
    else {
      let ctl = &params[2];
      let cmd = &params[3];
      build(lib, ctl, cmd);
    }
  }
}
