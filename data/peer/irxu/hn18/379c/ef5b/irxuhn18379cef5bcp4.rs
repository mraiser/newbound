  START.call_once(|| { P2PHEAP.set(RwLock::new(Heap::new())); });
  do_listen(ipaddr, port)
}

static START: Once = Once::new();
pub static P2PHEAP:Storage<RwLock<Heap<P2PConnection>>> = Storage::new();

#[derive(Debug)]
pub struct RelayStream {
  from: String,
  to: String,
  buf: DataArray,
}

impl RelayStream {
  pub fn new(from:String, to:String) -> RelayStream {
    RelayStream{
      from:from,
      to:to,
      buf:DataArray::new(),
    }
  }
  pub fn duplicate(&self) -> RelayStream {
    RelayStream{
      from:self.from.to_owned(),
      to:self.to.to_owned(),
      buf:self.buf.duplicate(),
    }
  }
}

#[derive(Debug)]
pub enum P2PStream {
  Tcp(TcpStream),
  Relay(RelayStream),
  Udp(UdpStream),
}

impl P2PStream {
  pub fn is_tcp(&self) -> bool {
    match self {
      P2PStream::Tcp(_stream) => true,
      P2PStream::Relay(_stream) => false,
      P2PStream::Udp(_stream) => false,
    }
  }
  
  pub fn is_relay(&self) -> bool {
    match self {
      P2PStream::Tcp(_stream) => false,
      P2PStream::Relay(_stream) => true,
      P2PStream::Udp(_stream) => false,
    }
  }
  
  pub fn try_clone(&self) -> io::Result<P2PStream> {
    match self {
      P2PStream::Tcp(stream) => {
        let s2 = stream.try_clone()?;
        Ok(P2PStream::Tcp(s2))
      },
      P2PStream::Relay(stream) => {
        Ok(P2PStream::Relay(stream.duplicate()))
      },
      P2PStream::Udp(_stream) => {
        panic!("Not implemented");
      },
    }
  }
  
  pub fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
    match self {
      P2PStream::Tcp(stream) => {
        stream.write(buf)
      },
      P2PStream::Relay(stream) => {
        let from = &stream.from;
        let to = &stream.to;
        
        let user = get_user(&from);
        if user.is_some(){
          let user = user.unwrap();
          let con = get_tcp(user);
          if con.is_some(){
            let con = con.unwrap();
            let cipher = con.cipher;
            let mut stream = con.stream;
            let mut bytes = ("fwd ".to_string()+&to).as_bytes().to_vec();
            bytes.extend_from_slice(buf);

            let buf = encrypt(&cipher, &bytes);
            let len = buf.len() as i16;
            let mut bytes = len.to_be_bytes().to_vec();
            bytes.extend_from_slice(&buf);
            let x = stream.write(&bytes)?;
            return Ok(x);
          }
          panic!("No route to relay {}", from);
        }
        panic!("No such relay {}", from);
      },
      P2PStream::Udp(_stream) => {
        panic!("Not implemented");
      },
    }
  }
  
  pub fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
    match self {
      P2PStream::Tcp(stream) => {
        stream.read_exact(buf)
      },
      P2PStream::Relay(stream) => {
        let len = buf.len();
        let mut i = 0;
        let mut v = Vec::new();
        while i < len {
          while stream.buf.len() == 0 {
            spin_loop();
            yield_now();
          }
          
          let bd = &mut stream.buf.get_bytes(0);
          let bytes = bd.get_data();
          let n = std::cmp::min(bytes.len(), len-i);
          v.extend_from_slice(&bytes[0..n]);
          let bytes = bytes[n..].to_vec();
          if bytes.len() > 0 { bd.set_data(&bytes); }
          else { stream.buf.remove_property(0); }
          i += n;
        }        
        buf.clone_from_slice(&v);
        Ok(())
      },
      P2PStream::Udp(_stream) => {
        panic!("Not implemented");
      },
    }
  }
  
  pub fn peer_addr(&self) -> io::Result<SocketAddr> {
    match self {
      P2PStream::Tcp(stream) => {
        stream.peer_addr()
      },
      P2PStream::Relay(_stream) => {
        panic!("Not implemented");
      },
      P2PStream::Udp(_stream) => {
        panic!("Not implemented");
      },
    }
  }
  
  pub fn peek(&self, buf: &mut [u8]) -> io::Result<usize> {
    match self {
      P2PStream::Tcp(stream) => {
        stream.peek(buf)
      },
      P2PStream::Relay(_stream) => {
        panic!("Not implemented");
      },
      P2PStream::Udp(_stream) => {
        panic!("Not implemented");
      },
    }
  }
}

