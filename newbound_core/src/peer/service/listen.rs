use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use std::num::ParseIntError;
use std::net::TcpStream;
use std::io::Read;
use std::io::Write;
use std::thread;
use std::sync::Once;
use std::net::TcpListener;
use ndata::data::*;
use flowlang::datastore::DataStore;
use flowlang::flowlang::system::unique_session_id::unique_session_id;
use flowlang::aes::Aes256;
use flowlang::flowlang::system::time::time;
use flowlang::flowlang::file::write_properties::write_properties;
use crate::app::service::init::handle_command;
use flowlang::appserver::fire_event;
use crate::peer::peer::peers::user_to_peer;
use std::io;
use std::net::SocketAddr;
use ndata::databytes::DataBytes;
use crate::peer::service::listen_udp::UdpStream; 
use std::net::Shutdown;
use std::time::Duration;
use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::fs;
use crate::security::security::init::get_user;
use crate::security::security::init::set_user;
use core::sync::atomic::{AtomicPtr, Ordering as AtomicOrdering, AtomicUsize, AtomicI64}; 
use std::fmt;
use flowlang::x25519::*;
use flowlang::rand::*;
use std::sync::{Arc, Mutex, Condvar};

use ndata::sharedmutex::SharedMutex;

use std::sync::atomic::AtomicBool;
use std::panic::{catch_unwind, AssertUnwindSafe};
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
        listen(arg_0, arg_1)
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

pub fn listen(ipaddr: String, port: i64) -> i64 {
do_init();
    do_listen(ipaddr, port)
}

#[derive(Debug)]
pub enum P2PError {
    Io(io::Error),
    Crypto(String),
    Logic(String),
    NotFound(String), 
}

impl fmt::Display for P2PError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            P2PError::Io(e) => write!(f, "IO error: {}", e),
            P2PError::Crypto(s) => write!(f, "Crypto error: {}", s),
            P2PError::Logic(s) => write!(f, "Logic error: {}", s),
            P2PError::NotFound(s) => write!(f, "Not found: {}", s),
        }
    }
}

impl std::error::Error for P2PError {}

impl From<io::Error> for P2PError {
    fn from(err: io::Error) -> P2PError {
        P2PError::Io(err)
    }
}

const GLOBAL_UNINITIALIZED: usize = 0;
const GLOBAL_INITIALIZING: usize = 1;
const GLOBAL_INITIALIZED: usize = 2;

#[derive(Debug)]
struct GlobalSharedMutex<T: Send> {
    state: AtomicUsize, 
    ptr: AtomicPtr<SharedMutex<T>>, 
}

impl<T: Send> GlobalSharedMutex<T> {
    const fn new() -> Self {
        GlobalSharedMutex {
            state: AtomicUsize::new(GLOBAL_UNINITIALIZED),
            ptr: AtomicPtr::new(std::ptr::null_mut()),
        }
    }

    fn initialize(&self, initial_data: T) {
        match self.state.compare_exchange(GLOBAL_UNINITIALIZED, GLOBAL_INITIALIZING, AtomicOrdering::Acquire, AtomicOrdering::Relaxed) {
            Ok(_) => { 
                let new_sm = SharedMutex::new();
                let mut boxed_sm = Box::new(new_sm);
                boxed_sm.set(initial_data);
                self.ptr.store(Box::into_raw(boxed_sm), AtomicOrdering::Release);
                self.state.store(GLOBAL_INITIALIZED, AtomicOrdering::Release); 
            }
            Err(current_state) => {
                if current_state == GLOBAL_INITIALIZING {
                    while self.state.load(AtomicOrdering::Acquire) == GLOBAL_INITIALIZING {
                        std::hint::spin_loop();
                    }
                }
            }
        }
    }

    fn get(&self) -> &SharedMutex<T> {
        loop {
            match self.state.load(AtomicOrdering::Acquire) {
                GLOBAL_INITIALIZED => {
                    let ptr = self.ptr.load(AtomicOrdering::Acquire);
                    return unsafe { &*ptr };
                }
                GLOBAL_INITIALIZING => std::hint::spin_loop(),
                _ => panic!("[GLOBAL_INIT] GlobalSharedMutex not initialized"),
            }
        }
    }
}

unsafe impl<T: Send> Sync for GlobalSharedMutex<T> {}
unsafe impl<T: Send> Send for GlobalSharedMutex<T> {}

static INIT_GLOBALS_ONCE: Once = Once::new();

static P2PCONS: GlobalSharedMutex<HashMap<i64, P2PConnection>> = GlobalSharedMutex::new();
static STREAMWRITERS: GlobalSharedMutex<HashMap<i64, i64>> = GlobalSharedMutex::new();
static STREAMREADERS: GlobalSharedMutex<HashMap<i64, DataBytes>> = GlobalSharedMutex::new();
static STREAMCONTROL: GlobalSharedMutex<HashMap<i64, Arc<(Mutex<bool>, Condvar)>>> = GlobalSharedMutex::new();

pub const MAX_LEGACY_FRAME: usize = 16400;
pub const MAX_STREAM_PAYLOAD: usize = 16000;
const CHUNK_WIRE: usize = 15000;
const MAX_CHUNK_MESSAGE: usize = 16 * 1024 * 1024;

pub fn legacy_frame(cipher: &Aes256, plaintext: &[u8]) -> io::Result<Vec<u8>> {
    let encrypted = encrypt(cipher, plaintext);
    if encrypted.is_empty() || encrypted.len() > MAX_LEGACY_FRAME {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "P2P frame exceeds the legacy 16400-byte limit"));
    }
    let len = encrypted.len() as i16;
    let mut frame = len.to_be_bytes().to_vec();
    frame.extend_from_slice(&encrypted);
    Ok(frame)
}

fn send_legacy_frame(stream: &mut P2PStream, cipher: &Aes256, plaintext: &[u8], sid: String) -> io::Result<usize> {
    let frame = legacy_frame(cipher, plaintext)?;
    match stream.write(&frame, sid) {
        Ok(n) if n == frame.len() => Ok(n),
        Ok(_) => Err(io::Error::new(io::ErrorKind::WriteZero, "Incomplete P2P frame write")),
        Err(e) => Err(e),
    }
}

fn send_chunked(stream: &mut P2PStream, cipher: &Aes256, payload: &[u8], sid: String) -> io::Result<()> {
    if payload.len() > MAX_CHUNK_MESSAGE {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "P2P message exceeds the 16 MiB safety limit"));
    }
    let id = rand_i64();
    let total = ((payload.len() + CHUNK_WIRE - 1) / CHUNK_WIRE) as i64;
    for i in 0..total {
        let start = i as usize * CHUNK_WIRE;
        let end = (start + CHUNK_WIRE).min(payload.len());
        let mut p = Vec::with_capacity(32 + end - start);
        p.extend_from_slice(b"xfr ");
        p.extend_from_slice(&id.to_be_bytes());
        p.extend_from_slice(&i.to_be_bytes());
        p.extend_from_slice(&total.to_be_bytes());
        p.extend_from_slice(&((end - start) as u32).to_be_bytes());
        p.extend_from_slice(&payload[start..end]);
        send_legacy_frame(stream, cipher, &p, sid.clone())?;
    }
    Ok(())
}

fn do_init() {
    INIT_GLOBALS_ONCE.call_once(|| {
        P2PCONS.initialize(HashMap::new());
        STREAMWRITERS.initialize(HashMap::new());
        STREAMREADERS.initialize(HashMap::new());
        STREAMCONTROL.initialize(HashMap::new());
    });
}

#[derive(Debug, Clone)]
pub struct RelayStream {
    pub from: String,
    pub to: String,
    pub buf: Arc<(Mutex<VecDeque<Vec<u8>>>, Condvar)>,
    pub last_contact: Arc<AtomicI64>,
}

impl RelayStream {
    pub fn new(from: String, to: String) -> RelayStream {
        RelayStream {
            from,
            to,
            buf: Arc::new((Mutex::new(VecDeque::new()), Condvar::new())),
            last_contact: Arc::new(AtomicI64::new(time())),
        }
    }

    pub fn last_contact(&self) -> i64 {
        self.last_contact.load(AtomicOrdering::Relaxed)
    }
}

#[derive(Debug, Clone)]
pub enum P2PStream {
    Tcp(Arc<TcpStream>, Arc<Mutex<()>>),
    Relay(RelayStream, Arc<Mutex<()>>),
    Udp(UdpStream),
}

impl P2PStream {
    pub fn is_tcp(&self) -> bool {
        matches!(self, P2PStream::Tcp(_, _))
    }

    pub fn is_udp(&self) -> bool {
        matches!(self, P2PStream::Udp(_))
    }

    pub fn is_relay(&self) -> bool {
        matches!(self, P2PStream::Relay(_, _))
    }

    pub fn mode(&self) -> String {
        match self {
            P2PStream::Tcp(_, _) => "TCP".to_string(),
            P2PStream::Relay(_, _) => "RELAY".to_string(),
            P2PStream::Udp(_) => "UDP".to_string(),
        }
    }

    pub fn try_clone(&self) -> io::Result<P2PStream> {
        Ok(self.clone()) // Completely removes OS try_clone syscall bottlenecks!
    }

