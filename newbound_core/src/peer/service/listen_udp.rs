use ndata::dataobject::DataObject;
use std::io;
use std::net::UdpSocket;
use flowlang::datastore::DataStore;
use crate::peer::service::listen::decode_hex;
use aes::Aes256;
use crate::peer::service::listen::encrypt;
use aes::cipher::KeyInit;
use aes::cipher::generic_array::GenericArray;
use std::sync::Once;
use ndata::sharedmutex::GlobalSharedMutex; 
use crate::peer::service::listen::decrypt;
use crate::peer::service::listen::to_hex;
use crate::peer::service::listen::P2PConnection;
use crate::peer::service::listen::P2PStream;
use std::net::SocketAddr;
use std::thread;
use std::time::Duration;
use flowlang::flowlang::system::time::time;
use std::io::{Error, ErrorKind};
use crate::peer::service::listen::handle_connection;
use crate::security::security::init::{get_user, set_user};
use flowlang::appserver::fire_event;
use flowlang::x25519::*;
use flowlang::rand::fill_bytes;
use std::sync::{Arc, Mutex, Condvar};
use std::collections::BTreeMap;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["ipaddr", "port"] {
        if !o.has(p) {
            let mut e = DataObject::new();
            e.put_string("status", "err");
            e.put_string("msg", &format!("missing required parameter: {}", p));
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", e);
            return result_obj;
        }
    }
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        let arg_0: String = o.get_string("ipaddr");
        let arg_1: i64 = o.get_int("port");
        listen_udp(arg_0, arg_1)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_int("a", ax);
            result_obj
        }
        Err(err) => {
            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");

            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic occurred".to_string()
            };

            err_obj.put_string("msg", &msg);
            // Wrapped in the same `a` envelope a successful return uses.
            // Unwrapped, callers that unpack the envelope (newbound's
            // format_result, for one) report an opaque 500 — "Not an object:
            // DString(\"err\")" — instead of this message.
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", err_obj);
            result_obj
        }
    }
}

pub fn listen_udp(ipaddr: String, port: i64) -> i64 {
	let socket_address = format!("{}:{}", ipaddr, port);
    START.call_once(|| {
        UDPCON.init(UdpSocket::bind(socket_address).unwrap());
        println!("P2P UDP listening on port {}", port);
    });
    do_listen();
    port
}

static START: Once = Once::new();
pub static UDPCON: GlobalSharedMutex<UdpSocket> = GlobalSharedMutex::new();

const HELO: u8 = 0;
const WELCOME: u8 = 1;
const YO: u8 = 2;
const SUP: u8 = 3;
const RDY: u8 = 4;
const CMD: u8 = 5;
const ACK: u8 = 6;
const RESEND: u8 = 7;
const EXTEND_MTU: u8 = 8;

const MAXPACKETCOUNT: u16 = 1000;
const MAXPACKETSIZE: usize = 65024;
const PACKETHEADERSIZE: u16 = 17;
const MTU_SIZES: [u16; 7] = [1016, 2032, 4064, 8128, 16256, 32512, 65024];

#[derive(Debug)]
pub struct UdpStreamState {
    pub id: i64,
    pub in_off: i64,
    pub out_off: i64,
    pub next: i64,
    pub in_buffer: BTreeMap<i64, Vec<u8>>,
    pub out_buffer: BTreeMap<i64, Vec<u8>>,
    pub dead: bool,
    pub last_contact: i64,
    pub mtu: u16,
    pub hold: Option<Vec<Vec<u8>>>,
}

#[derive(Clone, Debug)]
pub struct UdpStream {
    pub src: SocketAddr,
    pub state: Arc<(Mutex<UdpStreamState>, Condvar)>,
}

impl UdpStream {
    pub fn new(src: SocketAddr, remote_id: i64) -> Self {
        let state = UdpStreamState {
            id: remote_id,
            in_off: 0,
            out_off: 0,
            next: 0,
            in_buffer: BTreeMap::new(),
            out_buffer: BTreeMap::new(),
            dead: false,
            last_contact: time(),
            mtu: 508,
            hold: if remote_id == -1 { Some(Vec::new()) } else { None },
        };
        UdpStream {
            src,
            state: Arc::new((Mutex::new(state), Condvar::new())),
        }
    }