#[derive(Debug)]
pub struct P2PConnection {
  pub stream: P2PStream,
  pub sessionid: String,
  pub cipher: Aes256,
  pub uuid: String,
  pub res: DataObject,
}

impl P2PConnection {
  pub fn duplicate(&self) -> P2PConnection {
    P2PConnection{
      stream: self.stream.try_clone().unwrap(),
      sessionid: self.sessionid.to_owned(),
      cipher: self.cipher.to_owned(),
      uuid: self.uuid.to_owned(),
      res: self.res.duplicate(),
    }
  }
}

pub fn get_tcp(user:DataObject) -> Option<P2PConnection> {
  let mut heap = P2PHEAP.get().write().unwrap();
  let cons = user.get_array("connections");
//  println!("heap {:?} cons {}", heap, cons.to_string());
  for con in cons.objects(){
    let conid = con.int();
    let con = heap.get(conid as usize);
    if con.stream.is_tcp() {
      return Some(con.duplicate());
    }
  }
  None
}

pub fn get_relay(user:DataObject) -> Option<P2PConnection> {
  let mut heap = P2PHEAP.get().write().unwrap();
  let cons = user.get_array("connections");
//  println!("heap {:?} cons {}", heap, cons.to_string());
  for con in cons.objects(){
    let conid = con.int();
    let con = heap.get(conid as usize);
    if con.stream.is_relay() {
      return Some(con.duplicate());
    }
  }
  None
}

pub fn relay(from:&str, to:&str, connected:bool) -> Option<P2PConnection>{
//  println!("RELAY A {} -> {} {}", from,to,connected);
  //FIXME - Fire peer UPDATE, CONNECT & DISCONNECT events
  let mut heap = P2PHEAP.get().write().unwrap();
  let user = get_user(to).unwrap();
  let mut cons = user.get_array("connections");
  for con in cons.objects(){
    let conid = con.int() as usize;
    let con = heap.get(conid);
    if let P2PStream::Relay(stream) = &con.stream {
      if stream.from == from && stream.to == to {
//        println!("RELAY B {} -> {} {}", from,to,connected);
        if connected { return Some(con.duplicate()); }
        // FIXME - remove session
        cons.remove_data(Data::DInt(conid as i64));
        heap.decr(conid);
      }
    }
  }
  if connected {
//    println!("RELAY C {} -> {} {}", from,to,connected);
    // FIXME - move cipher generation to its own function
    let system = DataStore::globals().get_object("system");
    let runtime = system.get_object("apps").get_object("app").get_object("runtime");
    let my_private = runtime.get_string("privatekey");
    let my_private = decode_hex(&my_private).unwrap();
    let my_private: [u8; 32] = my_private.try_into().expect("slice with incorrect length");
    let my_private = StaticSecret::from(my_private);
    
    let peer_public = user.get_string("publickey");
    let peer_public = decode_hex(&peer_public).unwrap();
    let peer_public: [u8; 32] = peer_public.try_into().expect("slice with incorrect length");
    let peer_public = PublicKey::from(peer_public);
    let shared_secret = my_private.diffie_hellman(&peer_public);
    let key = GenericArray::from(shared_secret.to_bytes());
    let cipher = Aes256::new(&key);
    
    let stream = RelayStream::new(from.to_string(), to.to_string());
    let stream = P2PStream::Relay(stream);
    
    let sessionid = unique_session_id();
    let con = P2PConnection{
      stream: stream,
      sessionid: sessionid.to_owned(),
      cipher: cipher,
      uuid: to.to_string(),
      res: DataObject::new(),
    };
    
    let sessiontimeoutmillis = system.get_object("config").get_i64("sessiontimeoutmillis");

    let mut session = DataObject::new();
    session.put_i64("count", 0);
    session.put_str("id", &sessionid);
    session.put_str("username", &to);
    session.put_object("user", user.duplicate());
    let expire = time() + sessiontimeoutmillis;
    session.put_i64("expire", expire);

    let mut sessions = system.get_object("sessions");
    sessions.put_object(&sessionid, session.duplicate());
    
	cons.push_i64(heap.push(con.duplicate())as i64);
//    println!("RELAY D {} -> {} {}", from,to,connected);
    return Some(con.duplicate());
  }
//  println!("RELAY E {} -> {} {}", from,to,connected);
  None
}