    pub fn write(&mut self, buf: &[u8], _sid: String) -> io::Result<usize> {
        let final_result: io::Result<usize>;
        
        match self {
            P2PStream::Tcp(stream, lock) => {
                let _guard = lock.lock().unwrap(); // Lock acquired inside the branch!
                let mut total_written = 0;
                let mut current_result: io::Result<usize> = Ok(0);
                let mut ref_stream = &**stream; 

                while total_written < buf.len() {
                    match ref_stream.write(&buf[total_written..]) {
                        Ok(0) => {
                            current_result = Err(io::Error::new(io::ErrorKind::WriteZero, "failed to write whole buffer to TCP stream (write zero)"));
                            break;
                        }
                        Ok(n) => total_written += n,
                        Err(ref e) if e.kind() == io::ErrorKind::Interrupted => continue,
                        Err(e) => {
                            current_result = Err(e);
                            break;
                        }
                    }
                }

                if current_result.is_ok() {
                    if total_written == buf.len() {
                        final_result = Ok(total_written);
                    } else {
                        final_result = Err(io::Error::new(io::ErrorKind::WriteZero, "failed to write whole buffer to TCP stream (incomplete write)"));
                    }
                } else {
                    final_result = current_result;
                }
            }
            P2PStream::Relay(stream_relay, lock) => {
                let _guard = lock.lock().unwrap(); // Lock acquired inside the branch!
                let from = &stream_relay.from.clone();
                let to = &stream_relay.to;

                let user_opt = get_user(&from);
                if user_opt.is_none() {
                    return Err(io::Error::new(io::ErrorKind::NotFound, format!("No such relay user {}", from)));
                }
                let user = user_opt.unwrap();

                let con_opt = get_tcp(user);
                if con_opt.is_none() {
                     return Err(io::Error::new(io::ErrorKind::NotConnected, format!("No TCP route to relay {}", from)));
                }

                let mut con = con_opt.unwrap();
                let cipher = con.cipher.clone();

                let mut bytes_to_send = ("fwd ".to_string() + &to).as_bytes().to_vec();
                let buf_len = buf.len() as i16;
                bytes_to_send.extend_from_slice(&buf_len.to_be_bytes());
                bytes_to_send.extend_from_slice(buf);

                let encrypted_buf = encrypt(&cipher, &bytes_to_send);
                let len = encrypted_buf.len() as i16;

                let mut final_bytes = len.to_be_bytes().to_vec();
                final_bytes.extend_from_slice(&encrypted_buf);

                final_result = con.stream.write(&final_bytes, con.sessionid.clone());
            }
            P2PStream::Udp(stream_udp) => {
                final_result = stream_udp.write(buf);
            }
        }
        final_result
    }

    pub fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
        match self {
            P2PStream::Tcp(stream, _) => {
                let mut ref_stream = &**stream;
                let mut offset = 0;
                while offset < buf.len() {
                    match ref_stream.read(&mut buf[offset..]) {
                        Ok(0) => return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "P2P TCP closed")),
                        Ok(n) => { offset += n; },
                        Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
                        Err(e) if e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::TimedOut => {
                            if offset > 0 { continue; }
                            return Err(e);
                        },
                        Err(e) => return Err(e),
                    }
                }
                Ok(())
            }
            P2PStream::Relay(stream, _) => {
                let len_to_read = buf.len();
                let mut total_bytes_read = 0;
                let (lock, cvar) = &*stream.buf;
                let mut queue = lock.lock().unwrap();

                while total_bytes_read < len_to_read {
                    while queue.is_empty() {
                        let result = cvar.wait_timeout(queue, Duration::from_millis(450)).unwrap();
                        queue = result.0;
                        if result.1.timed_out() && queue.is_empty() {
                            return Err(io::Error::new(io::ErrorKind::TimedOut, "Timeout waiting for relay data"));
                        }
                    }

                    if let Some(packet) = queue.front_mut() {
                        let bytes_to_copy = std::cmp::min(packet.len(), len_to_read - total_bytes_read);
                        buf[total_bytes_read .. total_bytes_read + bytes_to_copy].copy_from_slice(&packet[0..bytes_to_copy]);
                        total_bytes_read += bytes_to_copy;

                        if bytes_to_copy == packet.len() {
                            queue.pop_front();
                        } else {
                            packet.drain(0..bytes_to_copy);
                        }
                    }
                }
                Ok(())
            }
            P2PStream::Udp(stream) => {
                stream.read_exact(buf)
            }
        }
    }

    pub fn read_some(&self, buf: &mut [u8]) -> io::Result<usize> {
        match self {
            P2PStream::Tcp(stream, _) => {
                let mut stream = &**stream;
                stream.read(buf)
            },
            _ => Err(io::Error::new(io::ErrorKind::Unsupported, "read_some is TCP-only")),
        }
    }

    pub fn peer_addr(&self) -> io::Result<SocketAddr> {
        match self {
            P2PStream::Tcp(stream, _) => stream.peer_addr(),
            P2PStream::Relay(_, _) => Err(io::Error::new(io::ErrorKind::Unsupported, "peer_addr not supported for RelayStream")),
            P2PStream::Udp(stream) => Ok(stream.src),
        }
    }

    pub fn describe(&self) -> String {
        match self {
            P2PStream::Tcp(stream, _) => {
                match stream.peer_addr() {
                    Ok(addr) => addr.to_string(),
                    Err(_) => "TCP (disconnected)".to_string(),
                }
            }
            P2PStream::Relay(stream, _) => format!("via {} to {}", stream.from, stream.to),
            P2PStream::Udp(stream) => stream.src.to_string(),
        }
    }

    pub fn shutdown(&self) -> io::Result<()> {
        match self {
            P2PStream::Tcp(stream, _) => stream.shutdown(Shutdown::Both),
            P2PStream::Relay(_, _) => Ok(()),
            P2PStream::Udp(stream) => {
                stream.shutdown();
                Ok(())
            }
        }
    }

    pub fn peek(&self, buf: &mut [u8]) -> io::Result<usize> {
        match self {
            P2PStream::Tcp(stream, _) => stream.peek(buf),
            P2PStream::Relay(_, _) => Err(io::Error::new(io::ErrorKind::Unsupported, "peek not supported for RelayStream")),
            P2PStream::Udp(_) => Err(io::Error::new(io::ErrorKind::Unsupported, "peek not supported for UdpStream")),
        }
    }

    pub fn last_contact(&self) -> i64 {
        match self {
            P2PStream::Tcp(_, _) => time(),
            P2PStream::Relay(stream, _) => stream.last_contact(),
            P2PStream::Udp(stream) => stream.last_contact(),
        }
    }
}

#[derive(Clone, Debug)]
pub struct P2PConnection {
    pub stream: P2PStream,
    pub sessionid: String,
    pub cipher: Aes256,
    pub uuid: String,
    pub res: DataObject,
    pub pending: DataArray,
    pub last_read: Arc<AtomicI64>,
    pub alive: Arc<AtomicBool>,
    pub chunks: Arc<Mutex<HashMap<i64, (i64, i64, HashMap<i64, Vec<u8>>)>>>,
    pub capabilities: Arc<Mutex<DataObject>>,
    // Partial TCP reads survive an idle timeout; a new frame header is never
    // parsed from the middle of the previous frame.
    pub inbox: Arc<Mutex<VecDeque<u8>>>,
}

impl P2PConnection {

    pub fn get(conid: i64) -> P2PConnection {
        do_init();
        let p2pcons_guard = P2PCONS.get().read();
        p2pcons_guard.get(&conid).expect("P2PConnection not found for conid").duplicate()
    }

    pub fn try_get(conid: i64) -> Option<P2PConnection> {
        do_init();
        let p2pcons_guard = P2PCONS.get().read();
        p2pcons_guard.get(&conid).map(|conn| conn.duplicate())
    }

    pub fn list() -> Vec<i64> {
        do_init();
        let p2pcons_guard = P2PCONS.get().read();
        p2pcons_guard.keys().cloned().collect()
    }

    pub fn duplicate(&self) -> P2PConnection {
        P2PConnection {
            stream: self.stream.clone(),
            sessionid: self.sessionid.clone(),
            cipher: self.cipher.clone(),
            uuid: self.uuid.clone(),
            res: self.res.clone(),
            pending: self.pending.clone(),
            last_read: self.last_read.clone(),
            alive: self.alive.clone(),
            chunks: self.chunks.clone(),
            capabilities: self.capabilities.clone(),
            inbox: self.inbox.clone(),
        }
    }

