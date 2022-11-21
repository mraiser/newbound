use ndata::dataobject::*;
use std::net::TcpStream;
use std::thread;
use crate::peer::service::listen::handshake;
use crate::peer::service::listen::handle_connection;
use crate::peer::service::listen::P2PStream;
pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("uuid");
let a1 = o.get_string("ipaddr");
let a2 = o.get_int("port");
let ax = tcp_connect(a0, a1, a2);
let mut o = DataObject::new();
o.put_boolean("a", ax);
o
}

pub fn tcp_connect(uuid:String, ipaddr:String, port:i64) -> bool {
let sock_addr = ipaddr+":"+&port.to_string();
let stream = TcpStream::connect(sock_addr);
if stream.is_ok() {
  let stream = stream.unwrap();
  let remote_addr = stream.peer_addr().unwrap();
  println!("P2P TCP outgoing request to {}", remote_addr);
  let mut stream = P2PStream::Tcp(stream);
  let con = handshake(&mut stream, Some(uuid));
  if con.is_some() {
    thread::spawn(move || {
      let (conid, con) = con.unwrap();
      handle_connection(conid, con);
    });
    return true;
  }
}
false
}