pub fn handshake(stream: &mut P2PStream, peer: Option<String>) -> Option<P2PConnection> {
  let system = DataStore::globals().get_object("system");
  let runtime = system.get_object("apps").get_object("app").get_object("runtime");
  let my_uuid = runtime.get_string("uuid");

  // FIXME - move cipher generation to its own function
  let my_public = runtime.get_string("publickey");
  let my_private = runtime.get_string("privatekey");
  let my_private = decode_hex(&my_private).unwrap();
  let my_private: [u8; 32] = my_private.try_into().expect("slice with incorrect length");
  let my_private = StaticSecret::from(my_private);

  // Temp key pair for initial exchange
  let my_session_private = StaticSecret::new(OsRng);
  let my_session_public = PublicKey::from(&my_session_private);

  // Send temp pubkey if init
  let init = peer.is_some();
  if init { let _x = stream.write(&my_session_public.to_bytes()).unwrap(); }

  // Read remote temp pubkey
  let mut bytes = vec![0u8; 32];
  let _x = stream.read_exact(&mut bytes).unwrap();
  let remote_session_public: [u8; 32] = bytes.try_into().expect("slice with incorrect length");
  let remote_session_public = PublicKey::from(remote_session_public);

  // Send temp pubkey if not init
  if !init { let _x = stream.write(&my_session_public.to_bytes()).unwrap(); }
  
  // Temp cipher for initial exchange
  let shared_secret = my_session_private.diffie_hellman(&remote_session_public);
  let key = GenericArray::from(shared_secret.to_bytes());
  let cipher = Aes256::new(&key);

  // Send my UUID
  let bytes = encrypt(&cipher, my_uuid.as_bytes());
  let _x = stream.write(&bytes).unwrap();

  // Get remote UUID
  let mut bytes = vec![0u8; 48];
  let _x = stream.read_exact(&mut bytes).unwrap();
  let mut bytes = decrypt(&cipher, &bytes);
  bytes.resize(36, 0);
  let uuid = String::from_utf8(bytes).unwrap();
  if init && peer.unwrap().to_owned() != uuid { return None; }
  
  let user = get_user(&uuid);
  if user.is_some(){
    let mut user = user.unwrap();
    let havekey = user.has("publickey");

    // Send my_step: 0 = sendpubkey, 1 = continue
    let my_step;
    if havekey { my_step = 1; } else { my_step = 0; }
    let _x = stream.write(&[my_step]).unwrap();

    //read remote_step
    let mut bytes = vec![0u8; 1];
    let x = stream.read_exact(&mut bytes);
    if x.is_err() { return None; }
    
    let remote_step = bytes[0];

    // Remote step
    if remote_step == 0 {
      let bytes = encrypt(&cipher, &decode_hex(&my_public).unwrap());
      let _x = stream.write(&bytes).unwrap();
    }
    else if remote_step != 1 {
      return None;
    }
    
    // mystep
    let peer_public_string;
    let mut saveme = false;
    if !havekey {
      let mut bytes = vec![0u8; 32];
      let _x = stream.read_exact(&mut bytes).unwrap();
      peer_public_string = to_hex(&decrypt(&cipher, &bytes));
      saveme = true;
    }
    else { peer_public_string = user.get_string("publickey"); }
    
    let peer_public = decode_hex(&peer_public_string).unwrap();
    let peer_public: [u8; 32] = peer_public.try_into().expect("slice with incorrect length");
    let peer_public = PublicKey::from(peer_public);
    let shared_secret = my_private.diffie_hellman(&peer_public);
    let key = GenericArray::from(shared_secret.to_bytes());
    let cipher = Aes256::new(&key);

    let isok;
    if init {
      let mut bytes = vec![0u8; 16];
      let _x = stream.read_exact(&mut bytes).unwrap();
      let mut bytes = decrypt(&cipher, &bytes);
      bytes.resize(16, 0);
      let sig = String::from_utf8(bytes).unwrap();
      if sig != "What's good, yo?" { isok = false; }
      else {
        let buf = encrypt(&cipher, "All is good now!".as_bytes());
        let _x = stream.write(&buf).unwrap();
        isok = true;
      }
    }
    else {
      let buf = encrypt(&cipher, "What's good, yo?".as_bytes());
      let _x = stream.write(&buf).unwrap();

      let mut bytes = vec![0u8; 16];
      let _x = stream.read_exact(&mut bytes).unwrap();
      let mut bytes = decrypt(&cipher, &bytes);
      bytes.resize(16, 0);
      let sig = String::from_utf8(bytes).unwrap();

      isok = sig == "All is good now!" 
    }
    
    if isok {
      let con = P2PConnection{
        stream: stream.try_clone().unwrap(),
        sessionid: unique_session_id(),
        cipher: cipher,
        uuid: uuid.to_owned(),
        res: DataObject::new(),
      };
  
      if saveme {
        user.put_str("publickey", &peer_public_string);
        set_user(&uuid, user.duplicate());
      }
      
      return Some(con);
    }
  }
  None
}

