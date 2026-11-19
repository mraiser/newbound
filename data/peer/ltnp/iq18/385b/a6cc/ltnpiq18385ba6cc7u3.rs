use std::net::ToSocketAddrs;
if port < 1 || port > 65535 { return false; }
// Resolve first (hostnames, IPv4 and bare IPv6 literals), then try each
// resolved address with the 10 s connect timeout.
let addrs = match (ipaddr.trim(), port as u16).to_socket_addrs() {
  Ok(addrs) => addrs,
  Err(_) => return false,
};
let mut stream: std::io::Result<TcpStream> = Err(std::io::Error::new(std::io::ErrorKind::NotFound, "no address resolved"));
for addr in addrs {
  stream = TcpStream::connect_timeout(&addr, std::time::Duration::from_secs(10));
  if stream.is_ok() { break; }
}
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