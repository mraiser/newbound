use ndata::dataobject::*;
use std::io;
use std::net::UdpSocket;
use flowlang::datastore::DataStore;
use crate::peer::service::listen::decode_hex;
use x25519_dalek::StaticSecret;
use rand::rngs::OsRng;
use x25519_dalek::PublicKey;
use aes::Aes256;
use crate::peer::service::listen::encrypt;
use aes::cipher::KeyInit;
use aes::cipher::generic_array::GenericArray;
use std::sync::RwLock;
use std::sync::Once;
use state::Storage;
use crate::peer::service::listen::decrypt;
use ndata::databytes::DataBytes;
use flowlang::appserver::get_user;
use crate::peer::service::listen::to_hex;
use flowlang::appserver::set_user;
use crate::peer::service::listen::P2PConnection;
use flowlang::generated::flowlang::system::unique_session_id::unique_session_id;
use crate::peer::service::listen::P2PStream;
use crate::peer::service::listen::P2PHEAP;
use ndata::dataarray::DataArray;
use std::net::SocketAddr;
use std::thread;
use std::time::Duration;
use ndata::data::Data;
use rand::Rng;
use std::collections::HashMap;
use flowlang::generated::flowlang::system::time::time;
use crate::peer::peer::peers::user_to_peer;
use flowlang::appserver::fire_event;
use crate::peer::service::listen::handle_next_message;
use std::io::Error;
use std::io::ErrorKind;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("ipaddr");
let a1 = o.get_i64("port");
let ax = listen_udp(a0, a1);
let mut o = DataObject::new();
o.put_i64("a", ax);
o
}

pub fn listen_udp(ipaddr:String, port:i64) -> i64 {
  let socket_address = ipaddr+":"+&port.to_string();
  START.call_once(|| { 
    UDPCON.set(RwLock::new(UdpSocket::bind(socket_address).unwrap())); 
    UDPLOOKUP.set(RwLock::new(HashMap::new())); 
    READMUTEX.set(RwLock::new(true)); 
    WRITEMUTEX.set(RwLock::new(true)); 
    println!("P2P UDP listening on port {}", port);
  });
  do_listen();
  port
}

static START: Once = Once::new();
pub static UDPCON:Storage<RwLock<UdpSocket>> = Storage::new();
pub static UDPLOOKUP:Storage<RwLock<HashMap<i64, i64>>> = Storage::new();
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

const MAXPACKETBUFF:i64 = 1000;

#[derive(Debug)]
pub struct UdpStream {
  pub src: SocketAddr,
  pub data: DataObject,
}