fn do_listen(ipaddr:String, port:i64) -> i64 {
  let socket_address = ipaddr+":"+&port.to_string();
  let listener = TcpListener::bind(socket_address).unwrap();
  
  let system = DataStore::globals().get_object("system");
  let mut botd = system.get_object("apps").get_object("peer").get_object("runtime");
  let b = port == 0;
  let port = listener.local_addr().unwrap().port();
  botd.put_i64("port", port as i64);
  
  if b {
    let file = DataStore::new().root
                .parent().unwrap()
                .join("runtime")
                .join("peer")
                .join("botd.properties");
  	let _x = write_properties(file.into_os_string().into_string().unwrap(), botd);
  }

  println!("P2P TCP listening on port {}", port);

  // FIXME - Interrupt and quit if !system.running
  for stream in listener.incoming() {
    let stream = stream.unwrap();
    thread::spawn(move || {
      let remote_addr = stream.peer_addr().unwrap();
      println!("P2P TCP incoming request from {}", remote_addr);
      
      let mut stream = P2PStream::Tcp(stream);
      
      let con = handshake(&mut stream, None);
      if con.is_some() {
        handle_connection(con.unwrap());
      }
    });
  }
  port.into()
}

pub fn handle_connection(con:P2PConnection) {
  let uuid = con.uuid.to_owned();
  let mut user = get_user(&uuid).unwrap();
  let sessionid = con.sessionid.to_owned();
  //let cipher = con.cipher.to_owned();
  let stream = con.stream.try_clone().unwrap();
  //let mut res = con.res.duplicate();

  let system = DataStore::globals().get_object("system");
  let sessiontimeoutmillis = system.get_object("config").get_i64("sessiontimeoutmillis");

  let mut session = DataObject::new();
  session.put_i64("count", 0);
  session.put_str("id", &sessionid);
  session.put_str("username", &uuid);
  session.put_object("user", user.duplicate());
  let expire = time() + sessiontimeoutmillis;
  session.put_i64("expire", expire);

  let mut sessions = system.get_object("sessions");
  sessions.put_object(&sessionid, session.duplicate());

  let data_ref = P2PHEAP.get().write().unwrap().push(con.duplicate());
  let mut connections = user.get_array("connections");
  connections.push_i64(data_ref as i64);

  user.put_i64("last_contact", time());
  let remote_addr = stream.peer_addr().unwrap();
  println!("P2P TCP Connect {} / {} / {} / {}", remote_addr, sessionid, user.get_string("displayname"), uuid);
  user.put_str("address", &remote_addr.ip().to_string());
  let peer = user_to_peer(user.duplicate(), uuid.to_owned());
  fire_event("peer", "CONNECT", peer.duplicate());
  fire_event("peer", "UPDATE", peer.duplicate());
  
  // loop
  while system.get_bool("running") {
    if !handle_next_message(con.duplicate()) { break; }
  }
  // end loop

  let users = DataStore::globals().get_object("system").get_object("users");
  for (uuid2,_u) in users.objects() {
    if uuid2.len() == 36 && uuid != uuid2 {
//      println!("SUSPECT 1 {} -> {}", uuid,uuid);
      relay(&uuid, &uuid2, false);
    }
  }
  
  sessions.remove_property(&sessionid);
  let _x = connections.remove_data(Data::DInt(data_ref as i64));
  P2PHEAP.get().write().unwrap().decr(data_ref);

  println!("P2P TCP Disconnect {} / {} / {} / {}", remote_addr, sessionid, user.get_string("displayname"), uuid);
  let peer = user_to_peer(user.duplicate(), uuid.to_owned());
  fire_event("peer", "DISCONNECT", peer.duplicate());
  fire_event("peer", "UPDATE", peer.duplicate());
}

