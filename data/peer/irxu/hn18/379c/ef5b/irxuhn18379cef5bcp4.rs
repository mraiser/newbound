  START.call_once(|| { P2PHEAP.set(RwLock::new(Heap::new())); });
  do_listen(ipaddr, port)
}

#[derive(Debug)]
pub struct P2PConnection {
  pub stream: TcpStream,
  pub sessionid: String,
  pub cipher: Aes256,
  pub uuid: String,
  pub res: DataObject,
}

static START: Once = Once::new();
pub static P2PHEAP:Storage<RwLock<Heap<P2PConnection>>> = Storage::new();

pub fn handshake(stream: &mut TcpStream, peer: Option<String>) -> Option<P2PConnection> {
  let system = DataStore::globals().get_object("system");
  let runtime = system.get_object("apps").get_object("app").get_object("runtime");
  let my_uuid = runtime.get_string("uuid");

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

fn do_listen(ipaddr:String, port:i64) -> String {
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

  for stream in listener.incoming() {
    let mut stream = stream.unwrap();
    thread::spawn(move || {
      let remote_addr = stream.peer_addr().unwrap();
      println!("P2P TCP incoming request from {}", remote_addr);
      
      let con = handshake(&mut stream, None);
      if con.is_some() {
        handle_connection(con.unwrap());
      }
    });
  }
  "OK".to_string()
}

pub fn handle_connection(con:P2PConnection) {
  let uuid = con.uuid.to_owned();
  let user = get_user(&uuid).unwrap();
  let sessionid = con.sessionid.to_owned();
  let cipher = con.cipher.to_owned();
  let mut stream = con.stream.try_clone().unwrap();
  let mut res = con.res.duplicate();

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

  let data_ref = P2PHEAP.get().write().unwrap().push(con);
  let mut connections = user.get_array("connections");
  connections.push_i64(data_ref as i64);

  let remote_addr = stream.peer_addr().unwrap();
  println!("P2P TCP Connect {} / {} / {} / {}", remote_addr, sessionid, user.get_string("displayname"), uuid);
  let peer = user_to_peer(user.duplicate(), uuid.to_owned());
  fire_event("peer", "CONNECT", peer.duplicate());
  fire_event("peer", "UPDATE", peer.duplicate());
  
  // loop
  while system.get_bool("running") {
    let mut bytes = vec![0u8; 2];
    let x = stream.read_exact(&mut bytes);
    if x.is_err() { 
      break; 
    }

    let bytes: [u8; 2] = bytes.try_into().unwrap();
    let len = i16::from_be_bytes(bytes) as usize;
    let mut bytes:Vec<u8> = Vec::with_capacity(len);
    bytes.resize(len, 0);
    let _x = stream.read_exact(&mut bytes).unwrap();
    let bytes = decrypt(&cipher, &bytes);
    let msg = String::from_utf8(bytes).unwrap();
    let msg = msg.trim_matches(char::from(0));

    session.put_i64("expire", time() + sessiontimeoutmillis);
    let count = session.get_i64("count") + 1;
    session.put_i64("count", count);

    if msg.starts_with("cmd ") {
      let msg = &msg[4..];
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
        
        let _lock = P2PHEAP.get().write().unwrap();
        let _x = stream.write(&len.to_be_bytes()).unwrap();
        let _x = stream.write(&buf).unwrap();
      });
    }
    else if msg.starts_with("res ") {
      let msg = &msg[4..];
      let d = DataObject::from_string(msg);
      let i = d.get_i64("pid");
      res.put_object(&i.to_string(), d);
    }
    else {
      println!("Unknown message type: {}", msg);
    }
  }
  // end loop

  sessions.remove_property(&sessionid);
  let _x = connections.remove_data(Data::DInt(data_ref as i64));
  P2PHEAP.get().write().unwrap().decr(data_ref);

  println!("P2P TCP Disconnect {} / {} / {} / {}", remote_addr, sessionid, user.get_string("displayname"), uuid);
  let peer = user_to_peer(user.duplicate(), uuid.to_owned());
  fire_event("peer", "DISCONNECT", peer.duplicate());
  fire_event("peer", "UPDATE", peer.duplicate());
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