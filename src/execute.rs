use std::env;
use std::io;
use std::io::BufRead;
use ndata::dataobject::*;

use flowlang::datastore::*;
use flowlang::command::*;
use flowlang::rustcmd::*;
use flowlang::generated::Generated as Fgen;

fn main() {
  let mut initializer = cmd::Initializer { data_ref: flowlang::init("data"), cmds: Vec::new() };
  Fgen::init();
  cmd::mirror(&mut initializer);
  for q in &initializer.cmds { RustCmd::add(q.0.to_owned(), q.1, q.2.to_owned()); }
  
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
