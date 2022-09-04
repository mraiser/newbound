pub mod generated;
pub mod appserver;

use std::env;
use flowlang::datastore::*;

use crate::generated::*;
use crate::appserver::*;

fn main() {
  DataStore::init("data");
  flowlang::generated::Generated::init();
  Generated::init();

  env::set_var("RUST_BACKTRACE", "1");
  {
    run();
  }
}