    pub fn blank(src: SocketAddr) -> Self {
        UdpStream::new(src, -1)
    }

    pub fn duplicate(&self) -> UdpStream {
        self.clone()
    }
    
    pub fn shutdown(&self) {
        let (lock, cvar) = &*self.state;
        let mut state = lock.lock().unwrap();
        state.dead = true;
        cvar.notify_all();
    }

    pub fn set_id(&mut self, id: i64) {
        let (lock, _cvar) = &*self.state;
        let mut state = lock.lock().unwrap();
        state.id = id;

        if let Some(hold) = state.hold.take() {
            drop(state); // Drop lock before calling write
            for buf in hold {
                let _ = self.write(&buf);
            }
        }
    }

    pub fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let (lock, _cvar) = &*self.state;
        let mut state = lock.lock().unwrap();

        if state.dead { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }

        let id = state.id;
        if id == -1 {
            if let Some(ref mut hold) = state.hold {
                hold.push(buf.to_vec());
            } else {
                state.hold = Some(vec![buf.to_vec()]);
            }
        } else {
            let mut msgid = state.next;
            let mtu = state.mtu;
            let blocks: Vec<&[u8]> = buf.chunks((mtu as usize) - (PACKETHEADERSIZE as usize)).collect();
            
            for chunk_buf in blocks {
                let mut bytes_payload = Vec::with_capacity(chunk_buf.len() + PACKETHEADERSIZE as usize);
                bytes_payload.push(CMD);
                bytes_payload.extend_from_slice(&id.to_be_bytes());
                bytes_payload.extend_from_slice(&msgid.to_be_bytes());
                bytes_payload.extend_from_slice(chunk_buf);
                
                state.out_buffer.insert(msgid, bytes_payload.clone());
                UDPCON.lock().send_to(&bytes_payload, self.src).unwrap();
                msgid += 1;
            }
            state.next = msgid;
        }
        Ok(buf.len())
    }

    pub fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
        let (lock, cvar) = &*self.state;
        let mut state = lock.lock().unwrap();

        if state.dead { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }

        let len = buf.len();
        let mut i = 0;

        while i < len {
            let mut in_off = state.in_off;
            
            while !state.in_buffer.contains_key(&in_off) && !state.dead {
                self.request_resend(&state);
                let result = cvar.wait_timeout(state, Duration::from_millis(450)).unwrap();
                state = result.0;
                in_off = state.in_off; // Re-evaluate in_off
            }

            if state.dead { return Err(Error::new(ErrorKind::ConnectionReset, "Connection closed")); }

            let is_fully_consumed = if let Some(packet) = state.in_buffer.get_mut(&in_off) {
                let bytes_remaining = packet.len();
                let bytes_to_copy = std::cmp::min(bytes_remaining, len - i);

                buf[i..i + bytes_to_copy].copy_from_slice(&packet[0..bytes_to_copy]);
                i += bytes_to_copy;

                if bytes_to_copy == bytes_remaining {
                    true
                } else {
                    packet.drain(0..bytes_to_copy);
                    false
                }
            } else { false };
            
            // Rust Borrow Checker fix: Separate map mutation from value mutation
            if is_fully_consumed {
                state.in_buffer.remove(&in_off);
                state.in_off += 1;
            }
        }
        Ok(())
    }

    fn request_resend(&self, state: &UdpStreamState) {
        if state.dead { return; }
        
        let msgid = state.in_off;
        let mut last = msgid;
        
        while !state.in_buffer.contains_key(&last) && last < msgid + 50 { 
            last += 1;
        }
        
        let id = state.id;
        let mut bytes_to_send = Vec::with_capacity(25);
        bytes_to_send.push(RESEND);
        bytes_to_send.extend_from_slice(&id.to_be_bytes());
        bytes_to_send.extend_from_slice(&msgid.to_be_bytes());
        bytes_to_send.extend_from_slice(&last.to_be_bytes());
        
        UDPCON.lock().send_to(&bytes_to_send, self.src).unwrap();
    }

    pub fn last_contact(&self) -> i64 {
        let (lock, _) = &*self.state;
        lock.lock().unwrap().last_contact
    }

    pub fn upgrade_mtu(&self) {
        let id = {
            let (lock, _) = &*self.state;
            lock.lock().unwrap().id
        };
        
        let beat = Duration::from_millis(1000);
        for size in MTU_SIZES {
            let mut bytes_to_send = Vec::with_capacity(size as usize);
            bytes_to_send.push(EXTEND_MTU);
            bytes_to_send.extend_from_slice(&id.to_be_bytes());

            let mut vec = vec![0u8; (size - 9) as usize];
            fill_bytes(&mut vec);
            bytes_to_send.extend_from_slice(&vec);
            
            UDPCON.lock().send_to(&bytes_to_send, self.src).unwrap();
            thread::sleep(beat);
        }
    }
}

