pub mod generated;

use std::env;
use std::io;
use std::io::BufRead;
use ndata::dataobject::*;

use flowlang::datastore::*;
use flowlang::command::*;

use crate::generated::*;

fn main() {
  DataStore::init("data");
  Generated::init();
  
  env::set_var("RUST_BACKTRACE", "1");
  {
    let params: Vec<String> = env::args().collect();
    let lib = &params[1];
    let ctl = &params[2];
    let cmd = &params[3];

    let stdin = io::stdin();
    let mut lines = stdin.lock().lines();
    let mut s = "".to_string();
    while let Some(line) = lines.next() {
      s = s + &line.unwrap();
    }
    
    let args = DataObject::from_string(&s);
    let cmd = Command::lookup(lib, ctl, cmd);
    let res = cmd.execute(args).unwrap();
    println!("{}", res.to_string());
  }
}
