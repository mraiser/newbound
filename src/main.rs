use std::env;
use ndata::dataobject::*;

use flow::datastore::*;
use flow::command::*;

fn main() {
  DataStore::init("data");
  
  env::set_var("RUST_BACKTRACE", "1");
  {
    let args = DataObject::new();
    let cmd = Command::lookup("test", "chuckme", "main");
    let res = cmd.execute(args).unwrap();
    println!("{}", res.to_json());
  }
}
