  let socket_address = ipaddr+":"+&port.to_string();
  START.call_once(|| {
    UDPCON.init(UdpSocket::bind(socket_address).unwrap());
    READMUTEX.init(true);
    WRITEMUTEX.init(true);
    println!("P2P UDP listening on port {}", port);
  });
  do_listen();
  port
}

static START: Once = Once::new();
pub static UDPCON: GlobalSharedMutex<UdpSocket> = GlobalSharedMutex::new();
static READMUTEX: GlobalSharedMutex<bool> = GlobalSharedMutex::new();
static WRITEMUTEX: GlobalSharedMutex<bool> = GlobalSharedMutex::new();

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
    let _lock = WRITEMUTEX.lock();

    self.data.put_int("id", id);

    if self.data.has("hold") {
      let hold = self.data.get_array("hold");
      for bytes_data in hold.objects(){
        let bytes_item = bytes_data.bytes();
        let _x = self.write(&bytes_item.get_data()).unwrap();
      }
      self.data.remove_property("hold");
    }
  }

  pub fn write(&mut self, buf: &[u8]) -> io::Result<usize>
  {
    if self.data.get_boolean("dead") { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }

    // There can be only one!
    let _write_lock = WRITEMUTEX.lock();

    let id = self.data.get_int("id");
    if id == -1 {
      if !self.data.has("hold") { self.data.put_array("hold", DataArray::new()); }
      let mut hold = self.data.get_array("hold");
      let bytes_to_hold = DataBytes::from_bytes(&buf.to_vec());
      hold.push_bytes(bytes_to_hold);
    }
    else {
      // udp_socket_guard does not need to be mut
      let udp_socket_guard = UDPCON.lock();
      let sock = udp_socket_guard.try_clone().unwrap();
      // udp_socket_guard is dropped at the end of this `else` block,
      // maintaining lock for the duration of sends.

      let mut out = self.data.get_array("out");
      let mut msgid = self.data.get_int("next");
      let mtu = self.data.get_int("mtu");

      let blocks: Vec<&[u8]> = buf.chunks((mtu as usize)-(PACKETHEADERSIZE as usize)).collect();
      for chunk_buf in blocks {
        let mut bytes_payload = Vec::new();
        bytes_payload.push(CMD);
        bytes_payload.extend_from_slice(&id.to_be_bytes());
        bytes_payload.extend_from_slice(&msgid.to_be_bytes());
        bytes_payload.extend_from_slice(chunk_buf);
        let db = DataBytes::from_bytes(&bytes_payload);
        out.push_bytes(db);
        sock.send_to(&bytes_payload, self.src).unwrap();
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
      let _read_lock = READMUTEX.lock();
      in_off = self.data.get_int("in_off");
    }

    while i < len {
      let mut timeout = 0;
      while inv.len() == 0 {
        if self.data.get_boolean("dead") { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }
        timeout += 1;
        let beat = Duration::from_millis(timeout);
        thread::sleep(beat);
        if timeout > 450 { println!("Unusually long wait in peer:service:listen_udp:read_exact 1 [{}]", self.data.get_int("id")); timeout = 0; }
      }

      let mut timeout = 0;
      while inv.get_property(0).is_null() {
        if self.data.get_boolean("dead") { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }
        self.request_resend(in_off);
        timeout += 1;
        let beat = Duration::from_millis(timeout);
        thread::sleep(beat);
        if timeout > 450 { println!("Unusually long wait in peer:service:listen_udp:read_exact 2 [{}]", self.data.get_int("id")); timeout = 0; }
      }

      let bd = inv.get_bytes(0);
      let current_bytes = bd.get_data();
      let n = std::cmp::min(current_bytes.len(), len-i);
      v.extend_from_slice(&current_bytes[0..n]);
      let remaining_bytes = current_bytes[n..].to_vec();

      {
        let _read_lock_inner = READMUTEX.lock();

        if remaining_bytes.len() > 0 { bd.set_data(&remaining_bytes); }
        else {
          in_off += 1;
          inv.remove_property(0);
        }
        self.data.put_int("in_off", in_off);
      }

      i += n;
    }
    buf.clone_from_slice(&v);
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
    let mut bytes_to_send = Vec::new();
    bytes_to_send.push(RESEND);
    bytes_to_send.extend_from_slice(&id.to_be_bytes());
    bytes_to_send.extend_from_slice(&msgid.to_be_bytes());
    bytes_to_send.extend_from_slice(&last.to_be_bytes());
    let sock = {
        // udp_socket_guard does not need to be mut
        let udp_socket_guard = UDPCON.lock();
        udp_socket_guard.try_clone().unwrap()
    };
    sock.send_to(&bytes_to_send, self.src).unwrap();
  }

  pub fn last_contact(&self) -> i64 {
    self.data.get_int("last_contact")
  }

  pub fn upgrade_mtu(&self) {
    let id = self.data.get_int("id");
    let beat = Duration::from_millis(1000);
    for size in MTU_SIZES {
      let mut bytes_to_send = Vec::new();
      bytes_to_send.push(EXTEND_MTU);
      bytes_to_send.extend_from_slice(&id.to_be_bytes());

      let mut vec = Vec::new();
      vec.resize((size - 9) as usize,0);
      fill_bytes(&mut vec);
      bytes_to_send.extend_from_slice(&vec);

      let sock = {
        // udp_socket_guard does not need to be mut
        let udp_socket_guard = UDPCON.lock();
        udp_socket_guard.try_clone().unwrap()
    };
      sock.send_to(&bytes_to_send, self.src).unwrap();

      thread::sleep(beat);
    }
  }
}

