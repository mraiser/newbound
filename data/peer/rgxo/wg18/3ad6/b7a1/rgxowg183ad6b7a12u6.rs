  let socket_address = ipaddr+":"+&port.to_string();
  START.call_once(|| { 
    UDPCON.set(RwLock::new(UdpSocket::bind(socket_address).unwrap())); 
    READMUTEX.set(RwLock::new(true)); 
    WRITEMUTEX.set(RwLock::new(true)); 
    println!("P2P UDP listening on port {}", port);
  });
  do_listen();
  port
}

static START: Once = Once::new();
pub static UDPCON:Storage<RwLock<UdpSocket>> = Storage::new();
static READMUTEX:Storage<RwLock<bool>> = Storage::new();
static WRITEMUTEX:Storage<RwLock<bool>> = Storage::new();

const HELO:u8 = 0;
const WELCOME:u8 = 1;
const YO:u8 = 2;
const SUP:u8 = 3;
const RDY:u8 = 4;
const CMD:u8 = 5;
const ACK:u8 = 6;
const RESEND:u8 = 7;
const EXTEND_MTU:u8 = 8;

const MAXPACKETCOUNT:u16 = 1000;
const MAXPACKETSIZE:usize = 65024;
const PACKETHEADERSIZE:u16 = 17;
const MTU_SIZES:[u16; 7] = [1016,2032,4064,8128,16256,32512,65024];

#[derive(Debug)]
pub struct UdpStream {
  pub src: SocketAddr,
  pub data: DataObject,
}

impl UdpStream {
  pub fn new(src:SocketAddr, remote_id:i64) -> Self {
    let mut a = DataObject::new();
    a.put_int("id", remote_id);
    a.put_int("in_off", 0);
    a.put_int("out_off", 0);
    a.put_int("next", 0);
    a.put_array("in", DataArray::new());
    a.put_array("out", DataArray::new());
    a.put_boolean("dead", false);
    a.put_int("last_contact", time());
    a.put_int("mtu", 508);
    UdpStream{
      src: src,
      data: a,
    }
  }
  
  pub fn blank(src:SocketAddr) -> Self {
    UdpStream::new(src, -1)
  }
  
  pub fn duplicate(&self) -> UdpStream {
    UdpStream{
      src: self.src.to_owned(),
      data: self.data.clone(),
    }
  }

  pub fn set_id(&mut self, id:i64) {
    // There can be only one!
    let _lock = WRITEMUTEX.get().write().unwrap();
    
    self.data.put_int("id", id);

    if self.data.has("hold") { 
      let hold = self.data.get_array("hold");
      for bytes in hold.objects(){
        let bytes = bytes.bytes();
        let _x = self.write(&bytes.get_data()).unwrap();
      }
      self.data.remove_property("hold");
    }
  }
  
  pub fn write(&mut self, buf: &[u8]) -> io::Result<usize>
  {
    if self.data.get_boolean("dead") { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }
    
    // There can be only one!
    let _lock = WRITEMUTEX.get().write().unwrap();
    
    let id = self.data.get_int("id");
    if id == -1 {
      if !self.data.has("hold") { self.data.put_array("hold", DataArray::new()); }
      let mut hold = self.data.get_array("hold");
      let bytes = DataBytes::from_bytes(&buf.to_vec());
      hold.push_bytes(bytes);
    }
    else {
      let heap = UDPCON.get().write().unwrap();
      let sock = heap.try_clone().unwrap();

      let mut out = self.data.get_array("out");
      let mut msgid = self.data.get_int("next");
      let mtu = self.data.get_int("mtu");
      
      // FIXME - Support payloads up to 67K?
      let blocks: Vec<&[u8]> = buf.chunks((mtu as usize)-(PACKETHEADERSIZE as usize)).collect();
      for buf in blocks {
        let mut bytes = Vec::new();
        bytes.push(CMD);
        bytes.extend_from_slice(&id.to_be_bytes());
        bytes.extend_from_slice(&msgid.to_be_bytes());
        bytes.extend_from_slice(buf);
        let db = DataBytes::from_bytes(&bytes);
        out.push_bytes(db);
        sock.send_to(&bytes, self.src).unwrap();
        msgid += 1;
      }
      
      self.data.put_int("next", msgid);
    }
    Ok(buf.len())
  }
  
  pub fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
    if self.data.get_boolean("dead") { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }
    