fn do_listen() {
    let mut system = DataStore::globals().get_object("system");
    let runtime = system.get_object("apps").get_object("app").get_object("runtime");
    let my_uuid = runtime.get_string("uuid");

    let my_public = runtime.get_string("publickey");
    let my_private_hex = runtime.get_string("privatekey");
    let my_private_vec = decode_hex(&my_private_hex).unwrap();
    let my_private_arr: [u8; 32] = my_private_vec.try_into().expect("slice with incorrect length");

    let (my_session_private, my_session_public) = generate_x25519_keypair();
    
    system.put_bytes("session_pubkey", ndata::databytes::DataBytes::from_bytes(&my_session_public.to_vec()));
    
    let mut recv_buf = [0; MAXPACKETSIZE];

    fn helo(cmd_val: u8, data_buf: &[u8], local_session_public: [u8; 32], local_session_private: [u8; 32], local_uuid: String, local_public_key: String) -> (Aes256, Vec<u8>) {
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

    fn welcome(cmd_val: u8, data_buf: &[u8], local_session_public: [u8; 32], local_session_private: [u8; 32], local_uuid: String, local_public_key: String, local_permanent_private: [u8; 32]) -> Option<(String, DataObject, Aes256, Vec<u8>)> {
        let (session_cipher, response_bytes) = helo(cmd_val, data_buf, local_session_public, local_session_private, local_uuid, local_public_key);
        
        let remote_uuid_encrypted: [u8; 48] = data_buf[33..81].try_into().unwrap();
        let mut remote_uuid_decrypted = decrypt(&session_cipher, &remote_uuid_encrypted);
        remote_uuid_decrypted.resize(36, 0);
        let remote_uuid_str = String::from_utf8(remote_uuid_decrypted).unwrap();
        
        let mut ok = true;
        if let Some(mut user_data) = get_user(&remote_uuid_str) {
            let remote_public_key_encrypted = &data_buf[81..113];
            let remote_public_key_decrypted = decrypt(&session_cipher, remote_public_key_encrypted);
            let peer_public_key_arr: [u8; 32];
            
            if user_data.has("publickey") {
                peer_public_key_arr = decode_hex(&user_data.get_string("publickey")).unwrap().try_into().unwrap();
                if peer_public_key_arr.to_vec() != remote_public_key_decrypted { ok = false; }
            } else {
                peer_public_key_arr = remote_public_key_decrypted.try_into().unwrap();
                user_data.put_string("publickey", &to_hex(&peer_public_key_arr));
                set_user(&remote_uuid_str, user_data.clone());
            }
            if ok {
                let permanent_shared_secret = x25519(local_permanent_private, peer_public_key_arr);
                let permanent_key = GenericArray::from(permanent_shared_secret);
                let permanent_cipher = Aes256::new(&permanent_key);
                return Some((remote_uuid_str, user_data, permanent_cipher, response_bytes));
            } else {
                println!("BAD PUB KEY GIVEN");
            }
        }
        None
    }

    let sessiontimeoutmillis = system.get_object("config").get_int("sessiontimeoutmillis");

    // Single try_clone for the blocking recv_from loop to prevent deadlocking outgoing writes
    let sock = { 
        let udp_guard = UDPCON.lock();
        udp_guard.try_clone().unwrap()
    };

    while system.get_boolean("running") {
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
                    UDPCON.lock().send_to(&helo_response_buf, src).unwrap();
                }
            },
            WELCOME => {
                if amt == 113 {
                    if let Some((_uuid, _user, cipher, mut welcome_response_buf)) = welcome(YO, current_packet_buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private_arr.to_owned()) {
                        let encrypted_proof = encrypt(&cipher, b"What's good, yo?");
                        welcome_response_buf.extend_from_slice(&encrypted_proof);
                        UDPCON.lock().send_to(&welcome_response_buf, src).unwrap();
                    }
                }
            },
            YO => {
                if amt == 129 {
                    if let Some((uuid, _user, cipher, yo_response_buf)) = welcome(SUP, current_packet_buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private_arr.to_owned()) {
                        let proof_bytes = decrypt(&cipher, &current_packet_buf[113..129]);
                        if let Ok(s) = String::from_utf8(proof_bytes) {
                            if s == "What's good, yo?" {
                                let mut final_yo_response_buf = yo_response_buf;
                                let encrypted_final_proof = encrypt(&cipher, b"All is good now!");
                                final_yo_response_buf.extend_from_slice(&encrypted_final_proof);

                                let (conid, _con) = P2PConnection::begin(uuid, P2PStream::Udp(UdpStream::blank(src)));
                                final_yo_response_buf.extend_from_slice(&conid.to_be_bytes());
                                UDPCON.lock().send_to(&final_yo_response_buf, src).unwrap();
                            }
                        }
                    }
                }
            },
            SUP => {
                if amt == 137 {
                    if let Some((uuid, mut user, cipher, sup_response_buf)) = welcome(RDY, current_packet_buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private_arr.to_owned()) {
                        let proof_bytes = decrypt(&cipher, &current_packet_buf[113..129]);
                        if let Ok(s) = String::from_utf8(proof_bytes) {
                            if s == "All is good now!" {
                                let remote_id_bytes: [u8; 8] = current_packet_buf[129..137].try_into().unwrap();
                                let remote_id = i64::from_be_bytes(remote_id_bytes);

                                let stream = UdpStream::new(src, remote_id);
                                let (conid, con_obj) = P2PConnection::begin(uuid, P2PStream::Udp(stream.duplicate()));
                                
                                let mut final_sup_response_buf = sup_response_buf;
                                final_sup_response_buf.extend_from_slice(&remote_id.to_be_bytes());
                                final_sup_response_buf.extend_from_slice(&conid.to_be_bytes());
                                UDPCON.lock().send_to(&final_sup_response_buf, src).unwrap();

                                let con_clone_handler = con_obj.duplicate();
                                thread::spawn(move || { handle_connection(conid, con_clone_handler); });
                                
                                let stream_clone_mtu = stream.duplicate();
                                thread::spawn(move || { stream_clone_mtu.upgrade_mtu(); });

                                user.put_int("port", src.port() as i64);
                                user.put_int("p2pport", src.port() as i64);
                                user.put_string("address", &src.ip().to_string());
                            }
                        }
                    }
                }
            },
            RDY => {
                if amt == 129 {
                    if let Some((_uuid, mut user, _cipher, _rdy_response_buf)) = welcome(RDY, current_packet_buf, my_session_public, my_session_private.to_owned(), my_uuid.to_owned(), my_public.to_owned(), my_private_arr.to_owned()) {
                        let id_bytes: [u8; 8] = current_packet_buf[113..121].try_into().unwrap();
                        let id = i64::from_be_bytes(id_bytes);
                        
                        if let Some(con_obj) = P2PConnection::try_get(id) {
                            if let P2PStream::Udp(ref stream_ref) = con_obj.stream {
                                if stream_ref.src == src {
                                    let mut stream_mut = stream_ref.duplicate();
                                    let remote_id_bytes: [u8; 8] = current_packet_buf[121..129].try_into().unwrap();
                                    stream_mut.set_id(i64::from_be_bytes(remote_id_bytes));

                                    let con_clone_handler = con_obj.duplicate();
                                    thread::spawn(move || { handle_connection(id, con_clone_handler); });

                                    let stream_clone_mtu = stream_mut.duplicate();
                                    thread::spawn(move || { stream_clone_mtu.upgrade_mtu(); });

                                    user.put_int("port", src.port() as i64);
                                    user.put_int("p2pport", src.port() as i64);
                                    user.put_string("address", &src.ip().to_string());
                                }
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

                if let Some(mut con_obj) = P2PConnection::try_get(id) {
                    if let P2PStream::Udp(stream_mut_ref) = &mut con_obj.stream {
                        if stream_mut_ref.src == src {
                            let now = time();
                            system.get_object("sessions").get_object(&con_obj.sessionid).put_int("expire", now + sessiontimeoutmillis);
                            
                            let (lock, cvar) = &*stream_mut_ref.state;
                            let mut state = lock.lock().unwrap();
                            state.last_contact = now;

                            let in_off = state.in_off;

                            if msg_id >= in_off && msg_id <= in_off + MAXPACKETCOUNT as i64 {
                                if !state.in_buffer.contains_key(&msg_id) {
                                    state.in_buffer.insert(msg_id, cmd_payload_buf.to_vec());
                                    cvar.notify_all(); // Wake up any pending read_exact
                                }

                                // Evaluate contiguous block for ACK
                                let mut ack_msg_id = in_off - 1;
                                while state.in_buffer.contains_key(&(ack_msg_id + 1)) {
                                    ack_msg_id += 1;
                                }

                                if ack_msg_id >= in_off {
                                    let mut ack_bytes = Vec::with_capacity(17);
                                    ack_bytes.push(ACK);
                                    ack_bytes.extend_from_slice(&state.id.to_be_bytes());
                                    ack_bytes.extend_from_slice(&ack_msg_id.to_be_bytes());
                                    UDPCON.lock().send_to(&ack_bytes, src).unwrap();
                                }
                            }
                        }
                    }
                }
            },
            ACK => {
                let id_bytes: [u8; 8] = current_packet_buf[1..9].try_into().unwrap();
                let id = i64::from_be_bytes(id_bytes);
                let msg_id_bytes: [u8; 8] = current_packet_buf[9..17].try_into().unwrap();
                let msg_id = i64::from_be_bytes(msg_id_bytes);

                if let Some(mut con_obj) = P2PConnection::try_get(id) {
                    if let P2PStream::Udp(stream_mut_ref) = &mut con_obj.stream {
                        if stream_mut_ref.src == src {
                            let (lock, _) = &*stream_mut_ref.state;
                            let mut state = lock.lock().unwrap();

                            // Cleanup contiguous out_buffer packets now that they're ACKed
                            let keys_to_remove: Vec<i64> = state.out_buffer.keys()
                                .filter(|&&k| k <= msg_id)
                                .copied()
                                .collect();
                            
                            for k in keys_to_remove {
                                state.out_buffer.remove(&k);
                            }
                            state.out_off = std::cmp::max(state.out_off, msg_id + 1);
                        }
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

                if let Some(mut con_obj) = P2PConnection::try_get(id) {
                    if let P2PStream::Udp(stream_ref) = &mut con_obj.stream {
                        if stream_ref.src == src {
                            let (lock, _) = &*stream_ref.state;
                            let state = lock.lock().unwrap();

                            for n in msg_id..=last {
                                if let Some(bytes_to_resend) = state.out_buffer.get(&n) {
                                    UDPCON.lock().send_to(bytes_to_resend, src).unwrap();
                                }
                            }
                        }
                    }
                }
            },
            EXTEND_MTU => {
                let id_bytes: [u8; 8] = current_packet_buf[1..9].try_into().unwrap();
                let id = i64::from_be_bytes(id_bytes);
                if let Some(mut con_obj) = P2PConnection::try_get(id) {
                    if let P2PStream::Udp(stream_mut_ref) = &mut con_obj.stream {
                        if stream_mut_ref.src == src {
                            let (lock, _) = &*stream_mut_ref.state;
                            let mut state = lock.lock().unwrap();
                            if (state.mtu as usize) < amt {
                                state.mtu = amt as u16;
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
}