impl UdpStream {
  pub fn new(src:SocketAddr, remote_id:i64) -> Self {
    let mut a = DataObject::new();
    a.put_i64("id", remote_id);
    a.put_i64("in_off", 0);
    a.put_i64("out_off", 0);
    a.put_i64("next", 0);
    a.put_array("in", DataArray::new());
    a.put_array("out", DataArray::new());
    a.put_bool("dead", false);
    a.put_i64("last_contact", time());
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
      data: self.data.duplicate(),
    }
  }

  pub fn set_id(&mut self, id:i64) {
    // There can be only one!
    let _lock = WRITEMUTEX.get().write().unwrap();
    
    self.data.put_i64("id", id);

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
    // There can be only one!
    let _lock = WRITEMUTEX.get().write().unwrap();
    
    let id = self.data.get_i64("id");
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
      let mut msgid = self.data.get_i64("next");
      
      let blocks: Vec<&[u8]> = buf.chunks(491).collect();
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
      
      self.data.put_i64("next", msgid);
    }
    Ok(buf.len())
  }
  
  pub fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
    if self.data.get_bool("dead") { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }
    
    let mut inv = self.data.get_array("in");
    
    let len = buf.len();
    let mut i = 0;
    let mut v = Vec::new();
    
    let mut in_off;
    {
      // There can be only one!
      let _lock = READMUTEX.get().write().unwrap();
      in_off = self.data.get_i64("in_off");
    }
    //println!("start read {}", in_off);
    
    let beat = Duration::from_millis(100);
    while i < len {
      // FIXME - should timeout?
      let mut timeout = 0;
      while inv.len() == 0 {
        // TIGHTLOOP
        thread::sleep(beat);
        timeout += 1;
        if timeout > 1000 { println!("Unusually long wait in peer:service:listen_udp:read_exact 1 [{}]", self.data.get_i64("id")); }
      }

      let mut timeout = 0;
      while inv.get_property(0).is_null() {
        self.request_resend(in_off);
        // TIGHTLOOP
        thread::sleep(beat);
        timeout += 1;
        if timeout > 1000 { println!("Unusually long wait in peer:service:listen_udp:read_exact 2 [{}]", self.data.get_i64("id")); }
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
      self.data.put_i64("in_off", in_off);

      i += n;
    }        
    buf.clone_from_slice(&v);
    //println!("read exact done {}", in_off);
    Ok(())
  }
  
  fn request_resend(&self, msgid:i64) {
    let id = self.data.get_i64("id");
    println!("request resend of {} from {}", msgid, id);
    let mut bytes = Vec::new();
    bytes.push(RESEND);
    bytes.extend_from_slice(&id.to_be_bytes());
    bytes.extend_from_slice(&msgid.to_be_bytes());
    let heap = UDPCON.get().write().unwrap();
    let sock = heap.try_clone().unwrap();
    sock.send_to(&bytes, self.src).unwrap();
  }
  
  pub fn last_contact(&self) -> i64 {
    self.data.get_i64("last_contact")
  }
}

fn lookup_udp(id:i64) -> Option<i64> {
  let heap = UDPLOOKUP.get().write().unwrap();
  let id = heap.get(&id);
  if id.is_none() { return None; }
  Some(*id.unwrap())
}

fn not_negative_one() -> i64 {
  let x = rand::thread_rng().gen::<i64>();
  if x == -1 { return not_negative_one(); }
  x
}

