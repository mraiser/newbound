use ndata::dataobject::*;
use std::num::ParseIntError;
use std::net::TcpStream;
use std::io::Read;
use std::io::Write;
use std::thread;
use std::sync::Once;
use state::Storage;
use std::sync::RwLock;
use std::net::TcpListener;
use ndata::heap::Heap;
use ndata::data::*;
use flowlang::datastore::DataStore;
use flowlang::appserver::get_user;
use flowlang::appserver::set_user;
use flowlang::generated::flowlang::system::unique_session_id::unique_session_id;
use x25519_dalek::StaticSecret;
use x25519_dalek::PublicKey;
use aes::Aes256;
use aes::cipher::{
    BlockEncrypt, KeyInit,
    generic_array::GenericArray,
};
use aes::cipher::BlockDecrypt;
use flowlang::appserver::lookup_command_id;
use std::panic;
use flowlang::command::Command;
use flowlang::appserver::check_security;
use flowlang::appserver::format_result;
use rand::rngs::OsRng;
use flowlang::generated::flowlang::system::time::time;

pub fn execute(o: DataObject) -> DataObject {
let a0 = o.get_string("ipaddr");
let a1 = o.get_i64("port");
let ax = listen(a0, a1);
let mut o = DataObject::new();
o.put_str("a", &ax);
o
}