    pub fn begin(uuid: String, stream: P2PStream) -> (i64, P2PConnection) {
        do_init();
        let user = get_user(&uuid).expect("[P2P_CONN_BEGIN] User not found");
        let mut cons = user.get_array("connections");

        let system = DataStore::globals().get_object("system");
        let runtime = system.get_object("apps").get_object("app").get_object("runtime");

        let my_private_hex = runtime.get_string("privatekey");
        let my_private_bytes = decode_hex(&my_private_hex).unwrap();
        let my_private_arr: [u8; 32] = my_private_bytes.try_into().unwrap();

        let peer_public_hex = user.get_string("publickey");
        let peer_public_bytes = decode_hex(&peer_public_hex).unwrap();
        let peer_public_arr: [u8; 32] = peer_public_bytes.try_into().unwrap();

        let shared_secret = x25519(my_private_arr, peer_public_arr);
        let cipher = Aes256::new(&shared_secret);

        let sessionid = unique_session_id();
        let new_p2p_connection = P2PConnection {
            stream,
            sessionid: sessionid.to_owned(),
            cipher,
            uuid: uuid.to_string(),
            res: DataObject::new(),
            pending: DataArray::new(),
            last_read: Arc::new(AtomicI64::new(time())),
            alive: Arc::new(AtomicBool::new(true)),
            chunks: Arc::new(Mutex::new(HashMap::new())),
            capabilities: Arc::new(Mutex::new(DataObject::new())),
            inbox: Arc::new(Mutex::new(VecDeque::new())),
        };

        let sessiontimeoutmillis = system.get_object("config").get_int("sessiontimeoutmillis");
        let mut session_obj = DataObject::new();
        session_obj.put_int("count", 0);
        session_obj.put_string("id", &sessionid);
        session_obj.put_string("username", &uuid);
        session_obj.put_object("user", user.clone());
        session_obj.put_int("expire", time() + sessiontimeoutmillis);

        let mut sessions_map = system.get_object("sessions");
        sessions_map.put_object(&sessionid, session_obj.clone());

        let conid;
        {
            let mut p2pcons_map_guard = P2PCONS.get().lock();
            loop {
                let random_id = rand_i64();
                if !p2pcons_map_guard.contains_key(&random_id) {
                    conid = random_id;
                    let duplicated_conn_for_map = new_p2p_connection.duplicate();
                    p2pcons_map_guard.insert(conid, duplicated_conn_for_map);
                    cons.push_int(conid);
                    break;
                }
            }
        }

        fire_event("peer", "UPDATE", user_to_peer(user.clone(), uuid.to_string()));
        fire_event("peer", "CONNECT", user_to_peer(user.clone(), uuid.to_string()));

        (conid, new_p2p_connection)
    }

    pub fn shutdown(&self, uuid_str: &str, conid: i64) -> io::Result<()> {
        do_init();
        self.alive.store(false, AtomicOrdering::SeqCst);
        let _ = self.stream.shutdown();
        let controls: Vec<Arc<(Mutex<bool>, Condvar)>> = STREAMCONTROL.get().read().values().cloned().collect();
        for control in controls { control.1.notify_all(); }
        // Wake every request waiting on this connection with a real error;
        // callers remove their own pending id after observing the response.
        let mut responses = self.res.clone();
        for pid in self.pending.objects() {
            if let Data::DInt(pid) = pid {
                if !self.res.has(&pid.to_string()) {
                    let mut error = DataObject::new();
                    error.put_string("status", "err");
                    error.put_string("msg", "P2P connection closed before a response arrived");
                    error.put_int("pid", pid);
                    responses.put_object(&pid.to_string(), error);
                }
            }
        }
        let user_opt = get_user(uuid_str);

        if let Some(user) = user_opt {
            user.get_array("connections").remove_data(Data::DInt(conid));
            fire_event("peer", "UPDATE", user_to_peer(user.clone(), uuid_str.to_string()));
            fire_event("peer", "DISCONNECT", user_to_peer(user.clone(), uuid_str.to_string()));
        }

        let removed_con_opt: Option<P2PConnection>;
        {
            let mut p2pcons_map_guard = P2PCONS.get().lock();
            removed_con_opt = p2pcons_map_guard.remove(&conid);
        }

        if let Some(removed_con) = removed_con_opt {
            let shutdown_result = removed_con.stream.shutdown(); 

            if removed_con.stream.is_tcp() {
                let users_map = DataStore::globals().get_object("system").get_object("users");
                for (uuid2, _u_val) in users_map.objects() {
                    if uuid2.len() == 36 && uuid_str != uuid2 {
                        relay(uuid_str, &uuid2, false);
                    }
                }
            }

            let mut sessions_map = DataStore::globals().get_object("system").get_object("sessions");
            sessions_map.remove_property(&removed_con.sessionid);

            return shutdown_result;
        }

        Ok(())
    }

    pub fn is_alive(&self) -> bool {
        self.alive.load(AtomicOrdering::SeqCst)
    }

    pub fn last_contact(&self) -> i64 {
        if self.stream.is_tcp() { self.last_read.load(AtomicOrdering::SeqCst) } else { self.stream.last_contact() }
    }

    pub fn supports(&self, feature: &str) -> bool {
        let caps = self.capabilities.lock().unwrap();
        caps.has(feature) && caps.get_boolean(feature)
    }

    pub fn send_command(&self, method: &str, payload: &[u8]) -> io::Result<()> {
        let mut stream = self.stream.clone();
        if self.stream.is_tcp() && self.supports("xfrm") && payload.len() + 4 > CHUNK_WIRE {
            let mut message = method.as_bytes().to_vec();
            message.extend_from_slice(payload);
            return send_chunked(&mut stream, &self.cipher, &message, self.sessionid.clone());
        }
        let mut bytes = method.as_bytes().to_vec();
        bytes.extend_from_slice(payload);
        send_legacy_frame(&mut stream, &self.cipher, &bytes, self.sessionid.clone()).map(|_| ())
    }

    pub fn begin_stream(&mut self) -> i64 {
        do_init();
        let mut streamwriters_map_guard = STREAMWRITERS.get().lock();
        let new_stream_id: i64;
        loop {
            let random_val = rand_i64();
            if random_val != -1 && !streamwriters_map_guard.contains_key(&random_val) {
                new_stream_id = random_val;
                break;
            }
        }
        streamwriters_map_guard.insert(new_stream_id, -1);
        if self.supports("flow") { STREAMCONTROL.get().lock().insert(new_stream_id, Arc::new((Mutex::new(false), Condvar::new()))); }
        new_stream_id
    }

    pub fn join_stream(&mut self, stream_to_join_id: i64) -> DataBytes {
        do_init();
        let new_downstream_id: i64;
        let new_databytes_for_reader = DataBytes::new();
        {
            let mut streamreaders_map_guard = STREAMREADERS.get().lock();
            loop {
                let random_val = rand_i64();
                if random_val != -1 && !streamreaders_map_guard.contains_key(&random_val) {
                    new_downstream_id = random_val;
                    break;
                }
            }
            streamreaders_map_guard.insert(new_downstream_id, new_databytes_for_reader.clone());
        }
        if self.supports("flow") {
            let control = Arc::new((Mutex::new(false), Condvar::new()));
            STREAMCONTROL.get().lock().insert(new_downstream_id, control.clone());
            let mut monitor = self.duplicate();
            let reader = new_databytes_for_reader.clone();
            thread::spawn(move || {
                let mut was_paused = false;
                while monitor.alive.load(AtomicOrdering::SeqCst) {
                    let exists = STREAMREADERS.get().read().contains_key(&new_downstream_id);
                    if !exists || !reader.is_read_open() { break; }
                    let backlog = reader.current_len();
                    if was_paused && backlog < 1024 * 1024 {
                        let mut message = b"s_6 ".to_vec();
                        message.extend_from_slice(&new_downstream_id.to_be_bytes());
                        let _ = send_legacy_frame(&mut monitor.stream, &monitor.cipher, &message, monitor.sessionid.clone());
                        *control.0.lock().unwrap() = false;
                        was_paused = false;
                    } else if backlog > 4 * 1024 * 1024 { was_paused = true; }
                    thread::sleep(Duration::from_millis(100));
                }
                if let Some(control) = STREAMCONTROL.get().lock().remove(&new_downstream_id) { control.1.notify_all(); }
            });
        }

        let mut message_bytes = "s_1 ".as_bytes().to_vec();
        message_bytes.extend_from_slice(&stream_to_join_id.to_be_bytes());
        message_bytes.extend_from_slice(&new_downstream_id.to_be_bytes());

        let encrypted_message = encrypt(&self.cipher, &message_bytes);
        let len = encrypted_message.len() as i16;

        let mut final_bytes_to_send = len.to_be_bytes().to_vec();
        final_bytes_to_send.extend_from_slice(&encrypted_message);

        let _write_result = self.stream.write(&final_bytes_to_send, self.sessionid.clone());

        new_databytes_for_reader
    }

    pub fn write_stream(&mut self, upstream_id: i64, data_to_write: &Vec<u8>) -> bool {
        do_init();
        if !self.alive.load(AtomicOrdering::SeqCst) { return false; }
        if data_to_write.len() > MAX_STREAM_PAYLOAD { return false; }
        if let Some(control) = STREAMCONTROL.get().read().get(&upstream_id).cloned() {
            let (lock, cvar) = &*control;
            let mut paused = lock.lock().unwrap();
            let deadline = std::time::Instant::now() + Duration::from_secs(30);
            while *paused && self.alive.load(AtomicOrdering::SeqCst) {
                let left = deadline.saturating_duration_since(std::time::Instant::now());
                if left.is_zero() { return false; }
                let (guard, _) = cvar.wait_timeout(paused, left).unwrap();
                paused = guard;
            }
        }
        if !self.alive.load(AtomicOrdering::SeqCst) { return false; }
        let downstream_id: i64;
        let mut timeout = 0;
        loop {
            {
                let streamwriters_map_guard = STREAMWRITERS.get().read();
                if let Some(val) = streamwriters_map_guard.get(&upstream_id) {
                    if *val != -1 {
                        downstream_id = *val;
                        break;
                    }
                } else {
                    return false;
                }
            }

            timeout += 1;
            if timeout > 500 {
                return false;
            }
            let beat = Duration::from_millis(timeout.min(50));
            thread::sleep(beat);
        }

        let mut message_bytes = "s_2 ".as_bytes().to_vec();
        message_bytes.extend_from_slice(&downstream_id.to_be_bytes());
        let data_len = data_to_write.len() as u16;
        message_bytes.extend_from_slice(&data_len.to_be_bytes());
        message_bytes.extend_from_slice(data_to_write);

        let encrypted_message = encrypt(&self.cipher, &message_bytes);
        let final_len = encrypted_message.len() as i16;

        let mut final_bytes_to_send = final_len.to_be_bytes().to_vec();
        final_bytes_to_send.extend_from_slice(&encrypted_message);

        let write_result = self.stream.write(&final_bytes_to_send, self.sessionid.clone());
        write_result.is_ok()
    }