fn do_listen(){
  let mut system = DataStore::globals().get_object("system");
  let runtime = system.get_object("apps").get_object("app").get_object("runtime");
  let my_uuid = runtime.get_string("uuid");

  let my_public = runtime.get_string("publickey");
  let my_private_hex = runtime.get_string("privatekey");
  let my_private_vec = decode_hex(&my_private_hex).unwrap();
  let my_private_arr: [u8; 32] = my_private_vec.try_into().expect("slice with incorrect length");

  let (my_session_private, my_session_public) = generate_x25519_keypair();
  let session_pubkey_bytes = DataBytes::from_bytes(&my_session_public.to_vec());
  system.put_bytes("session_pubkey", session_pubkey_bytes);

  let mut recv_buf = [0; MAXPACKETSIZE];

  fn helo(cmd_val:u8, data_buf:&mut [u8], local_session_public:[u8; 32], local_session_private:[u8; 32], local_uuid:String, local_public_key:String) -> (Aes256, Vec<u8>) {
    let remote_session_public: [u8; 32] = data_buf[1..33].try_into().unwrap();

    let mut response_buf = Vec::new();

    response_buf.push(cmd_val);
    response_buf.extend_from_slice(&local_session_public);

    let shared_secret = x25519(local_session_private, remote_session_public);
    let key = GenericArray::from(shared_secret);
    let cipher = Aes256::new(&key);

    let encrypted_uuid = encrypt(&cipher, local_uuid.as_bytes());
    response_buf.extend_from_slice(&encrypted_uuid);

    let encrypted_public_key = encrypt(&cipher, &decode_hex(&local_public_key).unwrap());
    response_buf.extend_from_slice(&encrypted_public_key);

    (cipher, response_buf)
  }

  fn welcome(cmd_val:u8, data_buf:&mut [u8], local_session_public:[u8; 32], local_session_private:[u8; 32], local_uuid:String, local_public_key:String, local_permanent_private:[u8; 32]) -> Option<(String, DataObject, Aes256, Vec<u8>)> {
    let (session_cipher, response_bytes) = helo(cmd_val, data_buf, local_session_public, local_session_private, local_uuid, local_public_key);

    let remote_uuid_encrypted: [u8; 48] = data_buf[33..81].try_into().unwrap();
    let mut remote_uuid_decrypted = decrypt(&session_cipher, &remote_uuid_encrypted);
    remote_uuid_decrypted.resize(36,0);
    let remote_uuid_str = String::from_utf8(remote_uuid_decrypted).unwrap();

    let mut ok = true;
    let user_opt = get_user(&remote_uuid_str);
    if user_opt.is_some() {
      let mut user_data = user_opt.unwrap();
      let remote_public_key_encrypted = &data_buf[81..113];
      let remote_public_key_decrypted = decrypt(&session_cipher, remote_public_key_encrypted);
      let peer_public_key_arr: [u8; 32];
      if user_data.has("publickey") {
        peer_public_key_arr = decode_hex(&user_data.get_string("publickey")).unwrap().try_into().unwrap();
        if peer_public_key_arr.to_vec() != remote_public_key_decrypted { ok = false; }
      }
      else {
        peer_public_key_arr = remote_public_key_decrypted.try_into().unwrap();
        let hex_pub_key = to_hex(&peer_public_key_arr);
        user_data.put_string("publickey", &hex_pub_key);
        set_user(&remote_uuid_str, user_data.clone());
      }
      if ok {
        let permanent_shared_secret = x25519(local_permanent_private, peer_public_key_arr);
        let permanent_key = GenericArray::from(permanent_shared_secret);
        let permanent_cipher = Aes256::new(&permanent_key);

        return Some((remote_uuid_str, user_data, permanent_cipher, response_bytes));
      }
      else { println!("BAD PUB KEY GIVEN {} / {}", to_hex(&peer_public_key_arr), to_hex(&data_buf[81..113])); }
    }
    None
  }

  let sessiontimeoutmillis = system.get_object("config").get_int("sessiontimeoutmillis");
  while system.get_boolean("running") {
    let sock = {
        // udp_guard does not need to be mut
        let udp_guard = UDPCON.lock();
        udp_guard.try_clone().unwrap()
    };

    let (amt, src) = sock.recv_from(&mut recv_buf).unwrap();
    let current_packet_buf = &mut recv_buf[..amt];
    let cmd = current_packet_buf[0];
    match cmd {
      HELO => {
        let mut d = DataObject::new();
        d.put_string("addr", &src.to_string());
        d.put_int("len", amt as i64);
        fire_event("peer", "UDP_REQUEST_RECEIVED", d);
        if amt == 33 {
          let (_cipher, helo_response_buf) = helo(WELCOME, current_packet_buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned());
          sock.send_to(&helo_response_buf, &src).unwrap();
        }
      },
      WELCOME => {
        if amt == 113 {
          let res = welcome(YO, current_packet_buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private_arr.to_owned());
          if res.is_some(){
            let (_uuid, _user, cipher, mut welcome_response_buf) = res.unwrap();

            let encrypted_proof = encrypt(&cipher, "What's good, yo?".as_bytes());
            welcome_response_buf.extend_from_slice(&encrypted_proof);
            sock.send_to(&welcome_response_buf, &src).unwrap();
          }
        }
      },
      YO => {
        if amt == 129 {
          let res = welcome(SUP, current_packet_buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private_arr.to_owned());
          if res.is_some(){
            let (uuid, _user, cipher, yo_response_buf) = res.unwrap();

            let proof_bytes = decrypt(&cipher, &current_packet_buf[113..129]);
            let s = String::from_utf8(proof_bytes).unwrap();
            if &s != "What's good, yo?" {
              println!("Bad crypto {}", s);
            }
            else {
              let mut final_yo_response_buf = yo_response_buf;
              let encrypted_final_proof = encrypt(&cipher, "All is good now!".as_bytes());
              final_yo_response_buf.extend_from_slice(&encrypted_final_proof);

              let (conid, _con) = P2PConnection::begin(uuid, P2PStream::Udp(UdpStream::blank(src)));
              final_yo_response_buf.extend_from_slice(&conid.to_be_bytes());
              sock.send_to(&final_yo_response_buf, &src).unwrap();
            }
          }
        }
      },
      SUP => {
        if amt == 137 {
          let res = welcome(RDY, current_packet_buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private_arr.to_owned());
          if res.is_some(){
            let (uuid, mut user, cipher, sup_response_buf) = res.unwrap();

            let proof_bytes = decrypt(&cipher, &current_packet_buf[113..129]);
            let s = String::from_utf8(proof_bytes).unwrap();
            if &s != "All is good now!" {
              println!("Bad crypto {}", s);
            }
            else {
              let remote_id_bytes:[u8; 8] = current_packet_buf[129..137].try_into().unwrap();
              let remote_id = i64::from_be_bytes(remote_id_bytes);

              let stream = UdpStream::new(src, remote_id);
              let (conid, con_obj) = P2PConnection::begin(uuid, P2PStream::Udp(stream.duplicate()));

              let mut final_sup_response_buf = sup_response_buf;
              final_sup_response_buf.extend_from_slice(&remote_id.to_be_bytes());
              final_sup_response_buf.extend_from_slice(&conid.to_be_bytes());
              sock.send_to(&final_sup_response_buf, &src).unwrap();

              let con_clone_handler = con_obj.duplicate();
              thread::spawn(move || {
                handle_connection(conid, con_clone_handler);
              });

              let stream_clone_mtu = stream.duplicate();
              thread::spawn(move || {
                stream_clone_mtu.upgrade_mtu();
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
          let res = welcome(RDY, current_packet_buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private_arr.to_owned());
          if res.is_some(){
            let (_uuid, mut user, _cipher, _rdy_response_buf) = res.unwrap();
            let id_bytes:[u8; 8] = current_packet_buf[113..121].try_into().unwrap();
            let id = i64::from_be_bytes(id_bytes);
            let con_opt = P2PConnection::try_get(id);
            if con_opt.is_some() {
              let con_obj = con_opt.unwrap().duplicate();
              if let P2PStream::Udp(ref stream_ref) = con_obj.stream {
                if stream_ref.src == src {
                  let mut stream_mut = stream_ref.duplicate();

                  let remote_id_bytes:[u8; 8] = current_packet_buf[121..129].try_into().unwrap();
                  let remote_id = i64::from_be_bytes(remote_id_bytes);
                  stream_mut.set_id(remote_id);

                  let con_clone_handler = con_obj.duplicate();
                  thread::spawn(move || {
                    handle_connection(id, con_clone_handler);
                  });

                  let stream_clone_mtu = stream_mut.duplicate();
                  thread::spawn(move || {
                    stream_clone_mtu.upgrade_mtu();
                  });

                  let p2pport = src.port();
                  let ipaddr = src.ip().to_string();
                  user.put_int("port", p2pport as i64);
                  user.put_int("p2pport", p2pport as i64);
                  user.put_string("address", &ipaddr);
                }
                else { println!("Received RDY from wrong source"); }
              }
            }
          }
        }
      },
      CMD => {
        let id_bytes: [u8; 8] = current_packet_buf[1..9].try_into().unwrap();
        let id = i64::from_be_bytes(id_bytes);
        let msg_id_bytes: [u8; 8] = current_packet_buf[9..17].try_into().unwrap();
        let msg_id = i64::from_be_bytes(msg_id_bytes);
        let cmd_payload_buf = &current_packet_buf[17..];

        let con_opt = P2PConnection::try_get(id);
        if con_opt.is_some() {
          let mut con_obj = con_opt.unwrap();
          if let P2PStream::Udp(stream_mut_ref) = &mut con_obj.stream {
            if stream_mut_ref.src == src {
              let mut stream_instance = stream_mut_ref.duplicate();

              let now = time();
              stream_instance.data.put_int("last_contact", now);
              system.get_object("sessions").get_object(&con_obj.sessionid).put_int("expire", now + sessiontimeoutmillis);

              {
                let _read_lock = READMUTEX.lock();
                let in_off = stream_instance.data.get_int("in_off");
                let mut inv = stream_instance.data.get_array("in");

                let i = msg_id - in_off;
                if i < 0 {
                  println!("Ignoring resend of msg {} on udp connection {}", msg_id, id);
                }
                else if i > MAXPACKETCOUNT as i64 {
                  println!("Too many packets... Ignoring msg {} on udp connection {}", msg_id, id);
                }
                else {
                  while (inv.len() as i64) < i { inv.push_property(Data::DNull); }

                  let db = DataBytes::from_bytes(&cmd_payload_buf.to_vec());
                  if (inv.len() as i64) == i { inv.push_bytes(db); }
                  else {
                    if !inv.get_property(i as usize).is_null(){
                      println!("Duplicate of msg {} on udp connection {}", msg_id, id);
                    }
                    inv.put_bytes(i as usize, db);
                  }

                  let mut i_ack = 0;
                  while i_ack < inv.len() {
                    if Data::equals(inv.get_property(i_ack), Data::DNull) { break; }
                    i_ack += 1;
                  }
                  if i_ack > 0 {
                    let ack_msg_id = (i_ack as i64) + in_off - 1;
                    let stream_id = stream_instance.data.get_int("id");

                    let mut ack_bytes = Vec::new();
                    ack_bytes.push(ACK);
                    ack_bytes.extend_from_slice(&stream_id.to_be_bytes());
                    ack_bytes.extend_from_slice(&ack_msg_id.to_be_bytes());
                    sock.send_to(&ack_bytes, &src).unwrap();
                  }
                }
              }
            }
            else { println!("Received CMD from wrong source"); }
          }
        }
      },
      ACK => {
        let id_bytes: [u8; 8] = current_packet_buf[1..9].try_into().unwrap();
        let id = i64::from_be_bytes(id_bytes);
        let msg_id_bytes: [u8; 8] = current_packet_buf[9..17].try_into().unwrap();
        let msg_id = i64::from_be_bytes(msg_id_bytes);

        let con_opt = P2PConnection::try_get(id);
        if con_opt.is_some() {
          let mut con_obj = con_opt.unwrap();
          if let P2PStream::Udp(stream_mut_ref) = &mut con_obj.stream {
            if stream_mut_ref.src == src {
              {
                let _write_lock = WRITEMUTEX.lock();
                let mut out_off = stream_mut_ref.data.get_int("out_off");
                let mut out = stream_mut_ref.data.get_array("out");

                let n = msg_id - out_off;
                let mut i_remove = 0;
                while i_remove <= n {
                  if out.len() > 0 {
                    out.remove_property(0);
                  }
                  out_off += 1;
                  i_remove += 1;
                }
                stream_mut_ref.data.put_int("out_off", out_off);
              }
            }
            else { println!("Received ACK from wrong source"); }
          }
        }
      },
      RESEND => {
        let id_bytes: [u8; 8] = current_packet_buf[1..9].try_into().unwrap();
        let id = i64::from_be_bytes(id_bytes);
        let msg_id_bytes: [u8; 8] = current_packet_buf[9..17].try_into().unwrap();
        let msg_id = i64::from_be_bytes(msg_id_bytes);
        let last_bytes: [u8; 8] = current_packet_buf[17..25].try_into().unwrap();
        let last = i64::from_be_bytes(last_bytes);

        let con_opt = P2PConnection::try_get(id);
        if con_opt.is_some() {
          let mut con_obj = con_opt.unwrap();
          if let P2PStream::Udp(stream_ref) = &mut con_obj.stream {
            if stream_ref.src == src {
              {
                let _write_lock = WRITEMUTEX.lock();
                let out_off = stream_ref.data.get_int("out_off");
                let out = stream_ref.data.get_array("out");

                let mut n = msg_id - out_off;
                if n<0 {
                  println!("Ignoring request for resend of msg {} on udp connection {}", msg_id, id);
                }
                else {
                  let stop = last - out_off;
                  println!("Resending msg {} to {} on udp connection {}", msg_id, last, id);
                  while n <= stop {
                    if n >=0 && (n as usize) < out.len() {
                      let bytes_to_resend = out.get_bytes(n as usize);
                      sock.send_to(&bytes_to_resend.get_data(), &src).unwrap();
                    } else {
                        println!("Packet {} not available for resend. out_off: {}, out.len(): {}", n + out_off, out_off, out.len());
                    }
                    n += 1;
                  }
                }
              }
            }
            else { println!("Received RESEND from wrong source"); }
          }
        }
      },
      EXTEND_MTU => {
        let id_bytes: [u8; 8] = current_packet_buf[1..9].try_into().unwrap();
        let id = i64::from_be_bytes(id_bytes);
        let con_opt = P2PConnection::try_get(id);
        if con_opt.is_some() {
          let mut con_obj = con_opt.unwrap();
          if let P2PStream::Udp(stream_mut_ref) = &mut con_obj.stream {
            if stream_mut_ref.src == src {
              let mtu = stream_mut_ref.data.get_int("mtu");
              if mtu < amt as i64 {
                stream_mut_ref.data.put_int("mtu", amt as i64);
              }
            }
          }
        }
      },
      _ => {
        println!("Unknown UDP command {} len {}", cmd, current_packet_buf.len());
      },
    }
  }