    let mut inv = self.data.get_array("in");
    
    let len = buf.len();
    let mut i = 0;
    let mut v = Vec::new();
    
    let mut in_off;
    {
      // There can be only one!
      // FIXME - Is this really necessary?
      let _lock = READMUTEX.get().write().unwrap();
      in_off = self.data.get_int("in_off");
    }
    //println!("start read {}", in_off);
    
    while i < len {
      // FIXME - should timeout?
      let mut timeout = 0;
      while inv.len() == 0 {
        if self.data.get_boolean("dead") { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }
        
        // TIGHTLOOP
        timeout += 1;
        let beat = Duration::from_millis(timeout);
        thread::sleep(beat);
        if timeout > 450 { println!("Unusually long wait in peer:service:listen_udp:read_exact 1 [{}]", self.data.get_int("id")); timeout = 0; }
      }

      let mut timeout = 0;
      while inv.get_property(0).is_null() {
        if self.data.get_boolean("dead") { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }
        self.request_resend(in_off);
        
        // TIGHTLOOP
        timeout += 1;
        let beat = Duration::from_millis(timeout);
        thread::sleep(beat);
        if timeout > 450 { println!("Unusually long wait in peer:service:listen_udp:read_exact 2 [{}]", self.data.get_int("id")); timeout = 0; }
      }
      
      //println!("have data {}", in_off);

      let bd = inv.get_bytes(0);
      let bytes = bd.get_data();
      let n = std::cmp::min(bytes.len(), len-i);
      v.extend_from_slice(&bytes[0..n]);
      let bytes = bytes[n..].to_vec();
      
      // There can be only one!
      let _lock = READMUTEX.get().write().unwrap();
      
      if bytes.len() > 0 { bd.set_data(&bytes); }
      else { 
        in_off += 1;
        inv.remove_property(0); 
      }
      self.data.put_int("in_off", in_off);

      i += n;
    }        
    buf.clone_from_slice(&v);
    //println!("read exact done {}", in_off);
    Ok(())
  }
  
  fn request_resend(&self, msgid:i64) {
    if self.data.get_boolean("dead") { return; }
    
    let inv = self.data.get_array("in");
    let inlen = inv.len();
    let mut last = msgid;
    let mut x = 1;
    while x < inlen {
      if !inv.get_property(x).is_null() { break; }
      last += 1;
      x += 1;
    }
    
    let id = self.data.get_int("id");
    println!("request resend of {} to {} from {}", msgid, last, id);
    let mut bytes = Vec::new();
    bytes.push(RESEND);
    bytes.extend_from_slice(&id.to_be_bytes());
    bytes.extend_from_slice(&msgid.to_be_bytes());
    bytes.extend_from_slice(&last.to_be_bytes());
    let heap = UDPCON.get().write().unwrap();
    let sock = heap.try_clone().unwrap();
    sock.send_to(&bytes, self.src).unwrap();
  }
  
  pub fn last_contact(&self) -> i64 {
    self.data.get_int("last_contact")
  }
  
  pub fn upgrade_mtu(&self) {
    let id = self.data.get_int("id");
    let beat = Duration::from_millis(1000);
    for size in MTU_SIZES {
      let mut bytes = Vec::new();
      bytes.push(EXTEND_MTU);
      bytes.extend_from_slice(&id.to_be_bytes());
      
      let mut vec = Vec::new();
      vec.resize((size - 9) as usize,0);
      OsRng.fill_bytes(&mut vec);
      bytes.extend_from_slice(&vec);
      
      let heap = UDPCON.get().write().unwrap();
      let sock = heap.try_clone().unwrap();
      sock.send_to(&bytes, self.src).unwrap();
      
      thread::sleep(beat);
    }
  }
}