    pub fn end_stream_write(&mut self, upstream_id: i64) {
        do_init();
        let downstream_id_opt: Option<i64>;
        {
            let mut streamwriters_map_guard = STREAMWRITERS.get().lock();
            downstream_id_opt = streamwriters_map_guard.remove(&upstream_id);
            if let Some(control) = STREAMCONTROL.get().lock().remove(&upstream_id) { control.1.notify_all(); }
        }

        if let Some(downstream_id) = downstream_id_opt {
            if downstream_id != -1 {
                let mut message_bytes = "s_3 ".as_bytes().to_vec();
                message_bytes.extend_from_slice(&downstream_id.to_be_bytes());

                let encrypted_message = encrypt(&self.cipher, &message_bytes);
                let len = encrypted_message.len() as i16;

                let mut final_bytes_to_send = len.to_be_bytes().to_vec();
                final_bytes_to_send.extend_from_slice(&encrypted_message);

                let _write_result = self.stream.write(&final_bytes_to_send, self.sessionid.clone());
            }
        }
    }

    pub fn end_stream_read(&mut self, downstream_id: i64) {
        do_init();
        {
            let mut streamreaders_map_guard = STREAMREADERS.get().lock();
            streamreaders_map_guard.remove(&downstream_id);
        }
        if let Some(control) = STREAMCONTROL.get().lock().remove(&downstream_id) {
            control.1.notify_all();
        }
    }
}

pub fn get_best(user: DataObject) -> Option<P2PConnection> {
    do_init();
    let mut best_conn: Option<P2PConnection> = None;
    let p2pcons_guard = P2PCONS.get().read();
    let user_connections = user.get_array("connections");
    let cutoff = time() - 120000;
    for con_id_data in user_connections.objects() {
        if let Data::DInt(conid) = con_id_data {
            if let Some(current) = p2pcons_guard.get(&conid) {
                if !current.alive.load(AtomicOrdering::SeqCst) || current.last_contact() < cutoff { continue; }
                let replace = match &best_conn {
                    None => true,
                    Some(best) => {
                        let current_rank = if current.stream.is_tcp() { 3 } else if current.stream.is_udp() { 2 } else { 1 };
                        let best_rank = if best.stream.is_tcp() { 3 } else if best.stream.is_udp() { 2 } else { 1 };
                        current_rank > best_rank || (current_rank == best_rank && current.last_contact() > best.last_contact())
                    }
                };
                if replace { best_conn = Some(current.duplicate()); }
            }
        }
    }
    best_conn
}

pub fn get_tcp(user: DataObject) -> Option<P2PConnection> {
    do_init();
    let mut best_conn: Option<P2PConnection> = None;
    let p2pcons_guard = P2PCONS.get().read();
    let user_connections = user.get_array("connections");
    let cutoff = time() - 120000;
    for con_id_data in user_connections.objects() {
        if let Data::DInt(conid) = con_id_data {
            if let Some(conn) = p2pcons_guard.get(&conid) {
                if conn.stream.is_tcp() && conn.alive.load(AtomicOrdering::SeqCst) && conn.last_contact() >= cutoff {
                    if best_conn.as_ref().map(|c: &P2PConnection| c.last_contact() < conn.last_contact()).unwrap_or(true) {
                        best_conn = Some(conn.duplicate());
                    }
                }
            }
        }
    }
    best_conn
}

pub fn get_udp(user: DataObject) -> Option<P2PConnection> {
    do_init();
    let p2pcons_guard = P2PCONS.get().read();
    let user_connections = user.get_array("connections");

    for con_id_data in user_connections.objects() {
        if let Data::DInt(conid) = con_id_data {
            if let Some(conn) = p2pcons_guard.get(&conid) {
                if conn.stream.is_udp() {
                    return Some(conn.duplicate());
                }
            }
        }
    }
    None
}

pub fn get_relay(user: DataObject) -> Option<P2PConnection> {
    do_init();
    let p2pcons_guard = P2PCONS.get().read();
    let user_connections = user.get_array("connections");

    for con_id_data in user_connections.objects() {
        if let Data::DInt(conid) = con_id_data {
            if let Some(conn) = p2pcons_guard.get(&conid) {
                if conn.stream.is_relay() {
                    return Some(conn.duplicate());
                }
            }
        }
    }
    None
}


pub fn relay(from_uuid: &str, to_uuid: &str, connected: bool) -> Option<P2PConnection> {
    do_init();
    let user_to = match get_user(to_uuid) {
        Some(u) => u,
        None => return None,
    };
    let user_connections = user_to.get_array("connections");

    {
        let p2pcons_guard = P2PCONS.get().read();
        for con_id_data in user_connections.objects() {
            if let Data::DInt(conid) = con_id_data {
                if let Some(p2p_conn_ref) = p2pcons_guard.get(&conid) {
                    if let P2PStream::Relay(ref relay_stream, _) = p2p_conn_ref.stream {
                        if relay_stream.from == from_uuid && relay_stream.to == to_uuid {
                            if connected {
                                return Some(p2p_conn_ref.duplicate());
                            } else {
                                let conn_to_shutdown = p2p_conn_ref.duplicate();
                                drop(p2pcons_guard);
                                let _ = conn_to_shutdown.shutdown(to_uuid, conid);
                                return None;
                            }
                        }
                    }
                }
            }
        }
    }

    if connected {
        let new_relay_stream = RelayStream::new(from_uuid.to_string(), to_uuid.to_string());
        let p2p_stream = P2PStream::Relay(new_relay_stream, Arc::new(Mutex::new(())));
        let (_conid, new_conn) = P2PConnection::begin(to_uuid.to_string(), p2p_stream);
        return Some(new_conn);
    }
    None
}

pub fn handshake(stream: &mut P2PStream, peer: Option<String>) -> Option<(i64, P2PConnection)> {
  let system = DataStore::globals().get_object("system");
  let runtime = system.get_object("apps").get_object("app").get_object("runtime");
  let my_uuid = runtime.get_string("uuid");

  let my_public = runtime.get_string("publickey");
  let my_private_hex = runtime.get_string("privatekey");
  let my_private = decode_hex(&my_private_hex).unwrap();
  let my_private: [u8; 32] = my_private.try_into().unwrap();

  let (my_session_private, my_session_public) = generate_x25519_keypair();

  let init = peer.is_some();
  if init { let _x = stream.write(&my_session_public, "HANDSHAKE".to_string()).unwrap(); }

  let mut bytes = vec![0u8; 32];
  if stream.read_exact(&mut bytes).is_err() { return None;}
  
  let remote_session_public: [u8; 32] = bytes.try_into().unwrap();

  if !init { let _x = stream.write(&my_session_public, "HANDSHAKE".to_string()).unwrap(); }

  let shared_secret = x25519(my_session_private, remote_session_public);
  let cipher = Aes256::new(&shared_secret);

  let bytes = encrypt(&cipher, my_uuid.as_bytes());
  let _x = stream.write(&bytes, "HANDSHAKE".to_string()).unwrap();

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

    let my_step;
    if havekey { my_step = 1; } else { my_step = 0; }
    let _x = stream.write(&[my_step], "HANDSHAKE".to_string()).unwrap();

    let mut bytes = vec![0u8; 1];
    if stream.read_exact(&mut bytes).is_err() { return None; }

    let remote_step = bytes[0];

    if remote_step == 0 {
      let bytes = encrypt(&cipher, &decode_hex(&my_public).unwrap());
      let _x = stream.write(&bytes, "HANDSHAKE".to_string()).unwrap();
    }
    else if remote_step != 1 {
      return None;
    }

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
    let peer_public: [u8; 32] = peer_public.try_into().unwrap();

    let shared_secret = x25519(my_private, peer_public);
    let cipher = Aes256::new(&shared_secret);

    let isok;
    if init {
      let mut bytes = vec![0u8; 16];
      let _x = stream.read_exact(&mut bytes).unwrap();
      let mut bytes = decrypt(&cipher, &bytes);
      bytes.resize(16, 0);
      let sig = String::from_utf8(bytes).unwrap();
      if sig != "What's good, yo?" { isok = false; }
      else {
        let buf = encrypt(&cipher, b"All is good now!");
        let _x = stream.write(&buf, "HANDSHAKE".to_string()).unwrap();
        isok = true;
      }
    }
    else {
      let buf = encrypt(&cipher, b"What's good, yo?");
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

      let mut capabilities = DataObject::new();
      capabilities.put_boolean("xfrm", true);
      capabilities.put_boolean("flow", true);
      capabilities.put_int("max_message", MAX_CHUNK_MESSAGE as i64);
      let mut advertised = con.duplicate();
      let _ = send_legacy_frame(&mut advertised.stream, &advertised.cipher, ("cap ".to_string()+&capabilities.to_string()).as_bytes(), advertised.sessionid.clone());
      return Some((conid, con));
    }
  }
  None
}

