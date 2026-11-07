let sock_addr = ipaddr+":"+&port.to_string();
let addr = match sock_addr.parse::<std::net::SocketAddr>() {
  Ok(addr) => addr,
  Err(_) => return false,
};
let stream = TcpStream::connect_timeout(&addr, std::time::Duration::from_secs(10));
if stream.is_ok() {
  let stream = stream.unwrap();
  let _ = stream.set_nodelay(true);
  let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(30)));
  let _ = stream.set_write_timeout(Some(std::time::Duration::from_secs(15)));
  let mut stream = P2PStream::Tcp(Arc::new(stream), Arc::new(Mutex::new(())));
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