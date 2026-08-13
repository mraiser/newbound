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
use aes::Aes256;
use aes::cipher::{
    BlockEncrypt, KeyInit,
    generic_array::GenericArray,
};
use aes::cipher::BlockDecrypt;
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

fn do_init() {
    INIT_GLOBALS_ONCE.call_once(|| {
        P2PCONS.initialize(HashMap::new());
        STREAMWRITERS.initialize(HashMap::new());
        STREAMREADERS.initialize(HashMap::new());
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
                ref_stream.read_exact(buf)
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
        let key = GenericArray::from(shared_secret);
        let cipher = Aes256::new(&key);

        let sessionid = unique_session_id();
        let new_p2p_connection = P2PConnection {
            stream,
            sessionid: sessionid.to_owned(),
            cipher,
            uuid: uuid.to_string(),
            res: DataObject::new(),
            pending: DataArray::new(),
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

    pub fn last_contact(&self) -> i64 {
        self.stream.last_contact()
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
        let data_len = data_to_write.len() as i16;
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
    }
}

pub fn get_best(user: DataObject) -> Option<P2PConnection> {
    do_init();
    let mut best_conn: Option<P2PConnection> = None;
    let p2pcons_guard = P2PCONS.get().read();
    let user_connections = user.get_array("connections");

    for con_id_data in user_connections.objects() {
        if let Data::DInt(conid) = con_id_data {
            if let Some(current_conn) = p2pcons_guard.get(&conid) {
                if current_conn.stream.is_tcp() {
                    return Some(current_conn.duplicate());
                }
                if best_conn.is_none() {
                    best_conn = Some(current_conn.duplicate());
                } else if best_conn.as_ref().unwrap().stream.is_relay() && current_conn.stream.is_udp() {
                    best_conn = Some(current_conn.duplicate());
                }
            }
        }
    }
    best_conn
}

pub fn get_tcp(user: DataObject) -> Option<P2PConnection> {
    do_init();
    let p2pcons_guard = P2PCONS.get().read();
    let user_connections = user.get_array("connections");

    for con_id_data in user_connections.objects() {
        if let Data::DInt(conid) = con_id_data {
            if let Some(conn) = p2pcons_guard.get(&conid) {
                if conn.stream.is_tcp() {
                    return Some(conn.duplicate());
                }
            }
        }
    }
    None
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
  let key = GenericArray::from(shared_secret);
  let cipher = Aes256::new(&key);

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
                    thread::spawn(move || {
                        let remote_addr_str = tcp_stream.peer_addr().map_or_else(|_| "unknown".to_string(), |a| a.to_string());
                        let mut event_data = DataObject::new();
                        event_data.put_string("addr", &remote_addr_str);
                        fire_event("peer", "TCP_REQUEST_RECEIVED", event_data);

                        let mut p2p_stream = P2PStream::Tcp(Arc::new(tcp_stream), Arc::new(Mutex::new(())));
                        if let Some((conid, p2p_connection)) = handshake(&mut p2p_stream, None) {
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

    while system_globals.get_boolean("running") {
        if !handle_next_message(&mut current_connection) { break; }
    }

    let _ = current_connection.shutdown(&current_connection.uuid, conid);
}

pub fn handle_next_message(conn: &mut P2PConnection) -> bool {
    let system_globals = DataStore::globals().get_object("system");
    let sessions_map = system_globals.get_object("sessions");
    let mut current_session = sessions_map.get_object(&conn.sessionid);

    let mut len_bytes = vec![0u8; 2];
    if conn.stream.read_exact(&mut len_bytes).is_err() { return false; }

    let msg_len_arr: [u8; 2] = match len_bytes.try_into() {
        Ok(arr) => arr,
        Err(_) => return false,
    };
    let msg_len = i16::from_be_bytes(msg_len_arr) as usize;

    if msg_len == 0 || msg_len > 16400 { return false; }

    let mut encrypted_payload_bytes = vec![0u8; msg_len];
    if conn.stream.read_exact(&mut encrypted_payload_bytes).is_err() { return false; }

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

    if method_str == "s_1 " {
        if decrypted_payload.len() < 20 { return false; }
        let writer_stream_id = i64::from_be_bytes(decrypted_payload[4..12].try_into().unwrap());
        let reader_downstream_id = i64::from_be_bytes(decrypted_payload[12..20].try_into().unwrap());

        let mut streamwriters_map_guard = STREAMWRITERS.get().lock();
        streamwriters_map_guard.insert(writer_stream_id, reader_downstream_id);

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
        if let Some(k) = dead_upstream { streamwriters_map_guard.remove(&k); }

    } else if method_str == "s_3 " {
        if decrypted_payload.len() < 12 { return false; }
        let reader_downstream_id = i64::from_be_bytes(decrypted_payload[4..12].try_into().unwrap());

        let streamreaders_map_guard = STREAMREADERS.get().read();
        if let Some(databytes_handle) = streamreaders_map_guard.get(&reader_downstream_id) {
            databytes_handle.close_write();
        }

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
                let key_to_failed = GenericArray::from(shared_secret_to_failed);
                let cipher_to_failed = Aes256::new(&key_to_failed);

                let command_object_encrypted_bytes = &decrypted_payload[46 .. 46 + original_payload_len];
                let command_object_decrypted_bytes = decrypt(&cipher_to_failed, command_object_encrypted_bytes);
                let command_object_str = String::from_utf8_lossy(&command_object_decrypted_bytes).trim_matches('\0').to_string();

                if command_object_str.starts_with("cmd ") {
                    let command_json_str = &command_object_str[4..];
                    let command_data_obj = DataObject::from_string(command_json_str);
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
        let command_data_obj = DataObject::from_string(&msg_str);
        let mut params_obj = command_data_obj.get_object("params");
        params_obj.put_string("nn_sessionid", &conn.sessionid);
        params_obj.put_object("nn_session", current_session.clone());

        let mut thread_conn_stream_clone = conn.stream.try_clone().unwrap();
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
                                    let chunk_size = 0x4000;
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

            let response_str = "res ".to_string() + &result_obj.to_string();
            let encrypted_response = encrypt(&thread_conn_cipher, response_str.as_bytes());
            let response_len = encrypted_response.len() as i16;

            let mut final_response_bytes = response_len.to_be_bytes().to_vec();
            final_response_bytes.extend_from_slice(&encrypted_response);

            let _ = thread_conn_stream_clone.write(&final_response_bytes, thread_conn_sessionid.clone());
        });

    } else if method_str == "res " {
        let msg_str = String::from_utf8_lossy(&decrypted_payload[4..]).trim_matches('\0').to_string();
        let response_data_obj = DataObject::from_string(&msg_str);
        let pid_val = response_data_obj.get_int("pid");
        conn.res.put_object(&pid_val.to_string(), response_data_obj);
    } 

    true
}

pub fn encrypt(cipher: &Aes256, buf: &[u8]) -> Vec<u8> {
    let mut temp_buf = buf.to_vec();
    while temp_buf.len() % 16 != 0 {
        temp_buf.push(0);
    }

    let mut result_buf = Vec::with_capacity(temp_buf.len());
    for chunk in temp_buf.chunks(16) {
        let mut block = GenericArray::clone_from_slice(chunk);
        cipher.encrypt_block(&mut block);
        result_buf.extend_from_slice(block.as_slice());
    }
    result_buf
}

pub fn decrypt(cipher: &Aes256, buf: &[u8]) -> Vec<u8> {
    if buf.len() % 16 != 0 { return Vec::new(); }
    let mut result_buf = Vec::with_capacity(buf.len());
    for chunk in buf.chunks(16) {
        let mut block = GenericArray::clone_from_slice(chunk);
        cipher.decrypt_block(&mut block);
        result_buf.extend_from_slice(block.as_slice());
    }
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