fn do_listen(ipaddr: String, port: i64) -> i64 {
    let socket_address = format!("{}:{}", ipaddr, port);
    let listener = match TcpListener::bind(&socket_address) {
        Ok(l) => l,
        Err(_) => return -1,
    };

    let actual_port = listener.local_addr().unwrap().port();

    let system_globals = DataStore::globals().get_object("system");
    let mut peer_runtime_config = system_globals.get_object("apps").get_object("peer").get_object("runtime");
    peer_runtime_config.put_int("port", actual_port as i64);

    if port == 0 {
        let properties_path = Path::new("runtime").join("peer").join("botd.properties");
        if let Some(parent_dir) = properties_path.parent() {
            let _ = fs::create_dir_all(parent_dir);
        }
        let _ = write_properties(properties_path.to_string_lossy().into_owned(), peer_runtime_config);
    }

    println!("P2P TCP listening on port {}", actual_port);

    thread::spawn(move || {
        for stream_result in listener.incoming() {
            if !DataStore::globals().get_object("system").get_boolean("running") { break; }
            match stream_result {
                Ok(tcp_stream) => {
                    let _ = tcp_stream.set_nodelay(true);
                    let _ = tcp_stream.set_read_timeout(Some(Duration::from_secs(30)));
                    let _ = tcp_stream.set_write_timeout(Some(Duration::from_secs(15)));
                    thread::spawn(move || {
                        let remote_addr_str = tcp_stream.peer_addr().map_or_else(|_| "unknown".to_string(), |a| a.to_string());
                        let mut event_data = DataObject::new();
                        event_data.put_string("addr", &remote_addr_str);
                        fire_event("peer", "TCP_REQUEST_RECEIVED", event_data);

                        let mut p2p_stream = P2PStream::Tcp(Arc::new(tcp_stream), Arc::new(Mutex::new(())));
                        if let Some((conid, p2p_connection)) = handshake(&mut p2p_stream, None) {
                            // Capabilities travel after the unchanged security
                            // handshake so legacy readers can safely skip them.
                            let mut caps = DataObject::new();
                            caps.put_boolean("xfrm", true);
                            caps.put_boolean("flow", true);
                            caps.put_int("max_message", MAX_CHUNK_MESSAGE as i64);
                            let mut advertised = p2p_connection.duplicate();
                            let _ = send_legacy_frame(&mut advertised.stream, &advertised.cipher, ("cap ".to_string()+&caps.to_string()).as_bytes(), advertised.sessionid.clone());
                            handle_connection(conid, p2p_connection);
                        } else {
                            let _ = p2p_stream.shutdown();
                        }
                    });
                }
                Err(_) => {}
            }
        }
    });
    actual_port as i64
}

pub fn handle_connection(conid: i64, p2p_conn: P2PConnection) {
    let mut current_connection = p2p_conn;
    let system_globals = DataStore::globals().get_object("system");
    let result = catch_unwind(AssertUnwindSafe(|| {
        while system_globals.get_boolean("running") {
            if !current_connection.alive.load(AtomicOrdering::SeqCst) { break; }
            if !handle_next_message(&mut current_connection) { break; }
        }
    }));
    if result.is_err() { println!("P2P reader panic; closing connection {} to {}", conid, &current_connection.uuid); }
    let _ = current_connection.shutdown(&current_connection.uuid, conid);
}

