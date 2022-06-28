pub mod generated;

use std::env;
use ndata::dataobject::*;
use flowlang::datastore::*;
use flowlang::command::*;
use crate::generated::*;

fn main() {
  DataStore::init("data");
  flowlang::generated::Generated::init();
  Generated::init();

  env::set_var("RUST_BACKTRACE", "1");
  {
    let lib = "botmanager";
    let ctl = "startup";
    let cmd = "main";
    
    let args = DataObject::new();
    let cmd = Command::lookup(lib, ctl, cmd);
    let res = cmd.execute(args).unwrap();
    println!("{}", res.to_json());
  }
}