fn do_listen(){
  let mut system = DataStore::globals().get_object("system");
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
  let buf = DataBytes::from_bytes(&my_session_public.to_bytes().to_vec());
  system.put_bytes("session_pubkey", buf);
  
  // FIXME - Support payloads up to 67K?
  let mut buf = [0; MAXPACKETSIZE]; 
  
  fn helo(cmd:u8, buf:&mut [u8], my_session_public:PublicKey, my_session_private:StaticSecret, my_uuid:String, my_public:String) -> (Aes256, Vec<u8>) {
    let remote_session_public: [u8; 32] = buf[1..33].try_into().unwrap();
    let remote_session_public = PublicKey::from(remote_session_public);

    let mut buf = Vec::new();

    // Send WELCOME
    buf.push(cmd);

    // Send session public key
    buf.extend_from_slice(my_session_public.as_bytes());

    let shared_secret = my_session_private.diffie_hellman(&remote_session_public);
    let key = GenericArray::from(shared_secret.to_bytes());
    let cipher = Aes256::new(&key);

    // Send my UUID
    let bytes = encrypt(&cipher, my_uuid.as_bytes());
    buf.extend_from_slice(&bytes);

    // Send my public key
    let bytes = encrypt(&cipher, &decode_hex(&my_public).unwrap());
    buf.extend_from_slice(&bytes);
    
    (cipher, buf)
  }
  
  fn welcome(cmd:u8, buf:&mut [u8], my_session_public:PublicKey, my_session_private:StaticSecret, my_uuid:String, my_public:String, my_private:StaticSecret) -> Option<(String, DataObject, Aes256, Vec<u8>)> {
    let (cipher, bytes2) = helo(cmd, buf, my_session_public, my_session_private, my_uuid, my_public);
    
    // Read remote UUID
    let uuid: [u8; 48] = buf[33..81].try_into().unwrap();
    let mut uuid = decrypt(&cipher, &uuid);
    uuid.resize(36,0);
    let uuid = String::from_utf8(uuid).unwrap();

    let mut ok = true;
    let user = get_user(&uuid);
    if user.is_some() {
      let mut user = user.unwrap();
      let bytes = decrypt(&cipher, &buf[81..113]);
      let peer_public: [u8; 32];
      if user.has("publickey") {
        // fetch remote public key
        peer_public = decode_hex(&user.get_string("publickey")).unwrap().try_into().unwrap();
        if peer_public.to_vec() != bytes { ok = false; }
      }
      else {
        // Read remote public key
        peer_public = bytes.try_into().unwrap();
        let x = to_hex(&peer_public);
        user.put_string("publickey", &x);
        set_user(&uuid, user.clone());
      }
      if ok {
        // Switch to permanent keypair
        let peer_public = PublicKey::from(peer_public);
        let shared_secret = my_private.diffie_hellman(&peer_public);
        let key = GenericArray::from(shared_secret.to_bytes());
        let cipher = Aes256::new(&key);
        return Some((uuid, user, cipher, bytes2));
      }
      else { println!("BAD PUB KEY GIVEN {} / {}", to_hex(&peer_public), to_hex(&buf[81..113])); }
    }
    None
  }
  
  let sessiontimeoutmillis = system.get_object("config").get_int("sessiontimeoutmillis");
  while system.get_boolean("running") {
    let sock = UDPCON.get().write().unwrap().try_clone().unwrap();
    let (amt, src) = sock.recv_from(&mut buf).unwrap();
//    println!("GOT {}", amt);
    let buf = &mut buf[..amt];
    let cmd = buf[0];
    match cmd {
      HELO => {
        let mut d = DataObject::new();
        d.put_string("addr", &src.to_string());
        d.put_int("len", amt as i64);
        fire_event("peer", "UDP_REQUEST_RECEIVED", d);
        //println!("P2P UDP incoming request from {:?} len {}", src, amt);
        if amt == 33 {
          // FIXME - If we have their pubkey, skip to YO
          let (_cipher, buf) = helo(WELCOME, buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned());
          
          //println!("HELO BUFLEN {}", buf.len());
          sock.send_to(&buf, &src).unwrap();
        }
      },
      WELCOME => {
        if amt == 113 {
          let res = welcome(YO, buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private.to_owned());
          if res.is_some(){
            let (_uuid, _user, cipher, mut buf) = res.unwrap();
            
            // Send proof of crypto
            let bytes = encrypt(&cipher, "What's good, yo?".as_bytes());
            buf.extend_from_slice(&bytes);

            //println!("WELCOME BUFLEN {}", buf.len());
            sock.send_to(&buf, &src).unwrap();
          }
        }
      },
      YO => {
        if amt == 129 {
          let res = welcome(SUP, buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private.to_owned());
          if res.is_some(){
            let (uuid, _user, cipher, buf2) = res.unwrap();

            // check their proof of crypto
            let bytes = decrypt(&cipher, &buf[113..129]);
            let s = String::from_utf8(bytes).unwrap();
            if &s != "What's good, yo?" {
              println!("Bad crypto {}", s);
            }
            else {
              // Send proof of crypto
              let mut buf = buf2;
              let bytes = encrypt(&cipher, "All is good now!".as_bytes());
              buf.extend_from_slice(&bytes);

              let (conid, _con) = P2PConnection::begin(uuid, P2PStream::Udp(UdpStream::blank(src)));

              // Send connection ID
              buf.extend_from_slice(&conid.to_be_bytes());
                
              //println!("YO CON {} = {}", data_ref, remote_id);
              sock.send_to(&buf, &src).unwrap();
            }
          }
        }
      },
      SUP => {
        if amt == 137 {
          let res = welcome(RDY, buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private.to_owned());
          if res.is_some(){
            let (uuid, mut user, cipher, buf2) = res.unwrap();

            // check their proof of crypto
            let bytes = decrypt(&cipher, &buf[113..129]);
            let s = String::from_utf8(bytes).unwrap();
            if &s != "All is good now!" {
              println!("Bad crypto {}", s);
            }
            else {
              let bytes:[u8; 8] = buf[129..137].try_into().unwrap();
              let remote_id = i64::from_be_bytes(bytes);
                
              let stream = UdpStream::new(src, remote_id);
              let (conid, con) = P2PConnection::begin(uuid, P2PStream::Udp(stream.duplicate()));

              let mut buf = buf2;
              
              // Send their connection id
              buf.extend_from_slice(&remote_id.to_be_bytes());
 
              // Send my connection ID
              buf.extend_from_slice(&conid.to_be_bytes());
                
              //println!("SUP CON {} = {}", data_ref, conid);
              sock.send_to(&buf, &src).unwrap();
              
              let con = con.duplicate();
              thread::spawn(move || {
                handle_connection(conid, con);
              });
              
              thread::spawn(move || {
                stream.duplicate().upgrade_mtu();
              });
              
              let p2pport = src.port();
              let ipaddr = src.ip().to_string();
              user.put_int("port", p2pport as i64);
              user.put_int("p2pport", p2pport as i64);
              user.put_string("address", &ipaddr);
            }
          }
        }
      },
      RDY => {
        if amt == 129 {
          let res = welcome(RDY, buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private.to_owned());
          if res.is_some(){
            let (_uuid, mut user, _cipher, _buf2) = res.unwrap();
            let bytes:[u8; 8] = buf[113..121].try_into().unwrap();
            let id = i64::from_be_bytes(bytes);
            let con = P2PConnection::try_get(id);
            if con.is_some() {
              let con = con.unwrap().duplicate();
              if let P2PStream::Udp(ref stream) = con.stream {
                if stream.src == src {
                  let mut stream = stream.duplicate();
                  
                  let bytes:[u8; 8] = buf[121..129].try_into().unwrap();
                  let remote_id = i64::from_be_bytes(bytes);
                  stream.set_id(remote_id);
                  //println!("RDY");

                  let con = con.duplicate();
                  thread::spawn(move || {
                    handle_connection(id, con);
                  });
              
                  thread::spawn(move || {
                    stream.duplicate().upgrade_mtu();
                  });

                  let p2pport = src.port();
                  let ipaddr = src.ip().to_string();
                  user.put_int("port", p2pport as i64);
                  user.put_int("p2pport", p2pport as i64);
                  user.put_string("address", &ipaddr);
                }
                else {
                  println!("Received RDY from wrong source");
                }
              }
            }
          }
        }
      },
      CMD => {
        let id: [u8; 8] = buf[1..9].try_into().unwrap();
        let id = i64::from_be_bytes(id);
        let msg_id: [u8; 8] = buf[9..17].try_into().unwrap();
        let msg_id = i64::from_be_bytes(msg_id);
        let buf = &buf[17..];

        let con = P2PConnection::try_get(id);
        if con.is_some() {
          let mut con = con.unwrap();
          if let P2PStream::Udp(stream) = &mut con.stream {
            if stream.src == src {
              let mut stream = stream.duplicate();
                  
              let now = time();
              stream.data.put_int("last_contact", now);
              system.get_object("sessions").get_object(&con.sessionid).put_int("expire", now + sessiontimeoutmillis);

              // There can be only one!
              let _lock = READMUTEX.get().write().unwrap();
              let in_off = stream.data.get_int("in_off");
              let mut inv = stream.data.get_array("in");

              let i = msg_id - in_off;
              if i < 0 {
                println!("Ignoring resend of msg {} on udp connection {}", msg_id, id);
              }
              else if i > MAXPACKETCOUNT as i64 {
                println!("Too many packets... Ignoring msg {} on udp connection {}", msg_id, id);
              }
              else {
                while (inv.len() as i64) < i {
                  inv.push_property(Data::DNull);
                }

                let db = DataBytes::from_bytes(&buf.to_vec());
                if (inv.len() as i64) == i { inv.push_bytes(db); }
                else {
                  if !inv.get_property(i as usize).is_null(){
                    println!("Duplicate of msg {} on udp connection {}", msg_id, id);
                  }
                  inv.put_bytes(i as usize, db); 
                }

                let mut i = 0;
                while i < inv.len() {
                  if Data::equals(inv.get_property(i), Data::DNull) { break; }
                  i += 1;
                }
                if i > 0 {
                  let i = (i as i64) + in_off - 1;
                  //println!("send ACK {}", i);

                  let id = stream.data.get_int("id");

                  let mut bytes = Vec::new();
                  bytes.push(ACK);
                  bytes.extend_from_slice(&id.to_be_bytes());
                  bytes.extend_from_slice(&i.to_be_bytes());
                  sock.send_to(&bytes, &src).unwrap();
                }
              }
            }
            else {
              println!("Received CMD from wrong source");
            }
          }
        }
      },
      ACK => { // FIXME - Only process if size (amt) is correct 
        let id: [u8; 8] = buf[1..9].try_into().unwrap();
        let id = i64::from_be_bytes(id);
        let msg_id: [u8; 8] = buf[9..17].try_into().unwrap();
        let msg_id = i64::from_be_bytes(msg_id);

        let mut con = P2PConnection::get(id);
        if let P2PStream::Udp(stream) = &mut con.stream {
          if stream.src == src {
            // There can be only one!
            let _lock = WRITEMUTEX.get().write().unwrap();
            let mut out_off = stream.data.get_int("out_off");
            let mut out = stream.data.get_array("out");

            let n = msg_id - out_off;
            let mut i = 0;
            while i <= n {
              //println!("removing packet {}", out_off);
              out.remove_property(0);
              out_off += 1;
              i += 1;
            }
            stream.data.put_int("out_off", out_off);
          }
          else {
            println!("Received ACK from wrong source");
          }
        }
      },
      RESEND => { // FIXME - Only process if size (amt) is correct 
        let id: [u8; 8] = buf[1..9].try_into().unwrap();
        let id = i64::from_be_bytes(id);
        let msg_id: [u8; 8] = buf[9..17].try_into().unwrap();
        let msg_id = i64::from_be_bytes(msg_id);
        let last: [u8; 8] = buf[17..25].try_into().unwrap();
        let last = i64::from_be_bytes(last);

        let mut con = P2PConnection::get(id);
        if let P2PStream::Udp(stream) = &mut con.stream {
          if stream.src == src {
            // There can be only one!
            // FIXME - Is lock necessary? We're in the only thread that removes packets from out.
            let _lock = WRITEMUTEX.get().write().unwrap();
            let out_off = stream.data.get_int("out_off");
            let out = stream.data.get_array("out");

            let mut n = msg_id - out_off;
            if n<0 {
              println!("Ignoring request for resend of msg {} on udp connection {}", msg_id, id);
            }
            else {
              let stop = last - out_off;
              println!("Resending msg {} to {} on udp connection {}", msg_id, last, id);
              while n <= stop {
                let bytes = out.get_bytes(n as usize);
                sock.send_to(&bytes.get_data(), &src).unwrap();
                n += 1;
              }
            }
          }
          else {
            println!("Received ACK from wrong source");
          }
        }
      },
      EXTEND_MTU => {
        let id: [u8; 8] = buf[1..9].try_into().unwrap();
        let id = i64::from_be_bytes(id);
        let mut con = P2PConnection::get(id);
        if let P2PStream::Udp(stream) = &mut con.stream {
          if stream.src == src {
            let mtu = stream.data.get_int("mtu");
            if mtu < amt as i64 {
              stream.data.put_int("mtu", amt as i64);
              //println!("Increased MTU for connection {} from {} to {}", id, mtu, amt);
            }
          }
        }
      },
      _ => {
        println!("Unknown UDP command {} len {}", cmd, buf.len());
      },
    }



  }