pub fn handle_next_message(conn: &mut P2PConnection) -> bool {
    let system_globals = DataStore::globals().get_object("system");
    let sessions_map = system_globals.get_object("sessions");
    let mut current_session = sessions_map.get_object(&conn.sessionid);

    let encrypted_payload_bytes = match read_frame(conn) {
        Ok(Some(frame)) => frame,
        Ok(None) => return true,
        Err(_) => return false,
    };

    let decrypted_payload = decrypt(&conn.cipher, &encrypted_payload_bytes);
    if decrypted_payload.is_empty() && !encrypted_payload_bytes.is_empty() { return false; }
    if decrypted_payload.len() < 4 { return false; }

    let method_str = match String::from_utf8(decrypted_payload[0..4].to_vec()) {
        Ok(s) => s,
        Err(_) => return false,
    };

    let session_timeout_millis = system_globals.get_object("config").get_int("sessiontimeoutmillis");
    current_session.put_int("expire", time() + session_timeout_millis);
    let new_count = current_session.get_int("count") + 1;
    current_session.put_int("count", new_count);

    if method_str == "cap " {
        if let Ok(text) = std::str::from_utf8(&decrypted_payload[4..]) {
            let wrapped = format!("{{\"cap\":{}}}", text.trim_matches('\0'));
            if let Ok(parsed) = DataObject::try_from_string(&wrapped) {
                let mut caps = conn.capabilities.lock().unwrap();
                *caps = parsed.get_object("cap").deep_copy();
            }
        }
        return true;
    }

    if method_str == "xfr " {
        if decrypted_payload.len() < 32 { return false; }
        let id = i64::from_be_bytes(decrypted_payload[4..12].try_into().unwrap());
        let index = i64::from_be_bytes(decrypted_payload[12..20].try_into().unwrap());
        let total = i64::from_be_bytes(decrypted_payload[20..28].try_into().unwrap());
        let part_len = u32::from_be_bytes(decrypted_payload[28..32].try_into().unwrap()) as usize;
        if total <= 0 || total > (MAX_CHUNK_MESSAGE / CHUNK_WIRE + 1) as i64 || index < 0 || index >= total { return false; }
        if part_len > CHUNK_WIRE || decrypted_payload.len() < 32 + part_len { return false; }
        let part = decrypted_payload[32..32 + part_len].to_vec();
        let complete = {
            let mut all = conn.chunks.lock().unwrap();
            let now = time();
            // Abandoned or hostile fragmented messages cannot retain memory
            // indefinitely. Each transfer also has a hard 16 MiB bound.
            all.retain(|_, (_, updated, _)| now - *updated < 120000);
            let buffered: usize = all.values().map(|(_, _, parts)| parts.values().map(|p| p.len()).sum::<usize>()).sum();
            if buffered + part.len() > MAX_CHUNK_MESSAGE { return false; }
            let entry = all.entry(id).or_insert_with(|| (total, now, HashMap::new()));
            if entry.0 != total { all.remove(&id); return false; }
            entry.1 = now;
            entry.2.insert(index, part);
            if entry.2.len() as i64 == total {
                let (_, _, parts) = all.remove(&id).unwrap();
                let mut bytes = Vec::new();
                for i in 0..total { if let Some(p) = parts.get(&i) { bytes.extend_from_slice(p); } else { return false; } }
                if bytes.len() > MAX_CHUNK_MESSAGE { return false; }
                Some(bytes)
            } else { None }
        };
        if let Some(bytes) = complete { return dispatch_complete_message(conn, &bytes); }
        return true;
    }

    if method_str == "s_1 " {
        if decrypted_payload.len() < 20 { return false; }
        let writer_stream_id = i64::from_be_bytes(decrypted_payload[4..12].try_into().unwrap());
        let reader_downstream_id = i64::from_be_bytes(decrypted_payload[12..20].try_into().unwrap());

        let mut streamwriters_map_guard = STREAMWRITERS.get().lock();
        streamwriters_map_guard.insert(writer_stream_id, reader_downstream_id);
        if conn.supports("flow") {
            STREAMCONTROL.get().lock().entry(writer_stream_id).or_insert_with(|| Arc::new((Mutex::new(false), Condvar::new())));
        }

    } else if method_str == "s_2 " {
        if decrypted_payload.len() < 14 { return false; }
        let reader_downstream_id = i64::from_be_bytes(decrypted_payload[4..12].try_into().unwrap());
        let data_chunk_len = i16::from_be_bytes(decrypted_payload[12..14].try_into().unwrap()) as usize;

        if decrypted_payload.len() < 14 + data_chunk_len { return false; }
        let data_chunk = &decrypted_payload[14 .. 14 + data_chunk_len];

        let mut dead_reader = false;
        {
            let streamreaders_map_guard = STREAMREADERS.get().read();
            if let Some(databytes_handle) = streamreaders_map_guard.get(&reader_downstream_id) {
                // write() returns false once the local consumer has closed
                // its side (the appserver does that when its client goes
                // away) - report back so an open-ended stream stops sending
                if !databytes_handle.is_write_open() || !databytes_handle.write(data_chunk) {
                    dead_reader = true;
                }
            }
            else {
                dead_reader = true;
            }
        }
        if conn.supports("flow") {
            let backlog = STREAMREADERS.get().read().get(&reader_downstream_id).map(|b| b.current_len()).unwrap_or(0);
            if let Some(control) = STREAMCONTROL.get().read().get(&reader_downstream_id).cloned() {
                let should_pause = backlog > 4 * 1024 * 1024;
                let mut paused = control.0.lock().unwrap();
                if should_pause && !*paused {
                    *paused = true;
                    let mut message = b"s_5 ".to_vec();
                    message.extend_from_slice(&reader_downstream_id.to_be_bytes());
                    let _ = send_legacy_frame(&mut conn.stream, &conn.cipher, &message, conn.sessionid.clone());
                }
                // Resume is emitted by join_stream's drain monitor only after
                // the consumer has actually reduced the queue below low water.
            }
        }
        if dead_reader {
            {
                let mut streamreaders_map_guard = STREAMREADERS.get().lock();
                streamreaders_map_guard.remove(&reader_downstream_id);
            }
            let mut message_bytes = "s_4 ".as_bytes().to_vec();
            message_bytes.extend_from_slice(&reader_downstream_id.to_be_bytes());
            let encrypted_message = encrypt(&conn.cipher, &message_bytes);
            let len = encrypted_message.len() as i16;
            let mut final_bytes_to_send = len.to_be_bytes().to_vec();
            final_bytes_to_send.extend_from_slice(&encrypted_message);
            let session_id_for_write = conn.sessionid.clone();
            let _x = conn.stream.write(&final_bytes_to_send, session_id_for_write);
        }

    } else if method_str == "s_4 " {
        if decrypted_payload.len() < 12 { return false; }
        let reader_downstream_id = i64::from_be_bytes(decrypted_payload[4..12].try_into().unwrap());

        // the remote consumer is gone: retire the matching writer so the
        // next write_stream returns false and the sending pump stops
        let mut streamwriters_map_guard = STREAMWRITERS.get().lock();
        let mut dead_upstream: Option<i64> = None;
        for (k, v) in streamwriters_map_guard.iter() {
            if *v == reader_downstream_id { dead_upstream = Some(*k); break; }
        }
        if let Some(k) = dead_upstream {
            streamwriters_map_guard.remove(&k);
            if let Some(control) = STREAMCONTROL.get().lock().remove(&k) { control.1.notify_all(); }
        }

    } else if method_str == "s_5 " || method_str == "s_6 " {
        if decrypted_payload.len() < 12 { return false; }
        let reader_downstream_id = i64::from_be_bytes(decrypted_payload[4..12].try_into().unwrap());
        let upstream = STREAMWRITERS.get().read().iter().find_map(|(k,v)| if *v == reader_downstream_id { Some(*k) } else { None });
        if let Some(upstream) = upstream {
            if let Some(control) = STREAMCONTROL.get().read().get(&upstream).cloned() {
                *control.0.lock().unwrap() = method_str == "s_5 ";
                control.1.notify_all();
            }
        }

    } else if method_str == "s_3 " {
        if decrypted_payload.len() < 12 { return false; }
        let reader_downstream_id = i64::from_be_bytes(decrypted_payload[4..12].try_into().unwrap());

        let streamreaders_map_guard = STREAMREADERS.get().read();
        if let Some(databytes_handle) = streamreaders_map_guard.get(&reader_downstream_id) {
            databytes_handle.close_write();
        }
        if let Some(control) = STREAMCONTROL.get().lock().remove(&reader_downstream_id) { control.1.notify_all(); }

    } else if method_str == "rcv " {
        if decrypted_payload.len() < 4 + 36 + 2 { return false; }
        let from_uuid = String::from_utf8_lossy(&decrypted_payload[4..40]).into_owned();
        let sub_packet_len = i16::from_be_bytes(decrypted_payload[40..42].try_into().unwrap()) as usize;
        if decrypted_payload.len() < 42 + sub_packet_len { return false; }
        let original_payload_with_len_prefix = &decrypted_payload[42 .. 42 + sub_packet_len];

        if let Some(mut relay_conn_to_sender) = relay(&conn.uuid, &from_uuid, true) {
            if let P2PStream::Relay(ref mut relay_stream_to_sender, _) = relay_conn_to_sender.stream {
                let (lock, cvar) = &*relay_stream_to_sender.buf;
                lock.lock().unwrap().push_back(original_payload_with_len_prefix.to_vec());
                cvar.notify_all();
                relay_stream_to_sender.last_contact.store(time(), AtomicOrdering::Relaxed);

                thread::spawn(move || {
                    let mut cl_conn = relay_conn_to_sender;
                    handle_next_message(&mut cl_conn);
                });
            }
        }

    } else if method_str == "fwd " {
        if decrypted_payload.len() < 4 + 36 + 2 { return false; }
        let target_uuid = String::from_utf8_lossy(&decrypted_payload[4..40]).into_owned();
        let sub_packet_len = i16::from_be_bytes(decrypted_payload[40..42].try_into().unwrap()) as usize;
        if decrypted_payload.len() < 42 + sub_packet_len { return false; }
        let actual_payload_to_forward = &decrypted_payload[42 .. 42 + sub_packet_len];

        if let Some(target_user) = get_user(&target_uuid) {
            if let Some(mut tcp_conn_to_target) = get_tcp(target_user) {
                let mut message_for_target = "rcv ".as_bytes().to_vec();
                message_for_target.extend_from_slice(conn.uuid.as_bytes());
                message_for_target.extend_from_slice(&(sub_packet_len as i16).to_be_bytes());
                message_for_target.extend_from_slice(actual_payload_to_forward);

                let encrypted_for_target = encrypt(&tcp_conn_to_target.cipher, &message_for_target);
                let len_for_target = encrypted_for_target.len() as i16;

                let mut final_bytes_for_target = len_for_target.to_be_bytes().to_vec();
                final_bytes_for_target.extend_from_slice(&encrypted_for_target);

                let _ = tcp_conn_to_target.stream.write(&final_bytes_for_target, tcp_conn_to_target.sessionid.clone());
            } else {
                let error_message_str = format!("err fwd {}", target_uuid);
                let mut error_payload_bytes = error_message_str.as_bytes().to_vec();
                error_payload_bytes.extend_from_slice(&(actual_payload_to_forward.len() as i16).to_be_bytes());
                error_payload_bytes.extend_from_slice(actual_payload_to_forward);

                let encrypted_error = encrypt(&conn.cipher, &error_payload_bytes);
                let error_len = encrypted_error.len() as i16;
                let mut final_error_bytes = error_len.to_be_bytes().to_vec();
                final_error_bytes.extend_from_slice(&encrypted_error);
                let _ = conn.stream.write(&final_error_bytes, conn.sessionid.clone());
            }
        } else {
             let error_message_str = format!("err fwd {}", target_uuid);
             let mut error_payload_bytes = error_message_str.as_bytes().to_vec();
             error_payload_bytes.extend_from_slice(&(actual_payload_to_forward.len() as i16).to_be_bytes());
             error_payload_bytes.extend_from_slice(actual_payload_to_forward);
             let encrypted_error = encrypt(&conn.cipher, &error_payload_bytes);
             let error_len = encrypted_error.len() as i16;
             let mut final_error_bytes = error_len.to_be_bytes().to_vec();
             final_error_bytes.extend_from_slice(&encrypted_error);
             let _ = conn.stream.write(&final_error_bytes, conn.sessionid.clone());
        }

    } else if method_str == "err " {
        if decrypted_payload.len() < 4 + 4 + 36 + 2 { return false; }
        let error_type = String::from_utf8_lossy(&decrypted_payload[4..8]).into_owned();
        if error_type == "fwd " {
            let failed_target_uuid = String::from_utf8_lossy(&decrypted_payload[8..44]).trim_matches('\0').to_string();
            let original_payload_len = i16::from_be_bytes(decrypted_payload[44..46].try_into().unwrap()) as usize;
            if decrypted_payload.len() < 46 + original_payload_len { return false; }

            if let Some(failed_user) = get_user(&failed_target_uuid) {
                let system = DataStore::globals().get_object("system");
                let runtime = system.get_object("apps").get_object("app").get_object("runtime");
                let my_private_hex = runtime.get_string("privatekey");

                let my_private = decode_hex(&my_private_hex).unwrap();
                let my_private_arr: [u8; 32] = my_private.try_into().unwrap();

                let peer_public_hex = failed_user.get_string("publickey");
                let peer_public = decode_hex(&peer_public_hex).unwrap();
                let peer_public_arr: [u8; 32] = peer_public.try_into().unwrap();

                let shared_secret_to_failed = x25519(my_private_arr, peer_public_arr);
                let cipher_to_failed = Aes256::new(&shared_secret_to_failed);

                let command_object_encrypted_bytes = &decrypted_payload[46 .. 46 + original_payload_len];
                let command_object_decrypted_bytes = decrypt(&cipher_to_failed, command_object_encrypted_bytes);
                let command_object_str = String::from_utf8_lossy(&command_object_decrypted_bytes).trim_matches('\0').to_string();

                if command_object_str.starts_with("cmd ") {
                    let command_json_str = &command_object_str[4..];
                    let command_data_obj = match DataObject::try_from_string(command_json_str) { Ok(d) => d, Err(_) => return false };
                    let pid = command_data_obj.get_int("pid");

                    let mut err_response = DataObject::new();
                    err_response.put_string("status", "err");
                    let msg_string = format!("No route to host: {}", failed_target_uuid);
                    err_response.put_string("msg", &msg_string);
                    conn.res.put_object(&pid.to_string(), err_response);
                }
            }
            relay(&conn.uuid, &failed_target_uuid, false);
        }

    } else if method_str == "cmd " {
        let msg_str = String::from_utf8_lossy(&decrypted_payload[4..]).trim_matches('\0').to_string();
        let command_data_obj = match DataObject::try_from_string(&msg_str) { Ok(d) => d, Err(_) => return false };
        let mut params_obj = command_data_obj.get_object("params");
        params_obj.put_string("nn_sessionid", &conn.sessionid);
        params_obj.put_object("nn_session", current_session.clone());

        let thread_conn_stream_clone = conn.duplicate();
        let thread_conn_cipher = conn.cipher.clone();
        let thread_conn_sessionid = conn.sessionid.clone();
        let thread_conn_uuid = conn.uuid.clone();

        thread::spawn(move || {
            let mut result_obj = handle_command(command_data_obj, thread_conn_sessionid.clone());

            if result_obj.has("nn_return_type") && result_obj.get_string("nn_return_type") == "File" {
                let file_path_str = result_obj.get_string("data");
                if Path::new(&file_path_str).exists() {
                    if let Some(user_for_file_transfer) = get_user(&thread_conn_uuid) {
                        if let Some(mut file_transfer_conn) = get_best(user_for_file_transfer) {
                            let stream_id_for_file = file_transfer_conn.begin_stream();
                            result_obj.put_int("stream_id", stream_id_for_file);

                            let path_clone_for_thread = file_path_str.clone();
                            thread::spawn(move || {
                                if let Ok(mut file) = fs::File::open(&path_clone_for_thread) {
                                    let chunk_size = MAX_STREAM_PAYLOAD;
                                    let mut buffer = vec![0; chunk_size];
                                    loop {
                                        match file.read(&mut buffer) {
                                            Ok(0) => break,
                                            Ok(n) => {
                                                if !file_transfer_conn.write_stream(stream_id_for_file, &buffer[..n].to_vec()) {
                                                    break;
                                                }
                                            }
                                            Err(_e) => break,
                                        }
                                    }
                                }
                                file_transfer_conn.end_stream_write(stream_id_for_file);
                            });
                        }
                    }
                }
            }

            let payload = result_obj.to_string();
            if thread_conn_stream_clone.send_command("res ", payload.as_bytes()).is_err() {
                let mut error = DataObject::new();
                error.put_string("status", "err");
                error.put_string("msg", "P2P response exceeds the legacy frame limit; peer does not support chunking");
                if result_obj.has("pid") { error.set_property("pid", result_obj.get_property("pid")); }
                let _ = thread_conn_stream_clone.send_command("res ", error.to_string().as_bytes());
            }
        });

    } else if method_str == "res " {
        let msg_str = String::from_utf8_lossy(&decrypted_payload[4..]).trim_matches('\0').to_string();
        let response_data_obj = match DataObject::try_from_string(&msg_str) { Ok(d) => d, Err(_) => return false };
        let pid_val = response_data_obj.get_int("pid");
        conn.res.put_object(&pid_val.to_string(), response_data_obj);
    } 

    true
}

