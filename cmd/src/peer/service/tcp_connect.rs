use ndata::dataobject::*;
use std::net::TcpStream;
use std::thread;
use crate::peer::service::listen::handshake;
use crate::peer::service::listen::handle_connection;
pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_string("ipaddr");
let a2 = o.get_i64("port");
let ax = tcp_connect(a0, a1, a2);
let mut o = DataObject::new();
o.put_bool("a", ax);
o
}

pub fn tcp_connect(uuid:String, ipaddr:String, port:i64) -> bool {
let sock_addr = ipaddr+":"+&port.to_string();
let mut stream = TcpStream::connect(sock_addr).unwrap();
let con = handshake(&mut stream, Some(uuid));
let remote_addr = stream.peer_addr().unwrap();
println!("P2P TCP incoming request from {}", remote_addr);

if con.is_some() {
  thread::spawn(move || {
    handle_connection(con.unwrap());
  });
  return true;
}

false
}