pub fn listen(ipaddr:String, port:i64) -> String {
  START.call_once(|| { P2PHEAP.set(RwLock::new(Heap::new())); });

  println!("P2P TCP listening...");
  let socket_address = ipaddr+":"+&port.to_string();
  let listener = TcpListener::bind(socket_address).unwrap();
  for stream in listener.incoming() {
    let mut stream = stream.unwrap();
    thread::spawn(move || {
      println!("P2P TCP incoming request...");
      let remote_addr = stream.peer_addr().unwrap();
      
      let system = DataStore::globals().get_object("system");
      let runtime = system.get_object("apps").get_object("app").get_object("runtime");
      let my_uuid = runtime.get_string("uuid");
      
      let my_public = runtime.get_string("publickey");
      let my_private = runtime.get_string("privatekey");
      let my_private = decode_hex(&my_private).unwrap();
      let my_private: [u8; 32] = my_private.try_into().expect("slice with incorrect length");
      let my_private = StaticSecret::from(my_private);
      
      let sessiontimeoutmillis = system.get_object("config").get_i64("sessiontimeoutmillis");
      
      // Temp key pair for initial exchange
      let my_session_private = StaticSecret::new(OsRng);
      let my_session_public = PublicKey::from(&my_session_private);

      // Send temp pubkey
      let _x = stream.write(&my_session_public.to_bytes()).unwrap();
      let mut bytes = vec![0u8; 32];

      // Read remote temp pubkey
      let _x = stream.read_exact(&mut bytes).unwrap();
      let remote_session_public: [u8; 32] = bytes.try_into().expect("slice with incorrect length");
      let remote_session_public = PublicKey::from(remote_session_public);

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
        let _x = stream.read_exact(&mut bytes).unwrap();
        let remote_step = bytes[0];
        
        // Remote step
        if remote_step == 0 {
          let bytes = encrypt(&cipher, &decode_hex(&my_public).unwrap());
          let _x = stream.write(&bytes).unwrap();
        }
        //FIXME - else exit if remote_step != 1
        
        
        
        // mystep
        if !havekey {
          let mut bytes = vec![0u8; 32];
          let _x = stream.read_exact(&mut bytes).unwrap();
          let peer_public = decrypt(&cipher, &bytes);
          
          // FIXME - move to after what's good exchange
          user.put_str("publickey", &to_hex(&peer_public));
          set_user(&uuid, user.duplicate());
        }
        let peer_public = user.get_string("publickey");
        let peer_public = decode_hex(&peer_public).unwrap();
        
        
        
        let peer_public: [u8; 32] = peer_public.try_into().expect("slice with incorrect length");
        let peer_public = PublicKey::from(peer_public);
        let shared_secret = my_private.diffie_hellman(&peer_public);
        let key = GenericArray::from(shared_secret.to_bytes());
        let cipher = Aes256::new(&key);
        
        
        
        let buf = encrypt(&cipher, "What's good, yo?".as_bytes());
        let _x = stream.write(&buf).unwrap();
        
        let mut bytes = vec![0u8; 16];
        let _x = stream.read_exact(&mut bytes).unwrap();
        let mut bytes = decrypt(&cipher, &bytes);
        bytes.resize(16, 0);
        let sig = String::from_utf8(bytes).unwrap();

        if sig == "All is good now!" {
          let sessionid = unique_session_id();
          let con = P2PConnection{
            stream: stream.try_clone().unwrap(),
            sessionid: sessionid.to_owned(),
          };
          let data_ref = P2PHEAP.get().write().unwrap().push(con);
          let mut connections = user.get_array("connections");
          connections.push_i64(data_ref as i64);

          let mut session = DataObject::new();
          // FIXME - add expire
          session.put_i64("count", 0);
          session.put_str("id", &sessionid);
          session.put_str("username", &uuid);
          session.put_object("user", user.duplicate());
          let expire = time() + sessiontimeoutmillis;
          session.put_i64("expire", expire);

          let mut sessions = system.get_object("sessions");
          sessions.put_object(&sessionid, session.duplicate());

          println!("P2P TCP Connect {} / {} / {} / {}", remote_addr, sessionid, user.get_string("displayname"), uuid);
          
          loop {
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

            let sid = sessionid.to_owned();
            let expire = time() + sessiontimeoutmillis;
            session.put_i64("expire", expire);
            
            
            
            // merge with appserver.rs websock loop
            if msg.starts_with("cmd ") {
              let msg = &msg[4..];
              let d = DataObject::from_string(msg);
              let app = d.get_string("bot");
              let cmd = d.get_string("cmd");
              let pid = d.get_i64("pid");
              let mut params = d.get_object("params");
              params.put_str("nn_sessionid", &sessionid);
              params.put_object("nn_session", session.duplicate());

              let (b, ctldb, id) = lookup_command_id(app, cmd.to_owned());

              let mut o;
              if b {
                let command = Command::new(&ctldb, &id);
                if check_security(&command, &sid) {
                  command.cast_params(params.duplicate());

                  let response = DataObject::new();
                  let dataref = response.data_ref;

                  let result = panic::catch_unwind(|| {
                    let mut p = DataObject::get(dataref);
                    let o = command.execute(params).unwrap();
                    p.put_object("a", o);
                  });

                  match result {
                    Ok(_x) => {
                      let oo = response.get_object("a");
                      o = format_result(command, oo);
                    },
                    Err(e) => {
                      let msg = match e.downcast::<String>() {
                        Ok(panic_msg) => format!("{}", panic_msg),
                        Err(_) => "unknown error".to_string()
                      };        
                      o = DataObject::new();
                      o.put_str("status", "err");
                      o.put_str("msg", &msg);
                    },
                  }
                }
                else {
                  o = DataObject::new();
                  o.put_str("status", "err");
                  let err = format!("UNAUTHORIZED: {}", &cmd);
                  o.put_str("msg", &err);
                }
              }
              else {
                o = DataObject::new();
                o.put_str("status", "err");
                let err = format!("Unknown websocket command: {}", &cmd);
                o.put_str("msg", &err);
              }

              if !o.has("status") { o.put_str("status", "ok"); }
              
              
              
              o.put_i64("pid", pid);

              let s = "res ".to_string() + &o.to_string();
              let buf = encrypt(&cipher, s.as_bytes());
              let len = buf.len() as i16;
              let _x = stream.write(&len.to_be_bytes()).unwrap();
              let _x = stream.write(&buf).unwrap();
            }
          }
          // end loop
          
          println!("P2P TCP Disconnect {} / {} / {} / {}", remote_addr, sessionid, user.get_string("displayname"), uuid);
          
          sessions.remove_property(&sessionid);
          let _x = connections.remove_data(Data::DInt(data_ref as i64));
          P2PHEAP.get().write().unwrap().decr(data_ref);
        }
      }
    });
  }
  "OK".to_string()
}

#[derive(Debug)]
pub struct P2PConnection {
  stream: TcpStream,
  sessionid: String,
}

static START: Once = Once::new();
pub static P2PHEAP:Storage<RwLock<Heap<P2PConnection>>> = Storage::new();


//static mut CONS:SharedMutex<HashMap<i32,String>> = SharedMutex::mirror(0,0);
//static mut NEXT:AtomicUsize = AtomicUsize::new(1);
//let num = &NEXT.fetch_add(1, Ordering::SeqCst);

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

}