fn read_frame(conn: &mut P2PConnection) -> io::Result<Option<Vec<u8>>> {
    if !conn.stream.is_tcp() {
        // UDP and Relay already provide exact legacy message reads; they do
        // not implement TCP peek and need no partial-frame compatibility path.
        let mut header = [0u8;2];
        conn.stream.read_exact(&mut header)?;
        let len = u16::from_be_bytes(header) as usize;
        if len == 0 || len > MAX_LEGACY_FRAME { return Err(io::Error::new(io::ErrorKind::InvalidData, "Invalid P2P frame length")); }
        let mut frame = vec![0u8;len];
        conn.stream.read_exact(&mut frame)?;
        return Ok(Some(frame));
    }
    let mut header: Option<usize> = None;
    loop {
        {
            let mut inbox = conn.inbox.lock().unwrap();
            if header.is_none() && inbox.len() >= 2 {
                let len = u16::from_be_bytes([inbox[0], inbox[1]]) as usize;
                // Old senders cast lengths to signed i16. Values above 16400
                // were rejected by old receivers, but on TCP their two-byte
                // wrapped representation is unambiguous once the entire frame
                // has arrived. Do not decrypt until then: this is not stream
                // resynchronization and cannot mistake ciphertext for JSON.
                if len == 0 { return Err(io::Error::new(io::ErrorKind::InvalidData, "Zero-length P2P frame")); }
                header = Some(len);
            }
            if let Some(len) = header {
                if inbox.len() >= len + 2 {
                    inbox.drain(..2);
                    let frame: Vec<u8> = inbox.drain(..len).collect();
                    return Ok(Some(frame));
                }
            }
        }
        if !conn.alive.load(AtomicOrdering::SeqCst) { return Err(io::Error::new(io::ErrorKind::NotConnected, "P2P connection closed")); }
        let mut buf = [0u8; 16384];
        match conn.stream.read_some(&mut buf) {
            Ok(0) => {
                conn.alive.store(false, AtomicOrdering::SeqCst);
                return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "P2P socket closed"));
            },
            Ok(n) => {
                conn.last_read.store(time(), AtomicOrdering::SeqCst);
                conn.inbox.lock().unwrap().extend(buf[..n].iter().copied());
            },
            Err(e) if e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::TimedOut => {
                if conn.last_contact() < time() - 120000 {
                    conn.alive.store(false, AtomicOrdering::SeqCst);
                    return Err(io::Error::new(io::ErrorKind::TimedOut, "P2P receive liveness timeout"));
                }
                return Ok(None);
            },
            Err(e) => {
                conn.alive.store(false, AtomicOrdering::SeqCst);
                return Err(e);
            }
        }
    }
}

fn dispatch_complete_message(conn: &mut P2PConnection, message: &[u8]) -> bool {
    // Reassembly is bounded and produces an ordinary legacy plaintext message.
    if message.starts_with(b"cmd ") {
        if let Ok(text) = std::str::from_utf8(&message[4..]) {
            if let Ok(command) = DataObject::try_from_string(text.trim_matches('\0')) {
                let mut params = command.get_object("params");
                params.put_string("nn_sessionid", &conn.sessionid);
                let sessions = DataStore::globals().get_object("system").get_object("sessions");
                if sessions.has(&conn.sessionid) { params.put_object("nn_session", sessions.get_object(&conn.sessionid)); }
                let mut response_conn = conn.duplicate();
                thread::spawn(move || {
                    let result = handle_command(command, response_conn.sessionid.clone());
                    let payload = result.to_string();
                    if response_conn.send_command("res ", payload.as_bytes()).is_err() {
                        let mut error = DataObject::new();
                        error.put_string("status", "err");
                        error.put_string("msg", "P2P response exceeds the legacy frame limit; peer does not support chunking");
                        if result.has("pid") { error.set_property("pid", result.get_property("pid")); }
                        let _ = response_conn.send_command("res ", error.to_string().as_bytes());
                    }
                });
                return true;
            }
        }
        return false;
    }
    if message.starts_with(b"res ") {
        if let Ok(text) = std::str::from_utf8(&message[4..]) {
            if let Ok(result) = DataObject::try_from_string(text.trim_matches('\0')) {
                conn.res.put_object(&result.get_int("pid").to_string(), result);
                return true;
            }
        }
        return false;
    }
    false
}

pub fn encrypt(cipher: &Aes256, buf: &[u8]) -> Vec<u8> {
    let mut temp_buf = buf.to_vec();
    while temp_buf.len() % 16 != 0 {
        temp_buf.push(0);
    }
    cipher.encrypt_blocks(&mut temp_buf);
    temp_buf
}

pub fn decrypt(cipher: &Aes256, buf: &[u8]) -> Vec<u8> {
    if buf.len() % 16 != 0 { return Vec::new(); }
    let mut result_buf = buf.to_vec();
    cipher.decrypt_blocks(&mut result_buf);
    result_buf
}

pub fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{:02X}", byte)).collect()
}

