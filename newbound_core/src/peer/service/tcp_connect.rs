use ndata::dataobject::DataObject;
use std::net::TcpStream;
use std::thread;
use crate::peer::service::listen::handshake;
use crate::peer::service::listen::handle_connection;
use crate::peer::service::listen::P2PStream;
pub fn execute(o: DataObject) -> DataObject {
    let arg_0: String = o.get_string("uuid");
    let arg_1: String = o.get_string("ipaddr");
    let arg_2: i64 = o.get_int("port");
    let ax = tcp_connect(arg_0, arg_1, arg_2);
    let mut result_obj = DataObject::new();
    result_obj.put_boolean("a", ax);
    result_obj
}

pub fn tcp_connect(uuid: String, ipaddr: String, port: i64) -> bool {
let sock_addr = ipaddr+":"+&port.to_string();
let stream = TcpStream::connect(sock_addr);
if stream.is_ok() {
  let stream = stream.unwrap();
  //let remote_addr = stream.peer_addr().unwrap();
  //println!("P2P TCP outgoing request to {}", remote_addr);
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
