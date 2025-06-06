  do_init(); 
  do_listen(ipaddr, port) 
}

static START: Once = Once::new();
static P2PCONS:Storage<RwLock<HashMap<i64, P2PConnection>>> = Storage::new();
static STREAMWRITERS:Storage<RwLock<HashMap<i64, i64>>> = Storage::new();
static STREAMREADERS:Storage<RwLock<HashMap<i64, DataBytes>>> = Storage::new();

static P2PCONLOCKS:Storage<RwLock<HashMap<String, AtomicBool>>> = Storage::new();

fn do_init(){
  START.call_once(|| { 
    P2PCONS.set(RwLock::new(HashMap::new())); 
    STREAMWRITERS.set(RwLock::new(HashMap::new())); 
    STREAMREADERS.set(RwLock::new(HashMap::new())); 
    
    P2PCONLOCKS.set(RwLock::new(HashMap::new())); 
  });
}

#[derive(Debug)]
pub struct RelayStream {
  from: String,
  to: String,
  buf: DataArray,
  data: DataObject,
}

impl RelayStream {
  pub fn new(from:String, to:String) -> RelayStream {
    let mut o = DataObject::new();
    o.put_int("last_contact", time());
    RelayStream{
      from:from,
      to:to,
      buf:DataArray::new(),
      data:o,
    }
  }
  
  pub fn duplicate(&self) -> RelayStream {
    RelayStream{
      from:self.from.to_owned(),
      to:self.to.to_owned(),
      buf:self.buf.clone(),
      data:self.data.clone(),
    }
  }
  
  pub fn last_contact(&self) -> i64 {
    self.data.get_int("last_contact")
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
  
  pub fn is_udp(&self) -> bool {
    match self {
      P2PStream::Tcp(_stream) => false,
      P2PStream::Relay(_stream) => false,
      P2PStream::Udp(_stream) => true,
    }
  }
  
  pub fn is_relay(&self) -> bool {
    match self {
      P2PStream::Tcp(_stream) => false,
      P2PStream::Relay(_stream) => true,
      P2PStream::Udp(_stream) => false,
    }
  }

  pub fn mode(&self) -> String {
    match self {
      P2PStream::Tcp(_stream) => {
        "TCP".to_string()
      },
      P2PStream::Relay(_stream) => {
        "RELAY".to_string()
      },
      P2PStream::Udp(_stream) => {
        "UDP".to_string()
      },
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
      P2PStream::Udp(stream) => {
        Ok(P2PStream::Udp(stream.duplicate()))
      },
    }
  }
  
  fn try_lock(&self, sid:String) -> bool {
    if &sid == "HANDSHAKE" { return false; }
    
    let lockheap = P2PCONLOCKS.get().write().unwrap();
    let lock = lockheap.get(&sid);
    if lock.is_some() {
      let lock = lock.unwrap();
      return lock.swap(true, Ordering::AcqRel)
    }
    return false;
  }
  
  fn release_lock(&self, sid:String) {
    if &sid != "HANDSHAKE" {
      let lockheap = P2PCONLOCKS.get().write().unwrap();
      let lock = lockheap.get(&sid);
      if lock.is_some() {
        let lock = lock.unwrap();
        lock.store(false, Ordering::Release);
      }
    }
  }
  
  pub fn write(&mut self, buf: &[u8], sid:String) -> io::Result<usize> {
    let mut timeout = 0;
    while self.try_lock(sid.clone()) {
      // TIGHTLOOP
      //spin_loop();
      timeout += 1;
      let beat = Duration::from_millis(timeout);
      thread::sleep(beat);
      if timeout > 450 { 
        let form = format!("Unusually long wait writing to stream, aborting [{}]", &sid);
        println!("{}", form); 
        return Err(io::Error::new(io::ErrorKind::BrokenPipe, form));
      }
    }

    let q = match self {
      P2PStream::Tcp(stream) => {
        stream.write(buf)
      },
      P2PStream::Relay(stream) => {
        let from = &stream.from.clone();
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
            let x = stream.write(&bytes, con.sessionid)?;
		    self.release_lock(sid.clone());
            return Ok(x);
          }
		  self.release_lock(sid.clone());
          panic!("No route to relay {}", from);
        }
    	self.release_lock(sid.clone());
        panic!("No such relay {}", from);
      },
      P2PStream::Udp(stream) => {
        stream.write(buf)
      },
    };
    