fn handle_connection(data_ref: usize, con: P2PConnection) {
  let uuid = con.uuid.to_owned();
  let sessionid = con.sessionid.to_owned();
  let stream = con.stream.try_clone().unwrap();

  let mut user = get_user(&uuid).unwrap();
  user.put_i64("last_contact", time());

  let system = DataStore::globals().get_object("system");
  let sessiontimeoutmillis = system.get_object("config").get_i64("sessiontimeoutmillis");

  // FIXME - Make session  creation its own thing. Merge with appserver
  let mut session = DataObject::new();
  session.put_i64("count", 0);
  session.put_str("id", &sessionid);
  session.put_str("username", &uuid);
  session.put_object("user", user.duplicate());
  let expire = time() + sessiontimeoutmillis;
  session.put_i64("expire", expire);

  let mut sessions = system.get_object("sessions");
  sessions.put_object(&sessionid, session.duplicate());
  
  let connections = user.get_array("connections");

  let remote_addr = stream.peer_addr().unwrap();
  println!("P2P UDP Connect {} / {} / {} / {}", remote_addr, sessionid, user.get_string("displayname"), uuid);
  user.put_str("address", &remote_addr.ip().to_string());
  let peer = user_to_peer(user.duplicate(), uuid.to_owned());
  fire_event("peer", "CONNECT", peer.duplicate());
  fire_event("peer", "UPDATE", peer.duplicate());
  
  // loop
  while system.get_bool("running") {
    if !handle_next_message(con.duplicate()) { break; }
  }
  // end loop
  
  sessions.remove_property(&sessionid);
  let _x = connections.remove_data(Data::DInt(data_ref as i64));
  P2PHEAP.get().write().unwrap().decr(data_ref);

  println!("P2P UDP Disconnect {} / {} / {} / {}", remote_addr, sessionid, user.get_string("displayname"), uuid);
  let peer = user_to_peer(user.duplicate(), uuid.to_owned());
  fire_event("peer", "DISCONNECT", peer.duplicate());
  fire_event("peer", "UPDATE", peer.duplicate());
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
  let mut buf = [0; 508]; 
  
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
        user.put_str("publickey", &x);
        set_user(&uuid, user.duplicate());
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
  
  while system.get_bool("running") {
    let sock = UDPCON.get().write().unwrap().try_clone().unwrap();
    let (amt, src) = sock.recv_from(&mut buf).unwrap();
    let buf = &mut buf[..amt];
    let cmd = buf[0];
    match cmd {
      HELO => {
        println!("P2P UDP incoming request from {:?} len {}", src, amt);
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
            let (uuid, user, cipher, buf2) = res.unwrap();

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

              let con = P2PConnection{
                stream: P2PStream::Udp(UdpStream::blank(src)),
                sessionid: unique_session_id(),
                cipher: cipher.to_owned(),
                uuid: uuid.to_owned(),
                res: DataObject::new(),
                pending: DataArray::new(),
              };
              let data_ref = P2PHEAP.get().write().unwrap().push(con.duplicate()) as i64;
              let mut connections = user.get_array("connections");
              connections.push_i64(data_ref);

              // Send connection ID
              let remote_id = not_negative_one();
              UDPLOOKUP.get().write().unwrap().insert(remote_id, data_ref);
              buf.extend_from_slice(&remote_id.to_be_bytes());
                
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
            let (uuid, user, cipher, buf2) = res.unwrap();

            // check their proof of crypto
            let bytes = decrypt(&cipher, &buf[113..129]);
            let s = String::from_utf8(bytes).unwrap();
            if &s != "All is good now!" {
              println!("Bad crypto {}", s);
            }
            else {
              let bytes:[u8; 8] = buf[129..137].try_into().unwrap();
              let remote_id = i64::from_be_bytes(bytes);
                            
              let con = P2PConnection{
                stream: P2PStream::Udp(UdpStream::new(src, remote_id)),
                sessionid: unique_session_id(),
                cipher: cipher.to_owned(),
                uuid: uuid.to_owned(),
                res: DataObject::new(),
                pending: DataArray::new(),
              };
              let data_ref = P2PHEAP.get().write().unwrap().push(con.duplicate()) as i64;
              let mut connections = user.get_array("connections");
              connections.push_i64(data_ref);

              let mut buf = buf2;
              
              // Send their connection id
              buf.extend_from_slice(&remote_id.to_be_bytes());
 
              // Send my connection ID
              let remote_id = not_negative_one();
              UDPLOOKUP.get().write().unwrap().insert(remote_id, data_ref);
              buf.extend_from_slice(&remote_id.to_be_bytes());
                
              //println!("SUP CON {} = {}", data_ref, remote_id);
              sock.send_to(&buf, &src).unwrap();
              
              thread::spawn(move || {
                handle_connection(data_ref as usize, con);
              });
            }
          }
        }
      },
      RDY => {
        if amt == 129 {
          let res = welcome(RDY, buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private.to_owned());
          if res.is_some(){
            let _x = res.unwrap();
            let bytes:[u8; 8] = buf[113..121].try_into().unwrap();
            let id = i64::from_be_bytes(bytes);
            let id = lookup_udp(id);
            if id.is_some() {
              let id = id.unwrap();
              let mut heap = P2PHEAP.get().write().unwrap();
              let con = heap.try_get(id as usize);
              if con.is_some() {
                let mut con = con.unwrap().duplicate();
                if let P2PStream::Udp(stream) = &mut con.stream {
                  if stream.src == src {
                    let bytes:[u8; 8] = buf[121..129].try_into().unwrap();
                    let remote_id = i64::from_be_bytes(bytes);
                    stream.set_id(remote_id);
                    //println!("RDY");

                    thread::spawn(move || {
                      handle_connection(id as usize, con);
                    });
                  }
                  else {
                    println!("Received RDY from wrong source");
                  }
                }
              }
            }
          }
        }
      },
      CMD => {
        let id: [u8; 8] = buf[1..9].try_into().unwrap();
        let id = i64::from_be_bytes(id);
        //println!("CMD remote id {}", id);
        let id = lookup_udp(id);
        if id.is_some() {
          let id = id.unwrap();
          //println!("CMD local id {}", id);
        
          let msg_id: [u8; 8] = buf[9..17].try_into().unwrap();
          let msg_id = i64::from_be_bytes(msg_id);
          //println!("CMD msg id {}", msg_id);
          let buf = &buf[17..];

          let mut heap = P2PHEAP.get().write().unwrap();
          let con = heap.try_get(id as usize);
          if con.is_some() {
            let con = con.unwrap();
            if let P2PStream::Udp(stream) = &mut con.stream {
              if stream.src == src {
			    stream.data.put_i64("last_contact", time());

                // There can be only one!
                let _lock = READMUTEX.get().write().unwrap();
                let in_off = stream.data.get_i64("in_off");
                let mut inv = stream.data.get_array("in");

                //println!("CMD msg id {} in_off {}", msg_id, in_off);
                
                let i = msg_id - in_off;
                if i < 0 {
                  println!("Ignoring resend of msg {} on udp connection {}", msg_id, id);
                }
                else if i > MAXPACKETBUFF {
                  println!("Too many packets... Ignoring msg {} on udp connection {}", msg_id, id);
                }
                else {
                  while (inv.len() as i64) < i {
                    inv.push_property(Data::DNull);
                    println!("INV EXPAND");
                  }

                  let db = DataBytes::from_bytes(&buf.to_vec());
                  if (inv.len() as i64) == i { inv.push_bytes(db); }
                  else {
                    if !inv.get_property(i as usize).is_null(){
                      println!("Duplicate of msg {} on udp connection {}", msg_id, id);
                    }
                    inv.put_bytes(i as usize, db); 
                  }

                  //println!("CMD CON {} MSG {}", id, msg_id);

                  let mut i = 0;
                  while i < inv.len() {
                    if Data::equals(inv.get_property(i), Data::DNull) { break; }
                    i += 1;
                  }
                  if i > 0 {
                    let i = (i as i64) + in_off - 1;
                    //println!("send ACK {}", i);
                    
                    let id = stream.data.get_i64("id");

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
        }
      },
      ACK => {
        let id: [u8; 8] = buf[1..9].try_into().unwrap();
        let id = i64::from_be_bytes(id);
        //println!("received ACK for remote con {}", id);
        let id = lookup_udp(id);
        if id.is_some() {
          let id = id.unwrap();
          //println!("received ACK for local con {}", id);
        
          let msg_id: [u8; 8] = buf[9..17].try_into().unwrap();
          let msg_id = i64::from_be_bytes(msg_id);

          //println!("received ACK for packet {} on internal con {}", msg_id, id);

          let mut heap = P2PHEAP.get().write().unwrap();
          let con = heap.get(id as usize);
          if let P2PStream::Udp(stream) = &mut con.stream {
            if stream.src == src {
              // There can be only one!
              let _lock = WRITEMUTEX.get().write().unwrap();
              let mut out_off = stream.data.get_i64("out_off");
              let mut out = stream.data.get_array("out");

  //            println!("con {} has {} packets with offset {}", id, out.len(), out_off);

              let n = msg_id - out_off;
              let mut i = 0;
              while i <= n {
                //println!("removing packet {}", out_off);
                out.remove_property(0);
                out_off += 1;
                i += 1;
              }
              stream.data.put_i64("out_off", out_off);
            }
            else {
              println!("Received ACK from wrong source");
            }
          }
        }
      },
      _ => {
        println!("Unknown UDP command {} len {}", cmd, buf.len());
      },
    }



  }
}