pub fn decode_hex(hex_str: &str) -> Result<Vec<u8>, ParseIntError> {
    (0..hex_str.len())
        .step_by(2)
        .map(|i| {
            let end = std::cmp::min(i + 2, hex_str.len());
            u8::from_str_radix(&hex_str[i..end], 16)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cipher() -> Aes256 { Aes256::new(&[7u8;32]) }

    fn fixture() -> (P2PConnection, TcpStream) {
        static INIT_TEST_DATA: Once = Once::new();
        INIT_TEST_DATA.call_once(|| { DataObject::init(); DataArray::init(); DataBytes::init(); });
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let join = thread::spawn(move || listener.accept().unwrap().0);
        let client = TcpStream::connect(addr).unwrap();
        let server = join.join().unwrap();
        client.set_read_timeout(Some(Duration::from_millis(50))).unwrap();
        client.set_write_timeout(Some(Duration::from_secs(2))).unwrap();
        server.set_read_timeout(Some(Duration::from_secs(2))).unwrap();
        server.set_write_timeout(Some(Duration::from_secs(2))).unwrap();
        let stream = P2PStream::Tcp(Arc::new(client), Arc::new(Mutex::new(())));
        let con = P2PConnection {
            stream,
            sessionid: "test".to_string(),
            cipher: cipher(),
            uuid: "test".to_string(),
            res: DataObject::new(),
            pending: DataArray::new(),
            last_read: Arc::new(AtomicI64::new(time())),
            alive: Arc::new(AtomicBool::new(true)),
            chunks: Arc::new(Mutex::new(HashMap::new())),
            capabilities: Arc::new(Mutex::new(DataObject::new())),
            inbox: Arc::new(Mutex::new(VecDeque::new())),
        };
        (con, server)
    }

    #[test]
    fn legacy_frame_bytes_and_bounds() {
        let c = cipher();
        let plain = b"res {\"status\":\"ok\",\"pid\":1}";
        let actual = legacy_frame(&c, plain).unwrap();
        let encrypted = encrypt(&c, plain);
        let mut expected = (encrypted.len() as i16).to_be_bytes().to_vec();
        expected.extend_from_slice(&encrypted);
        assert_eq!(actual, expected, "small legacy frames must remain byte-identical");
        let len = u16::from_be_bytes([actual[0], actual[1]]) as usize;
        assert_eq!(len, encrypted.len());
        assert!(legacy_frame(&c, &vec![b'x';MAX_LEGACY_FRAME+1]).is_err());
    }

    #[test]
    fn fragmented_frames_reassemble_without_desync() {
        let (mut con, mut server) = fixture();
        let first = legacy_frame(&con.cipher, b"cap {}").unwrap();
        let second = legacy_frame(&con.cipher, b"res {}").unwrap();
        let writer = thread::spawn(move || {
            server.write_all(&first[..1]).unwrap();
            thread::sleep(Duration::from_millis(100));
            server.write_all(&first[1..]).unwrap();
            server.write_all(&second).unwrap();
        });
        assert_eq!(read_frame(&mut con).unwrap(), None);
        let one = read_frame(&mut con).unwrap().unwrap();
        assert_eq!(decrypt(&con.cipher,&one)[..6], b"cap {}"[..]);
        let two = read_frame(&mut con).unwrap().unwrap();
        assert_eq!(decrypt(&con.cipher,&two)[..6], b"res {}"[..]);
        writer.join().unwrap();
    }

    #[test]
    fn old_wrapped_large_frame_is_recovered_without_resync() {
        let (mut con, mut server) = fixture();
        let payload = vec![b'a';36810];
        let encrypted = encrypt(&con.cipher,&payload);
        assert_eq!(encrypted.len(),36816);
        let mut old = (encrypted.len() as i16).to_be_bytes().to_vec();
        old.extend_from_slice(&encrypted);
        let normal = legacy_frame(&con.cipher,b"res {}").unwrap();
        old.extend_from_slice(&normal);
        server.write_all(&old).unwrap();
        let first = read_frame(&mut con).unwrap().unwrap();
        assert_eq!(first.len(),36816);
        assert_eq!(&first[..],&encrypted[..]);
        let second = read_frame(&mut con).unwrap().unwrap();
        assert_eq!(decrypt(&con.cipher,&second)[..6],b"res {}"[..]);
    }

    #[test]
    fn no_capability_means_legacy_fallback() {
        let (con, _server) = fixture();
        let mut c = con.duplicate();
        assert!(!c.supports("xfrm"));
        assert!(c.send_command("res ", &vec![b'x';MAX_LEGACY_FRAME+1]).is_err());
        c.capabilities.lock().unwrap().put_boolean("xfrm",true);
        assert!(c.supports("xfrm"));
    }

    #[test]
    fn chunk_roundtrip_stays_within_legacy_frames() {
        let (mut con, mut server) = fixture();
        con.capabilities.lock().unwrap().put_boolean("xfrm",true);
        let payload = vec![b'a';64000];
        con.send_command("res ",&payload).unwrap();
        let mut received = Vec::new();
        for _ in 0..5 {
            let mut h = [0u8;2]; server.read_exact(&mut h).unwrap();
            let n = u16::from_be_bytes(h) as usize;
            assert!(n <= MAX_LEGACY_FRAME);
            let mut frame = vec![0u8;n];server.read_exact(&mut frame).unwrap();
            let msg = decrypt(&con.cipher,&frame);
            assert_eq!(&msg[..4],b"xfr ");
            let id = i64::from_be_bytes(msg[4..12].try_into().unwrap());
            let idx = i64::from_be_bytes(msg[12..20].try_into().unwrap());
            let total = i64::from_be_bytes(msg[20..28].try_into().unwrap());
            let mut chunks = con.chunks.lock().unwrap();
            let entry = chunks.entry(id).or_insert_with(||(total,time(),HashMap::new()));
            let part_len = u32::from_be_bytes(msg[28..32].try_into().unwrap()) as usize;
            entry.2.insert(idx,msg[32..32+part_len].to_vec());
            if entry.2.len() as i64 == total {
                let (_,_,parts)=chunks.remove(&id).unwrap();
                for i in 0..total { received.extend_from_slice(parts.get(&i).unwrap()); }
                break;
            }
        }
        assert_eq!(&received[..4],b"res ");
        assert_eq!(&received[4..],&payload[..]);
    }

    #[test]
    fn stream_producers_use_legacy_compatible_chunks() {
        do_init();
        let (mut sender, mut wire) = fixture();
        let upstream_id = rand_i64();
        let downstream_id = rand_i64();
        STREAMWRITERS.get().lock().insert(upstream_id, downstream_id);

        // The old 0x4000 producer size was rejected before it reached the wire.
        assert!(!sender.write_stream(upstream_id, &vec![0u8; 0x4000]));
        let payload: Vec<u8> = (0..MAX_STREAM_PAYLOAD).map(|i| (i % 251) as u8).collect();
        assert!(sender.write_stream(upstream_id, &payload));

        let mut header = [0u8; 2];
        wire.read_exact(&mut header).unwrap();
        let len = i16::from_be_bytes(header) as usize;
        assert!(len > 0 && len <= MAX_LEGACY_FRAME);
        let mut frame = vec![0u8; len];
        wire.read_exact(&mut frame).unwrap();
        let message = decrypt(&sender.cipher, &frame);
        assert_eq!(&message[..4], b"s_2 ");
        assert_eq!(i64::from_be_bytes(message[4..12].try_into().unwrap()), downstream_id);
        let n = i16::from_be_bytes(message[12..14].try_into().unwrap()) as usize;
        assert_eq!(n, MAX_STREAM_PAYLOAD);
        assert_eq!(&message[14..14+n], &payload);
        STREAMWRITERS.get().lock().remove(&upstream_id);
    }

    #[test]
    fn flow_control_wakes_on_drain_and_shutdown() {
        do_init();
        let id = rand_i64();
        let control = Arc::new((Mutex::new(false), Condvar::new()));
        STREAMCONTROL.get().lock().insert(id,control.clone());
        *control.0.lock().unwrap() = true;
        let waiting = control.clone();
        let worker = thread::spawn(move || {
            let (lock,cvar)=&*waiting;
            let mut paused=lock.lock().unwrap();
            let started=std::time::Instant::now();
            while *paused && started.elapsed()<Duration::from_secs(2) {
                let (next,_)=cvar.wait_timeout(paused,Duration::from_millis(100)).unwrap();paused=next;
            }
            !*paused
        });
        thread::sleep(Duration::from_millis(50));
        *control.0.lock().unwrap()=false;control.1.notify_all();
        assert!(worker.join().unwrap());
        *control.0.lock().unwrap()=true;control.1.notify_all();
        STREAMCONTROL.get().lock().remove(&id);
    }

    #[test]
    fn stale_and_dead_connections_are_not_selected() {
        do_init();
        let (stale, _a) = fixture();
        let (fresh, _b) = fixture();
        let stale_id=rand_i64();let fresh_id=rand_i64();
        stale.last_read.store(time()-121000,AtomicOrdering::SeqCst);
        fresh.last_read.store(time(),AtomicOrdering::SeqCst);
        P2PCONS.get().lock().insert(stale_id,stale.duplicate());
        P2PCONS.get().lock().insert(fresh_id,fresh.duplicate());
        let mut user=DataObject::new();let mut ids=DataArray::new();ids.push_int(stale_id);ids.push_int(fresh_id);user.put_array("connections",ids);
        let selected=get_best(user.clone()).unwrap();
        assert_eq!(selected.sessionid,fresh.sessionid);
        assert_eq!(get_tcp(user.clone()).unwrap().sessionid,fresh.sessionid);
        fresh.alive.store(false,AtomicOrdering::SeqCst);
        assert!(get_best(user.clone()).is_none());
        assert!(get_tcp(user).is_none());
        P2PCONS.get().lock().remove(&stale_id);P2PCONS.get().lock().remove(&fresh_id);
    }

    #[test]
    fn newest_live_connection_is_selected() {
        let (a, _sa) = fixture();
        let (b, _sb) = fixture();
        assert!(a.alive.load(AtomicOrdering::SeqCst));
        a.last_read.store(time()-5000,AtomicOrdering::SeqCst);
        b.last_read.store(time(),AtomicOrdering::SeqCst);
        assert!(b.last_contact() > a.last_contact());
    }

}
