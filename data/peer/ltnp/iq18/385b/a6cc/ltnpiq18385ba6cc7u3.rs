let sock_addr = ipaddr+":"+&port.to_string();
let mut stream = TcpStream::connect(sock_addr).unwrap();
let con = handshake(&mut stream, Some(uuid));
let remote_addr = stream.peer_addr().unwrap();
println!("P2P TCP incoming request from {}", remote_addr);

if con.is_some() {
  thread::spawn(move || {
    handle_connection(con.unwrap());
  });
}


DataObject::new()