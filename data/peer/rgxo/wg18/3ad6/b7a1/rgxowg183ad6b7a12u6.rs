  let socket_address = ipaddr+":"+&port.to_string();
  START.call_once(|| { 
    UDPCON.set(RwLock::new(UdpSocket::bind(socket_address).unwrap())); 
    println!("P2P UDP listening on port {}", port);
  });
  do_listen();
  port
}

static START: Once = Once::new();
pub static UDPCON:Storage<RwLock<UdpSocket>> = Storage::new();

fn do_listen(){
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
  
  // FIXME - Support payloads up to 67K?
  let mut buf = [0; 508]; 
  
  while system.get_bool("running") {
    let (amt, src) = UDPCON.get().write().unwrap().recv_from(&mut buf).unwrap();
    let buf = &mut buf[..amt];
    let cmd = buf[0];
    match cmd {
      HELO => {
        println!("P2P UDP incoming request from {:?} len {}", src, amt);
        if amt == 33 {
          let remote_session_public: [u8; 32] = buf[1..33].try_into().unwrap();
          let remote_session_public = PublicKey::from(remote_session_public);
  //        let remote_id:[u8; 4] = buf[34..38].try_into().unwrap();
  //        let remote_id = u32::from_be_bytes(remote_id) as usize;

          let mut buf = Vec::new();
          
          // Send WELCOME
          buf.push(WELCOME);
          
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
          
          
          println!("HELO BUFLEN {}", buf.len());
          UDPCON.get().write().unwrap().send_to(&buf, &src).unwrap();
        }
      },
      WELCOME => {
        if amt == 33 {
        }
      },
      _ => {},
    }



  }
}

const HELO:u8 = 0;
const WELCOME:u8 = 1;
const CMD:u8 = 4;

pub struct UdpListener{