    self.release_lock(sid.clone());
    
    q
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
          let mut timeout = 0;
          while stream.buf.len() == 0 {
            // TIGHTLOOP
            timeout += 1;
            let beat = Duration::from_millis(timeout);
            thread::sleep(beat);
            if timeout > 450 { println!("Unusually long wait in peer:service:listen:p2p_stream:relay:read_exact [{}]", stream.data.get_int("id")); timeout = 0; }
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
      P2PStream::Udp(stream) => {
        stream.read_exact(buf)
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
      P2PStream::Udp(stream) => {
        Ok(stream.src)
      },
    }
  }
  
  pub fn describe(&self) -> String {
    match self {
      P2PStream::Tcp(stream) => {
        let x = stream.peer_addr();
        if x.is_err() { return "CLOSED".to_string(); }
        x.unwrap().to_string()
      },
      P2PStream::Relay(stream) => {
        format!("via {} to {}", stream.from, stream.to)
      },
      P2PStream::Udp(stream) => {
        stream.src.to_string()
      },
    }
  }
  
  pub fn shutdown(&self) -> io::Result<()> {
    match self {
      P2PStream::Tcp(stream) => {
        stream.shutdown(Shutdown::Both)
      },
      P2PStream::Relay(_stream) => {
        Ok(())
      },
      P2PStream::Udp(stream) => {
        stream.duplicate().data.put_boolean("dead", true);
        Ok(())
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
  
  pub fn last_contact(&self) -> i64 {
    match self {
      P2PStream::Tcp(_stream) => { 
        // FIXME
        time()
      },
      P2PStream::Relay(stream) => {
        stream.last_contact()
      },
      P2PStream::Udp(stream) => {
        stream.last_contact()
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
  pub pending: DataArray,
}

impl P2PConnection {
  pub fn get(conid:i64) -> P2PConnection {
    do_init();
    P2PCONS.get().write().unwrap().get(&conid).unwrap().duplicate()
  }
  
  pub fn try_get(conid:i64) -> Option<P2PConnection> {
    do_init();
    let x = P2PCONS.get().write().unwrap().get(&conid)?.duplicate();
    Some(x)
  }
  
  pub fn list() -> Vec<i64> {
    do_init();
    let mut v = Vec::new();
    for i in P2PCONS.get().write().unwrap().keys() {
      v.push(*i);
    }
    v
  }
  
  pub fn duplicate(&self) -> P2PConnection {
    P2PConnection{
      stream: self.stream.try_clone().unwrap(),
      sessionid: self.sessionid.to_owned(),
      cipher: self.cipher.to_owned(),
      uuid: self.uuid.to_owned(),
      res: self.res.clone(),
      pending: self.pending.clone(),
    }
  }
    
  pub fn begin(uuid:String, stream:P2PStream) -> (i64, P2PConnection) {
    let user = get_user(&uuid).unwrap();
    let mut cons = user.get_array("connections");
    
    // FIXME - move cipher generation to its own function
    let system = DataStore::globals().get_object("system");
    let runtime = system.get_object("apps").get_object("app").get_object("runtime");
    
    let my_private_hex = runtime.get_string("privatekey");
    let my_private = decode_hex(&my_private_hex).unwrap();
    let my_private: [u8; 32] = my_private.try_into().expect("slice with incorrect length");

    let peer_public_hex = user.get_string("publickey");
    let peer_public = decode_hex(&peer_public_hex).unwrap();
    let peer_public: [u8; 32] = peer_public.try_into().expect("slice with incorrect length");

    let shared_secret = x25519(my_private, peer_public);

    let key = GenericArray::from(shared_secret);
    let cipher = Aes256::new(&key);
    
    
/*    
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
*/
    
    let sessionid = unique_session_id();
    let con = P2PConnection{
      stream: stream,
      sessionid: sessionid.to_owned(),
      cipher: cipher,
      uuid: uuid.to_string(),
      res: DataObject::new(),
      pending: DataArray::new(),
    };
    
    let sessiontimeoutmillis = system.get_object("config").get_int("sessiontimeoutmillis");

    // FIXME - Make session creation its own thing
    let mut session = DataObject::new();
    session.put_int("count", 0);
    session.put_string("id", &sessionid);
    session.put_string("username", &uuid);
    session.put_object("user", user.clone());
    let expire = time() + sessiontimeoutmillis;
    session.put_int("expire", expire);

    let mut sessions = system.get_object("sessions");
    sessions.put_object(&sessionid, session.clone());
    
    let conid;
    {
      let mut heap = P2PCONS.get().write().unwrap();
      let mut lockheap = P2PCONLOCKS.get().write().unwrap();
      loop {
        let x = rand_i64();
        if !heap.contains_key(&x) {
          conid = x;
          heap.insert(conid, con.duplicate());
          lockheap.insert(con.sessionid.clone(), AtomicBool::new(false));
          cons.push_int(conid);
          break;
        }
      }
    }
    
    fire_event("peer", "UPDATE", user_to_peer(user.clone(), uuid.to_string()));
    fire_event("peer", "CONNECT", user_to_peer(user.clone(), uuid.to_string()));
    println!("P2P {} Connect {} / {} / {} / {}", con.stream.mode(), con.stream.describe(), sessionid, user.get_string("displayname"), uuid);

    (conid, con)
  }
  
  pub fn shutdown(&self, uuid:&str, conid:i64) -> io::Result<()> {
    let user = get_user(uuid);
    let mut uname = "??".to_string();
    if user.is_some(){
      let user = user.unwrap();
      user.get_array("connections").remove_data(Data::DInt(conid));
      fire_event("peer", "UPDATE", user_to_peer(user.clone(), uuid.to_string()));
      fire_event("peer", "DISCONNECT", user_to_peer(user.clone(), uuid.to_string()));
      uname = user.get_string("displayname");
    }
    
    let mut con;
    {
      let mut heap = P2PCONS.get().write().unwrap();
      let mut lockheap = P2PCONLOCKS.get().write().unwrap();
      let x = heap.get(&conid);
      if x.is_none() { return Ok(()); }
      con = x.unwrap().duplicate();
      heap.remove(&conid);
      let sid = con.sessionid.clone();
      lockheap.remove(&sid);
    }
    let x = self.stream.shutdown();
    
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Connection closed");
    for pid in con.pending.objects() {
      let pid = pid.int();
      con.res.put_object(&pid.to_string(), o.clone());
    }
    
    if self.stream.is_tcp(){
      let users = DataStore::globals().get_object("system").get_object("users");
      for (uuid2,_u) in users.objects() {
        if uuid2.len() == 36 && uuid != uuid2 {
          relay(&uuid, &uuid2, false);
        }
      }
    }
    
    let mut sessions = DataStore::globals().get_object("system").get_object("sessions");
    sessions.remove_property(&con.sessionid);
    
    println!("P2P {} Disconnect {} / {} / {} / {}", con.stream.mode(), con.stream.describe(), self.sessionid, uname, uuid);
    x
  }
  
  pub fn last_contact(&self) -> i64 {
    self.stream.last_contact()
  }
  
  pub fn begin_stream(&mut self) -> i64 {
    let mut heap = STREAMWRITERS.get().write().unwrap();
    let x:i64;
    loop {
      let y = rand_i64();
      if y != -1 && !heap.contains_key(&y) {
        x = y;
        break;
      }
    }
    heap.insert(x, -1);
    x
  }

  pub fn join_stream(&mut self, x: i64) -> DataBytes {
    let db = DataBytes::new();
    let mut heap = STREAMREADERS.get().write().unwrap();
    let y:i64;
    loop {
      let z = rand_i64();
      if z != -1 && !heap.contains_key(&z) {
        y = z;
        break;
      }
    }
    heap.insert(y, db.clone());
    
    let mut bytes = "s_1 ".as_bytes().to_vec();
    bytes.extend_from_slice(&x.to_be_bytes());
    bytes.extend_from_slice(&y.to_be_bytes());
    let buf = encrypt(&self.cipher, &bytes);
    let len = buf.len() as i16;
    let mut bytes = len.to_be_bytes().to_vec();
    bytes.extend_from_slice(&buf);
    let _x = self.stream.write(&bytes, self.sessionid.clone()); //.unwrap();
    
    db
  }
  
  pub fn write_stream(&mut self, x:i64, data:&Vec<u8>) -> bool{
    // ask for it in 30 seconds or it's gone forever
    let y;
    let mut timeout = 0;
    loop {
      {
        let heap = STREAMWRITERS.get().write();
        if heap.is_ok() {
          let heap = heap.unwrap();
          let z = heap.get(&x);
          if z.is_some() {
            let z = z.unwrap().to_owned();
            if z != -1 { y = z; break; }
          }
        }
      }
      
      timeout += 1;
      if timeout > 500 { println!("No request for stream data... discarding stream."); return false; }
      let beat = Duration::from_millis(timeout);
      thread::sleep(beat);
    }
    let mut bytes = "s_2 ".as_bytes().to_vec();
    bytes.extend_from_slice(&y.to_be_bytes());
    let len = data.len() as i16;
    bytes.extend_from_slice(&len.to_be_bytes());
    bytes.extend_from_slice(data);
    
    let buf = encrypt(&self.cipher, &bytes);
    let len = buf.len() as i16;
    let mut bytes = len.to_be_bytes().to_vec();
    bytes.extend_from_slice(&buf);

    // Seems to fix stream corruption issue on other side of connection
    // FIXME - Does it, tho?
    let _heap = STREAMWRITERS.get().write(); //.unwrap();
    
    let x = self.stream.write(&bytes, self.sessionid.clone());
    x.is_ok()
  }
  
  pub fn end_stream_write(&mut self, x:i64) {
    let y;
    {
      let mut heap = STREAMWRITERS.get().write().unwrap();
      y = heap.get(&x).unwrap().to_owned();
      heap.remove(&x);
    }
    let mut bytes = "s_3 ".as_bytes().to_vec();
    bytes.extend_from_slice(&y.to_be_bytes());
    let buf = encrypt(&self.cipher, &bytes);
    let len = buf.len() as i16;
    let mut bytes = len.to_be_bytes().to_vec();
    bytes.extend_from_slice(&buf);
    let _x = self.stream.write(&bytes, self.sessionid.clone()); //.unwrap();
  }

  pub fn end_stream_read(&mut self, y:i64) {
//    let x; {
      let mut heap = STREAMREADERS.get().write().unwrap();
//      x = heap.get(&y).unwrap().to_owned();
      heap.remove(&y);
//    }
    // FIXME - Stop send
/*
    let mut bytes = "s_4 ".as_bytes().to_vec();
    bytes.extend_from_slice(&x.to_be_bytes());
    let buf = encrypt(&self.cipher, &bytes);
    let len = buf.len() as i16;
    let mut bytes = len.to_be_bytes().to_vec();
    bytes.extend_from_slice(&buf);
    let _x = self.stream.write(&bytes).unwrap();
*/    
  }
}

pub fn get_best(user:DataObject) -> Option<P2PConnection> {
  do_init();
  let mut best = None;
  let heap = P2PCONS.get().write().unwrap();
  let cons = user.get_array("connections");
//  println!("heap {:?} cons {}", heap, cons.to_string());
  for con in cons.objects(){
    let conid = con.int();
    let con = heap.get(&conid).unwrap();
    if con.stream.is_tcp() {
      return Some(con.duplicate());
    }
    else if (&best).is_none() { best = Some(con.duplicate()); }
    else if (&best).as_ref().unwrap().stream.is_relay() && con.stream.is_udp() { best = Some(con.duplicate()); }
  }
  best
}

pub fn get_tcp(user:DataObject) -> Option<P2PConnection> {
  do_init();
  let heap = P2PCONS.get().write().unwrap();
  let cons = user.get_array("connections");
//  println!("heap {:?} cons {}", heap, cons.to_string());
  for con in cons.objects(){
    let conid = con.int();
    let con = heap.get(&conid);
    if con.is_some(){
      let con = con.unwrap();
      if con.stream.is_tcp() {
        return Some(con.duplicate());
      }
    }
  }
  None
}

pub fn get_udp(user:DataObject) -> Option<P2PConnection> {
  do_init();
  let heap = P2PCONS.get().write().unwrap();
  let cons = user.get_array("connections");
//  println!("heap {:?} cons {}", heap, cons.to_string());
  for con in cons.objects(){
    let conid = con.int();
    let con = heap.get(&conid);
    if con.is_some() {
      let con = con.unwrap();
      if con.stream.is_udp() {
        return Some(con.duplicate());
      }
    }
  }
  None
}

pub fn get_relay(user:DataObject) -> Option<P2PConnection> {
  do_init();
  let heap = P2PCONS.get().write().unwrap();
  let cons = user.get_array("connections");
//  println!("heap {:?} cons {}", heap, cons.to_string());
  for con in cons.objects(){
    let conid = con.int();
    let con = heap.get(&conid);
    if con.is_some(){
      let con = con.unwrap();
      if con.stream.is_relay() {
        return Some(con.duplicate());
      }
    }
  }
  None
}

pub fn relay(from:&str, to:&str, connected:bool) -> Option<P2PConnection>{
  let user = get_user(to).unwrap();
  let cons = user.get_array("connections");
  for con in cons.objects(){
    let conid = con.int();
    let con = P2PConnection::get(conid);
    if let P2PStream::Relay(stream) = &con.stream {
      if stream.from == from && stream.to == to {
        if connected { return Some(con.duplicate()); }
        let _x = con.shutdown(to, conid as i64);
      }
    }
  }
  if connected {
    let stream = RelayStream::new(from.to_string(), to.to_string());
    let stream = P2PStream::Relay(stream);
    let (_conid, con) = P2PConnection::begin(to.to_string(), stream);
    return Some(con.duplicate());
  }
  None
}

pub fn handshake(stream: &mut P2PStream, peer: Option<String>) -> Option<(i64, P2PConnection)> {
  let system = DataStore::globals().get_object("system");
  let runtime = system.get_object("apps").get_object("app").get_object("runtime");
  let my_uuid = runtime.get_string("uuid");

  // FIXME - move cipher generation to its own function
  let my_public = runtime.get_string("publickey");
//  let my_private = runtime.get_string("privatekey");
//  let my_private = decode_hex(&my_private).unwrap();
//  let my_private: [u8; 32] = my_private.try_into().expect("slice with incorrect length");
//  let my_private = StaticSecret::from(my_private);
    let my_private_hex = runtime.get_string("privatekey");
    let my_private = decode_hex(&my_private_hex).unwrap();
    let my_private: [u8; 32] = my_private.try_into().expect("slice with incorrect length");

  // Temp key pair for initial exchange
  //let my_session_private = StaticSecret::new(OsRng);
  //let my_session_public = PublicKey::from(&my_session_private);
  let (my_session_private, my_session_public) = generate_x25519_keypair();

  // Send temp pubkey if init
  let init = peer.is_some();
  if init { let _x = stream.write(&my_session_public, "HANDSHAKE".to_string()).unwrap(); }

  // Read remote temp pubkey
  let mut bytes = vec![0u8; 32];
  let _x = stream.read_exact(&mut bytes);
  if _x.is_err() { return None;}
  //let _x = x.unwrap();
  let remote_session_public: [u8; 32] = bytes.try_into().expect("slice with incorrect length");
  //let remote_session_public = PublicKey::from(remote_session_public);

  // Send temp pubkey if not init
  if !init { let _x = stream.write(&my_session_public, "HANDSHAKE".to_string()).unwrap(); }
  
  // Temp cipher for initial exchange
  //let shared_secret = my_session_private.diffie_hellman(&remote_session_public);
  //let key = GenericArray::from(shared_secret.to_bytes());
  //let cipher = Aes256::new(&key);
  let shared_secret = x25519(my_session_private, remote_session_public);
  let key = GenericArray::from(shared_secret);
  let cipher = Aes256::new(&key);

  // Send my UUID
  let bytes = encrypt(&cipher, my_uuid.as_bytes());
  let _x = stream.write(&bytes, "HANDSHAKE".to_string()).unwrap();

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
    let _x = stream.write(&[my_step], "HANDSHAKE".to_string()).unwrap();

    //read remote_step
    let mut bytes = vec![0u8; 1];
    let x = stream.read_exact(&mut bytes);
    if x.is_err() { return None; }
    
    let remote_step = bytes[0];

    // Remote step
    if remote_step == 0 {
      let bytes = encrypt(&cipher, &decode_hex(&my_public).unwrap());
      let _x = stream.write(&bytes, "HANDSHAKE".to_string()).unwrap();
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
    //let peer_public = PublicKey::from(peer_public);
    //let shared_secret = my_private.diffie_hellman(&peer_public);
    //let key = GenericArray::from(shared_secret.to_bytes());
    //let cipher = Aes256::new(&key);

    let shared_secret = x25519(my_private, peer_public);
    let key = GenericArray::from(shared_secret);
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
        let _x = stream.write(&buf, "HANDSHAKE".to_string()).unwrap();
        isok = true;
      }
    }
    else {
      let buf = encrypt(&cipher, "What's good, yo?".as_bytes());
      let _x = stream.write(&buf, "HANDSHAKE".to_string()).unwrap();

      let mut bytes = vec![0u8; 16];
      let _x = stream.read_exact(&mut bytes).unwrap();
      let mut bytes = decrypt(&cipher, &bytes);
      bytes.resize(16, 0);
      let sig = String::from_utf8(bytes).unwrap();

      isok = sig == "All is good now!" 
    }
    
    if isok {
      user.put_string("publickey", &peer_public_string);
      let (conid, con) = P2PConnection::begin(uuid.to_owned(), stream.try_clone().unwrap());
  
      if saveme {
        set_user(&uuid, user.clone());
      }
      
      return Some((conid, con));
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
  botd.put_int("port", port as i64);
  
  if b {
    let file = DataStore::new().root
                .parent().unwrap()
                .join("runtime")
                .join("peer")
                .join("botd.properties");
  	let _x = write_properties(file.into_os_string().into_string().unwrap(), botd);
  }

  println!("P2P TCP listening on port {}", port);

  thread::spawn(move || {
    // FIXME - Interrupt and quit if !system.running
    for stream in listener.incoming() {
      let stream = stream.unwrap();
      thread::spawn(move || {
        let remote_addr = stream.peer_addr().unwrap();
        let mut d = DataObject::new();
        d.put_string("addr", &remote_addr.to_string());
        fire_event("peer", "TCP_REQUEST_RECEIVED", d);
        //println!("P2P TCP incoming request from {}", remote_addr);

        let mut stream = P2PStream::Tcp(stream);

        let con = handshake(&mut stream, None);
        if con.is_some() {
          let (conid, con) = con.unwrap();
          handle_connection(conid, con);
        }
      });
    }
  });
  port.into()
}

pub fn handle_connection(conid:i64, con:P2PConnection) {
  // loop
  let system = DataStore::globals().get_object("system");
  while system.get_boolean("running") {
    if !handle_next_message(con.duplicate()) { break; }
  }
  // end loop
  
  let _x = con.shutdown(&con.uuid, conid);
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
  //println!("{}",len);
  
  // FIXME - Where does 16400 come from? Who is reading or writing data out of turn to cause this?
  if len > 16400 { 
    println!("Connection corrupted (1): {:?}", stream);
    return false; 
  }
  
  let mut bytes:Vec<u8> = Vec::with_capacity(len);
  bytes.resize(len, 0);
  let x = stream.read_exact(&mut bytes);
  if x.is_err(){
    println!("Connection dropped (1.5): {:?}", stream);
    return false; 
  }
  let bytes = decrypt(&cipher, &bytes);
  let method = String::from_utf8(bytes[0..4].to_vec());
  
  // FIXME - Most likely extension of [len > 16400] problem, where len happens to be less than 16400
  if method.is_err() { 
    println!("Connection corrupted (2): {:?}", stream);
    return false; 
  }
  
  let method = method.unwrap();

  let sessiontimeoutmillis = system.get_object("config").get_int("sessiontimeoutmillis");
  session.put_int("expire", time() + sessiontimeoutmillis);
  let count = session.get_int("count") + 1;
  session.put_int("count", count);

  if method == "s_1 " {
    let buf: [u8; 8] = bytes[4..12].try_into().unwrap();
    let x = i64::from_be_bytes(buf);
    let buf: [u8; 8] = bytes[12..20].try_into().unwrap();
    let y = i64::from_be_bytes(buf);
    
    let mut heap = STREAMWRITERS.get().write().unwrap();
    heap.insert(x, y);
  }
  else if method == "s_2 " {
    let buf: [u8; 8] = bytes[4..12].try_into().unwrap();
    let y = i64::from_be_bytes(buf);
    let buf: [u8; 2] = bytes[12..14].try_into().unwrap();
    let n = (14 + i16::from_be_bytes(buf)) as usize;
    let bytes = &bytes[14..n];
    
    let heap = STREAMREADERS.get().write().unwrap();
    let db = heap.get(&y);
    if db.is_some() {
      let db = db.unwrap();
      if db.is_write_open() {
        db.write(bytes);
      }
    }
  }
  else if method == "s_3 " {
    let buf: [u8; 8] = bytes[4..12].try_into().unwrap();
    let y = i64::from_be_bytes(buf);
    let heap = STREAMREADERS.get().write().unwrap();
    let db = heap.get(&y);
    if db.is_some(){
      let db = db.unwrap();
      db.close_write();
    }
  }
  else if method == "rcv " {
    let uuid2 = std::str::from_utf8(&bytes[4..40]).unwrap();
    let buf = &bytes[40..];
    let bytes: [u8; 2] = buf[0..2].try_into().unwrap();
    let len2 = i16::from_be_bytes(bytes) as usize;
    let mut buf = buf.to_vec();
    buf.resize(len2+2,0);
    
    let con = relay(&uuid, &uuid2, true).unwrap();  
	if let P2PStream::Relay(mut stream) = con.stream.try_clone().unwrap() {
      stream.buf.push_bytes(DataBytes::from_bytes(&buf.to_vec()));
      stream.data.put_int("last_contact", time());
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
      let _x = stream.write(&bytes, con.sessionid).unwrap();
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
      let _x = stream.write(&bytes, sessionid).unwrap();
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
      //let my_private = StaticSecret::from(my_private);

      let peer_public = user.get_string("publickey");
      let peer_public = decode_hex(&peer_public).unwrap();
      let peer_public: [u8; 32] = peer_public.try_into().expect("slice with incorrect length");
      //let peer_public = PublicKey::from(peer_public);
      //let shared_secret = my_private.diffie_hellman(&peer_public);
      //let key = GenericArray::from(shared_secret.to_bytes());
      //let cipher = Aes256::new(&key);

      let shared_secret = x25519(my_private, peer_public);
      let key = GenericArray::from(shared_secret);
      let cipher = Aes256::new(&key);
      
      let bytes = decrypt(&cipher, &buf);
      let s = String::from_utf8(bytes).unwrap();
      let s = s.trim_matches(char::from(0));
      let o = DataObject::from_string(&s[4..]);
      let pid = o.get_int("pid");
      let pid = &pid.to_string();
      let mut con = relay(&uuid, &uuid2, true).unwrap();
      
      let mut err = DataObject::new();
      err.put_string("status", "err");
      err.put_string("msg", "No route to host");
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
    params.put_string("nn_sessionid", &sessionid);
    params.put_object("nn_session", session.clone());

    let mut stream = stream.try_clone().unwrap();
    let cipher = cipher.to_owned();
    let sessionid = sessionid.to_owned();
    thread::spawn(move || {
      let mut o = handle_command(d, sessionid.clone());
      
      if o.has("nn_return_type") && o.get_string("nn_return_type") == "File" {
        // FIXME - combine with peer:peer:local
        let path = o.get_string("data");
        if Path::new(&path).exists() {
          let user = get_user(&uuid).unwrap();
          let mut con = get_best(user).unwrap();
          // FIXME - set remote stream len
          // let len = fs::metadata(&path).unwrap().len() as i64;
          let stream_id = con.begin_stream();

          thread::spawn(move || {
            let mut file = fs::File::open(&path).unwrap();
            let chunk_size = 0x4000;
            loop {
              let mut chunk = Vec::with_capacity(chunk_size);
              let n = std::io::Read::by_ref(&mut file).take(chunk_size as u64).read_to_end(&mut chunk).unwrap();
              if n == 0 { break; }
              let x = con.write_stream(stream_id, &chunk);
              if !x { break; }
              if n < chunk_size { break; }
            }
            con.end_stream_write(stream_id);
          });

          o.put_int("stream_id", stream_id);
        }
      }

      let s = "res ".to_string() + &o.to_string();
      let buf = encrypt(&cipher, s.as_bytes());
      let len = buf.len() as i16;

      //        let _lock = P2PHEAP.get().write().unwrap();
      let mut bytes = len.to_be_bytes().to_vec();
      bytes.extend_from_slice(&buf);
      let _x = stream.write(&bytes, sessionid);
    });
  }
  else if method == "res ".to_string() {
    let msg = String::from_utf8(bytes[4..].to_vec()).unwrap();
    let msg = msg.trim_matches(char::from(0));
    let d = DataObject::from_string(msg);
    let i = d.get_int("pid");
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