pub fn handle_next_message(con:P2PConnection) -> bool {
  let mut stream = con.stream;
  let cipher = con.cipher;
  let uuid = con.uuid;
  let mut res = con.res;
  let system = DataStore::globals().get_object("system");
  let sessions = system.get_object("sessions");
  let sessionid = con.sessionid;
  let mut session = sessions.get_object(&sessionid);
  
  let mut bytes = vec![0u8; 2];
  let x = stream.read_exact(&mut bytes);
  if x.is_err() { 
    return false; 
  }

  let bytes: [u8; 2] = bytes.try_into().unwrap();
  let len = i16::from_be_bytes(bytes) as usize; // FIXME - Should be u16
  let mut bytes:Vec<u8> = Vec::with_capacity(len);
  bytes.resize(len, 0);
  let _x = stream.read_exact(&mut bytes).unwrap();
  let bytes = decrypt(&cipher, &bytes);
  let method = String::from_utf8(bytes[0..4].to_vec()).unwrap();

  let sessiontimeoutmillis = system.get_object("config").get_i64("sessiontimeoutmillis");
  session.put_i64("expire", time() + sessiontimeoutmillis);
  let count = session.get_i64("count") + 1;
  session.put_i64("count", count);

  if method == "rcv " {
    let uuid2 = std::str::from_utf8(&bytes[4..40]).unwrap();
    let buf = &bytes[40..];
    
    let bytes: [u8; 2] = buf[0..2].try_into().unwrap();
    let len2 = i16::from_be_bytes(bytes) as usize;
    let mut buf = buf.to_vec();
    buf.resize(len2+2,0);
    
    let con = relay(&uuid, &uuid2, true).unwrap();  
	if let P2PStream::Relay(mut stream) = con.stream.try_clone().unwrap() {
      stream.buf.push_bytes(DataBytes::from_bytes(&buf.to_vec()));
      handle_next_message(con);
    }
  }
  else if method == "fwd ".to_string() {
    let uuid2 = std::str::from_utf8(&bytes[4..40]).unwrap();
    let buf = &bytes[40..];

    let con = get_tcp(get_user(&uuid2).unwrap());
    if con.is_some() {
      let con = con.unwrap();
      let cipher = con.cipher;
      let mut stream = con.stream;

      let mut bytes = ("rcv ".to_string()+&uuid).as_bytes().to_vec();
      bytes.extend_from_slice(buf);

      let buf = encrypt(&cipher, &bytes);
      let len = buf.len() as i16;
      let mut bytes = len.to_be_bytes().to_vec();
      bytes.extend_from_slice(&buf);
      let _x = stream.write(&bytes).unwrap();
    }
    else {
      let s = "err fwd ".to_string() + &uuid2;
      let mut bytes = s.as_bytes().to_vec();
      let len = buf.len() as i16;
      bytes.extend_from_slice(&len.to_be_bytes());
      bytes.extend_from_slice(&buf);
      
      let buf = encrypt(&cipher, &bytes);
      let len = buf.len() as i16;
      let mut bytes = len.to_be_bytes().to_vec();
      bytes.extend_from_slice(&buf);
      let _x = stream.write(&bytes).unwrap();
    }
  }
  else if method == "err ".to_string() {
    let cmd = String::from_utf8(bytes[4..8].to_vec()).unwrap();
    if cmd == "fwd " {
      let uuid2 = String::from_utf8(bytes[8..44].to_vec()).unwrap();
      let uuid2 = uuid2.trim_matches(char::from(0));
      
      // FIXME - Ignored, don't send
      //let buf: [u8; 2] = bytes[44..46].try_into().unwrap();
      //let len2 = i16::from_be_bytes(buf) as usize; 
      let bytes = &bytes[46..];
      let buf: [u8; 2] = bytes[..2].try_into().unwrap();
      let len3 = i16::from_be_bytes(buf) as usize;
      let buf = &bytes[2..];
      let buf = &buf[..len3];

      let user = get_user(uuid2).unwrap();
      
      // FIXME - move cipher generation to its own function
      let system = DataStore::globals().get_object("system");
      let runtime = system.get_object("apps").get_object("app").get_object("runtime");
      let my_private = runtime.get_string("privatekey");
      let my_private = decode_hex(&my_private).unwrap();
      let my_private: [u8; 32] = my_private.try_into().expect("slice with incorrect length");
      let my_private = StaticSecret::from(my_private);

      let peer_public = user.get_string("publickey");
      let peer_public = decode_hex(&peer_public).unwrap();
      let peer_public: [u8; 32] = peer_public.try_into().expect("slice with incorrect length");
      let peer_public = PublicKey::from(peer_public);
      let shared_secret = my_private.diffie_hellman(&peer_public);
      let key = GenericArray::from(shared_secret.to_bytes());
      let cipher = Aes256::new(&key);
      
      let bytes = decrypt(&cipher, &buf);
      let s = String::from_utf8(bytes).unwrap();
      let s = s.trim_matches(char::from(0));
      let o = DataObject::from_string(&s[4..]);
      let pid = o.get_i64("pid");
      let pid = &pid.to_string();
      let mut con = relay(&uuid, &uuid2, true).unwrap();
      
      let mut err = DataObject::new();
      err.put_str("status", "err");
      err.put_str("msg", "No route to host");
      con.res.put_object(&pid, err);
      
//      println!("SUSPECT 2 {} -> {}", uuid,uuid2);
      relay(&uuid, &uuid2, false);
    }
  }
  else if method == "cmd ".to_string() {
    let msg = String::from_utf8(bytes[4..].to_vec()).unwrap();
    let msg = msg.trim_matches(char::from(0));
    let d = DataObject::from_string(msg);
    let mut params = d.get_object("params");
    params.put_str("nn_sessionid", &sessionid);
    params.put_object("nn_session", session.duplicate());

    let mut stream = stream.try_clone().unwrap();
    let cipher = cipher.to_owned();
    let sessionid = sessionid.to_owned();
    thread::spawn(move || {
      let o = handle_command(d, sessionid);

      let s = "res ".to_string() + &o.to_string();
      let buf = encrypt(&cipher, s.as_bytes());
      let len = buf.len() as i16;

      //        let _lock = P2PHEAP.get().write().unwrap();
      let mut bytes = len.to_be_bytes().to_vec();
      bytes.extend_from_slice(&buf);
      let _x = stream.write(&bytes).unwrap();
    });
  }
  else if method == "res ".to_string() {
    let msg = String::from_utf8(bytes[4..].to_vec()).unwrap();
    let msg = msg.trim_matches(char::from(0));
    let d = DataObject::from_string(msg);
    let i = d.get_i64("pid");
    res.put_object(&i.to_string(), d);
  }
  else {
    println!("Unknown message type: {}", method);
  }
  true
}

