  let socket_address = ipaddr+":"+&port.to_string();
  START.call_once(|| { 
    UDPCON.set(RwLock::new(UdpSocket::bind(socket_address).unwrap())); 
    NEXTID.set(RwLock::new(AtomicUsize::from(1))); 
    println!("P2P UDP listening on port {}", port);
  });
  do_listen();
  port
}

static START: Once = Once::new();
pub static UDPCON:Storage<RwLock<UdpSocket>> = Storage::new();
static NEXTID:Storage<RwLock<AtomicUsize>> = Storage::new();

const HELO:u8 = 0;
const WELCOME:u8 = 1;
const YO:u8 = 2;
const SUP:u8 = 3;
const CMD:u8 = 4;

#[derive(Debug)]
pub struct UdpStream {
}

impl UdpStream {
  pub fn new() -> Self {
    UdpStream{}
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
  let mut buf = [0; 508]; 
  
  fn pack(cmd:u8, buf:&mut [u8], my_session_public:PublicKey, my_session_private:StaticSecret, my_uuid:String, my_public:String) -> Vec<u8> {
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
    
    buf
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
          let buf = pack(WELCOME, buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned());
          
          println!("HELO BUFLEN {}", buf.len());
          sock.send_to(&buf, &src).unwrap();
        }
      },
      WELCOME => {
        if amt == 113 {
          //Read remote session public key
          let remote_session_public: [u8; 32] = buf[1..33].try_into().unwrap();
          let remote_session_public = PublicKey::from(remote_session_public);
          
          let shared_secret = my_session_private.diffie_hellman(&remote_session_public);
          let key = GenericArray::from(shared_secret.to_bytes());
          let cipher = Aes256::new(&key);
          
          // Read remote UUID
          let uuid: [u8; 48] = buf[33..81].try_into().unwrap();
          let mut uuid = decrypt(&cipher, &uuid);
          uuid.resize(36,0);
          let uuid = String::from_utf8(uuid).unwrap();
          
          let mut ok = true;
          let user = get_user(&uuid);
          if user.is_some() {
            let mut user = user.unwrap();
            let mut bytes = decrypt(&cipher, &buf[81..113]);
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
              let mut buf = Vec::new();

              // Send YO
              buf.push(YO);
              
              // Send session public key
              buf.extend_from_slice(my_session_public.as_bytes());
              
              // Send my UUID
              let bytes = encrypt(&cipher, my_uuid.as_bytes());
              buf.extend_from_slice(&bytes);

              // Send my public key
              let bytes = encrypt(&cipher, &decode_hex(&my_public).unwrap());
              buf.extend_from_slice(&bytes);
              
              // Switch to permanent keypair
              let peer_public = PublicKey::from(peer_public);
              let shared_secret = my_private.diffie_hellman(&peer_public);
              let key = GenericArray::from(shared_secret.to_bytes());
              let cipher = Aes256::new(&key);

              // Send proof of crypto
              let bytes = encrypt(&cipher, "What's good, yo?".as_bytes());
              buf.extend_from_slice(&bytes);

              println!("WELCOME BUFLEN {} {}", uuid, buf.len());
              sock.send_to(&buf, &src).unwrap();
            }
            else { println!("BAD PUB KEY GIVEN {} / {}", to_hex(&peer_public), to_hex(&buf[81..113])); }
          }
        }
      },
      YO => {
        if amt == 129 {
          //Read remote session public key
          let remote_session_public: [u8; 32] = buf[1..33].try_into().unwrap();
          let remote_session_public = PublicKey::from(remote_session_public);
          
          let shared_secret = my_session_private.diffie_hellman(&remote_session_public);
          let key = GenericArray::from(shared_secret.to_bytes());
          let cipher = Aes256::new(&key);
          
          // Read remote UUID
          let uuid: [u8; 48] = buf[33..81].try_into().unwrap();
          let mut uuid = decrypt(&cipher, &uuid);
          uuid.resize(36,0);
          let uuid = String::from_utf8(uuid).unwrap();
          println!("WELCOME YO {} {:?}", uuid, src);
          
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

              // check proof
              let bytes = decrypt(&cipher, &buf[113..129]);
              let s = String::from_utf8(bytes).unwrap();
              if &s != "What's good, yo?" {
                println!("Bad crypto {}", s);
              }
              else {
                let mut buf = Vec::new();

                // Send YO
                buf.push(SUP);












  /*
                let con = P2PConnection{
                  stream: P2PStream::Udp(UdpStream::new()),
                  sessionid: unique_session_id(),
                  cipher: cipher.to_owned(),
                  uuid: uuid.to_owned(),
                  res: DataObject::new(),
                };
                let data_ref = P2PHEAP.get().write().unwrap().push(con.duplicate()) as i64;
                let mut connections = user.get_array("connections");
                connections.push_i64(data_ref);

                // Send connection ID
                buf.extend_from_slice(&data_ref.to_be_bytes());
  */
              }              
              
              
            }
            else { println!("BAD PUB KEY GIVEN {} / {}", to_hex(&peer_public), to_hex(&buf[81..113])); }
          }
        }
      },
      _ => {
        println!("Unknown UDP command {}", cmd);
      },
    }



  }