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