pub fn encrypt(cipher:&Aes256, buf:&[u8]) -> Vec<u8> {
  let mut buf = buf.to_vec();
  while buf.len() % 16 != 0 { buf.push(0); }
  let blocks: Vec<&[u8]> = buf.chunks(16).collect();
  let mut buf = Vec::new();
  for ba in blocks {
    let block: [u8; 16] = ba.try_into().expect("slice with incorrect length");
    let mut block = GenericArray::from(block);
    cipher.encrypt_block(&mut block);
    buf.extend_from_slice(&block[0..16]);
  }
  buf
}

pub fn decrypt(cipher:&Aes256, buf:&[u8]) -> Vec<u8> {
  let mut buf = buf.to_vec();
  while buf.len() % 16 != 0 { buf.push(0); }
  let blocks: Vec<&[u8]> = buf.chunks(16).collect();
  let mut buf = Vec::new();
  for ba in blocks {
    let block: [u8; 16] = ba.try_into().expect("slice with incorrect length");
    let mut block = GenericArray::from(block);
    cipher.decrypt_block(&mut block);
    buf.extend_from_slice(&block[0..16]);
  }
  buf
}

pub fn to_hex(ba:&[u8]) -> String {
  let mut s = "".to_string();
  for b in ba {
    s += &format!("{:02X?}", b);
  }
  s
}

pub fn decode_hex(s: &str) -> Result<Vec<u8>, ParseIntError> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16))
        .collect()
