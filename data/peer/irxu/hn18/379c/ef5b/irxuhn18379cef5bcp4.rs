    do_init();
    do_listen(ipaddr, port)
}

// --- Custom Error Type for P2P Operations (primarily for internal io::Result conversions) ---
#[derive(Debug)]
pub enum P2PError {
    Io(io::Error),
    Crypto(String),
    Logic(String),
    NotFound(String), // Added for cases like SID not found
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


// --- Helper for Global SharedMutex Initialization (using AtomicPtr) ---
// Initialization states for GlobalSharedMutex
const GLOBAL_UNINITIALIZED: usize = 0;
const GLOBAL_INITIALIZING: usize = 1;
const GLOBAL_INITIALIZED: usize = 2;

#[derive(Debug)]
struct GlobalSharedMutex<T: Send> {
    state: AtomicUsize, // Tracks initialization state
    ptr: AtomicPtr<SharedMutex<T>>, // Stores a raw pointer to the heap-allocated SharedMutex
}

impl<T: Send> GlobalSharedMutex<T> {
    const fn new() -> Self {
        GlobalSharedMutex {
            state: AtomicUsize::new(GLOBAL_UNINITIALIZED),
            ptr: AtomicPtr::new(std::ptr::null_mut()),
        }
    }

    fn initialize(&self, initial_data: T) {
        // Attempt to transition from UNINITIALIZED to INITIALIZING
        match self.state.compare_exchange(
            GLOBAL_UNINITIALIZED,
            GLOBAL_INITIALIZING,
            AtomicOrdering::Acquire, // Ensure visibility for other potential initializers
            AtomicOrdering::Relaxed, // Relaxed on failure, we'll check the actual state
        ) {
            Ok(_) => { // Successfully transitioned to INITIALIZING, this thread does the work
                // 1. Create SharedMutex::new() (pointers are null, state is Uninitialized)
                let new_sm = SharedMutex::new();
                // 2. Box it to get a stable heap address.
                let mut boxed_sm = Box::new(new_sm);
                // 3. Call set() ON THE BOXED INSTANCE.
                //    Now, lock_ptr and data_ptr will be set relative to the heap location.
                boxed_sm.set(initial_data);

                // Store the raw pointer. Box::into_raw leaks the Box, its memory is now managed by GlobalSharedMutex.
                self.ptr.store(Box::into_raw(boxed_sm), AtomicOrdering::Release);
                // Mark as INITIALIZED
                self.state.store(GLOBAL_INITIALIZED, AtomicOrdering::Release); // Release to publish the ptr and state
            }
            Err(current_state) => {
                if current_state == GLOBAL_INITIALIZING {
                    // Another thread is initializing, spin until it's done
                    while self.state.load(AtomicOrdering::Acquire) == GLOBAL_INITIALIZING {
                        std::hint::spin_loop();
                    }
                    if self.state.load(AtomicOrdering::Relaxed) != GLOBAL_INITIALIZED {
                        panic!("[GLOBAL_INIT] CRITICAL: SharedMutex failed to initialize correctly after spinning.");
                    }
                } else if current_state == GLOBAL_INITIALIZED {
                    // Already initialized by another thread or a previous call.
                    panic!("[GLOBAL_INIT] GlobalSharedMutex::initialize called more than once.");
                } else {
                    // Should not happen with the defined states.
                    panic!("[GLOBAL_INIT] GlobalSharedMutex in unexpected state during init: {}", current_state);
                }
            }
        }
    }

    fn get(&self) -> &SharedMutex<T> {
        // Ensure initialization has completed.
        // Spin if another thread is currently initializing.
        loop {
            match self.state.load(AtomicOrdering::Acquire) {
                GLOBAL_INITIALIZED => {
                    let ptr = self.ptr.load(AtomicOrdering::Acquire);
                    // SAFETY:
                    // 1. If state is INITIALIZED, ptr is guaranteed to be non-null and valid
                    //    because initialize() sets it before changing state to INITIALIZED.
                    // 2. The pointer was obtained from Box::into_raw, pointing to a valid SharedMutex<T>.
                    // 3. For static GlobalSharedMutex, this memory is leaked and lives for the program's duration.
                    // 4. Access is to &SharedMutex<T>, and SharedMutex itself handles internal synchronization.
                    debug_assert!(!ptr.is_null(), "GlobalSharedMutex ptr is null despite being initialized");
                    return unsafe { &*ptr };
                }
                GLOBAL_INITIALIZING => {
                    std::hint::spin_loop(); // Wait for initialization to complete
                }
                GLOBAL_UNINITIALIZED => {
                    panic!("[GLOBAL_INIT] GlobalSharedMutex not initialized. Call initialize() first.");
                }
                _ => unreachable!("[GLOBAL_INIT] GlobalSharedMutex in invalid state during get()"),
            }
        }
    }
}

// SAFETY: GlobalSharedMutex is Send and Sync if T is Send.
unsafe impl<T: Send> Sync for GlobalSharedMutex<T> {}
unsafe impl<T: Send> Send for GlobalSharedMutex<T> {}

static INIT_GLOBALS_ONCE: Once = Once::new();

static P2PCONS: GlobalSharedMutex<HashMap<i64, P2PConnection>> = GlobalSharedMutex::new();
static STREAMWRITERS: GlobalSharedMutex<HashMap<i64, i64>> = GlobalSharedMutex::new();
static STREAMREADERS: GlobalSharedMutex<HashMap<i64, DataBytes>> = GlobalSharedMutex::new();
static P2PCONLOCKS: GlobalSharedMutex<HashMap<String, AtomicBool>> = GlobalSharedMutex::new();


fn do_init() {
    INIT_GLOBALS_ONCE.call_once(|| {
    //  println!("[INIT] Initializing global P2P HashMaps with SharedMutex.");
        P2PCONS.initialize(HashMap::new());
        STREAMWRITERS.initialize(HashMap::new());
        STREAMREADERS.initialize(HashMap::new());
        P2PCONLOCKS.initialize(HashMap::new());
    //  println!("[INIT] Global P2P HashMaps initialized.");
    });
}

#[derive(Debug)]
pub struct RelayStream {
    from: String,
    to: String,
    buf: DataArray,
    data: DataObject,
}

impl RelayStream {
    pub fn new(from: String, to: String) -> RelayStream {
        let mut o = DataObject::new();
        o.put_int("last_contact", time());
        RelayStream {
            from: from,
            to: to,
            buf: DataArray::new(),
            data: o,
        }
    }

    pub fn duplicate(&self) -> RelayStream {
        RelayStream {
            from: self.from.to_owned(),
            to: self.to.to_owned(),
            buf: self.buf.clone(),
            data: self.data.clone(),
        }
    }

    pub fn last_contact(&self) -> i64 {
        self.data.get_int("last_contact")
    }
}

#[derive(Debug)]
pub enum P2PStream {
    Tcp(TcpStream),
    Relay(RelayStream),
    Udp(UdpStream),
}

impl P2PStream {
    pub fn is_tcp(&self) -> bool {
        match self {
            P2PStream::Tcp(_stream) => true,
            _ => false,
        }
    }

    pub fn is_udp(&self) -> bool {
        match self {
            P2PStream::Udp(_stream) => true,
            _ => false,
        }
    }

    pub fn is_relay(&self) -> bool {
        match self {
            P2PStream::Relay(_stream) => true,
            _ => false,
        }
    }

    pub fn mode(&self) -> String {
        match self {
            P2PStream::Tcp(_stream) => "TCP".to_string(),
            P2PStream::Relay(_stream) => "RELAY".to_string(),
            P2PStream::Udp(_stream) => "UDP".to_string(),
        }
    }

    pub fn try_clone(&self) -> io::Result<P2PStream> {
        match self {
            P2PStream::Tcp(stream) => {
                let s2 = stream.try_clone()?;
                Ok(P2PStream::Tcp(s2))
            }
            P2PStream::Relay(stream) => {
                let rs_dup = stream.duplicate();
                Ok(P2PStream::Relay(rs_dup))
            }
            P2PStream::Udp(stream) => {
                let udp_dup = stream.duplicate();
                Ok(P2PStream::Udp(udp_dup))
            }
        }
    }

    /// Tries to acquire a logical lock for a given Session ID (SID).
    /// Returns:
    /// - `Ok(true)`: Lock was busy (already true), current thread did not acquire it.
    /// - `Ok(false)`: Lock was free (false), current thread acquired it (set to true).
    /// - `Err(P2PError::NotFound)`: SID not found in locks map.
    fn try_lock(&self, sid: String) -> Result<bool, P2PError> {
        if &sid == "HANDSHAKE" {
            return Ok(false); // Handshake "lock" is implicitly acquired by caller, always "succeeds" here.
        }
        let p2pconlocks_guard = P2PCONLOCKS.get().read();
        if let Some(lock_atomic_bool) = p2pconlocks_guard.get(&sid) {
            // swap returns the *previous* value.
            // If previous was true (busy), we return Ok(true) indicating it was busy.
            // If previous was false (free), we return Ok(false) indicating we got it.
            Ok(lock_atomic_bool.swap(true, AtomicOrdering::AcqRel))
        } else {
            // Instead of panicking, return an error that can be handled by the caller.
            Err(P2PError::NotFound(format!("Lock for SID '{}' not found in P2PCONLOCKS.", sid)))
        }
    }

    fn release_lock(&self, sid: String) {
        if &sid != "HANDSHAKE" {
            let p2pconlocks_guard = P2PCONLOCKS.get().read();
            if let Some(lock_atomic_bool) = p2pconlocks_guard.get(&sid) {
                lock_atomic_bool.store(false, AtomicOrdering::Release);
            }
        }
    }

    pub fn write(&mut self, buf: &[u8], sid: String) -> io::Result<usize> {
        let mut timeout = 0;
        loop {
            match self.try_lock(sid.clone()) {
                Ok(true) => { // Lock was busy (previous value was true)
                    timeout += 1;
                    let beat = Duration::from_millis(timeout.min(450));
                    thread::sleep(beat);
                    if timeout > 450 {
                        let form = format!("Unusually long wait writing to stream, aborting [{}]", &sid);
                    //  println!("[P2P_STREAM_WRITE] TIMEOUT for SID '{}': {}", sid, form);
                        // Release the lock if we somehow acquired it before timeout, though logic implies we didn't.
                        // This is more of a safeguard if the loop logic changes.
                        self.release_lock(sid.clone());
                        return Err(io::Error::new(io::ErrorKind::BrokenPipe, form));
                    }
                }
                Ok(false) => { // Lock acquired (previous value was false)
                    break;
                }
                Err(P2PError::NotFound(msg)) => {
                //  println!("[P2P_STREAM_WRITE] Error acquiring lock for SID '{}': {}", sid, msg);
                    // No lock to release as it was not found/acquired.
                    return Err(io::Error::new(io::ErrorKind::BrokenPipe, msg)); // Or NotFound
                }
                Err(P2PError::Io(e)) => { // Should not happen from try_lock as defined
                 //  println!("[P2P_STREAM_WRITE] IO Error during try_lock for SID '{}': {}", sid, e);
                    return Err(e);
                }
                Err(e) => { // Other P2PError types
                 //  println!("[P2P_STREAM_WRITE] Generic P2PError during try_lock for SID '{}': {}", sid, e);
                    return Err(io::Error::new(io::ErrorKind::Other, e.to_string()));
                }
            }
        }


        let final_result: io::Result<usize>;
        match self {
            P2PStream::Tcp(stream) => {
                let mut total_written = 0;
                let mut current_result: io::Result<usize> = Ok(0);

                while total_written < buf.len() {
                    match stream.write(&buf[total_written..]) {
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
            P2PStream::Relay(stream_relay) => {
                let from = &stream_relay.from.clone();
                let to = &stream_relay.to;

                let user_opt = get_user(&from);
                if user_opt.is_none() {
                    self.release_lock(sid.clone());
                    return Err(io::Error::new(io::ErrorKind::NotFound, format!("No such relay user {}", from)));
                }
                let user = user_opt.unwrap();

                let con_opt = get_tcp(user);
                if con_opt.is_none() {
                     self.release_lock(sid.clone());
                     return Err(io::Error::new(io::ErrorKind::NotConnected, format!("No TCP route to relay {}", from)));
                }

                let con = con_opt.unwrap();
                let cipher = con.cipher;
                let mut p2p_stream_clone = con.stream.try_clone()?;

                let mut bytes_to_send = ("fwd ".to_string() + &to).as_bytes().to_vec();
                bytes_to_send.extend_from_slice(buf);

                let encrypted_buf = encrypt(&cipher, &bytes_to_send);
                let len = encrypted_buf.len() as i16;

                let mut final_bytes = len.to_be_bytes().to_vec();
                final_bytes.extend_from_slice(&encrypted_buf);

                final_result = p2p_stream_clone.write(&final_bytes, con.sessionid);
            }
            P2PStream::Udp(stream_udp) => {
                final_result = stream_udp.write(buf);
            }
        }
        self.release_lock(sid.clone());
        final_result
    }

    pub fn read_exact(&mut self, buf: &mut [u8]) -> io::Result<()> {
        match self {
            P2PStream::Tcp(stream) => {
                stream.read_exact(buf)
            }
            P2PStream::Relay(stream) => {
                let len_to_read = buf.len();
                let mut total_bytes_read = 0;
                while total_bytes_read < len_to_read {
                    let mut timeout = 0;
                    while stream.buf.len() == 0 {
                        timeout += 1;
                        let beat = Duration::from_millis(timeout.min(450));
                        thread::sleep(beat);
                        if timeout > 450 {
                        //  println!("[P2P_STREAM_READ_EXACT] Relay TIMEOUT for con id {}, waiting for {} bytes", stream.data.get_int("id"), len_to_read - total_bytes_read);
                            return Err(io::Error::new(io::ErrorKind::TimedOut, "Timeout waiting for relay data"));
                        }
                    }

                    if stream.buf.len() > 0 {
                        let data_item = stream.buf.get_property(0);
                        if let Data::DBytes(bytes_ref) = data_item {
                            let data_bytes_handle = DataBytes::get(bytes_ref);
                            let available_data = data_bytes_handle.get_data();

                            let bytes_to_copy = std::cmp::min(available_data.len(), len_to_read - total_bytes_read);

                            buf[total_bytes_read .. total_bytes_read + bytes_to_copy].copy_from_slice(&available_data[0..bytes_to_copy]);
                            total_bytes_read += bytes_to_copy;

                            if bytes_to_copy == available_data.len() {
                                stream.buf.remove_property(0);
                            } else {
                                let remaining_data = available_data[bytes_to_copy..].to_vec();
                                data_bytes_handle.set_data(&remaining_data);
                            }
                        } else {
                            stream.buf.remove_property(0);
                            return Err(io::Error::new(io::ErrorKind::InvalidData, "Relay buffer contained non-DataBytes item"));
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
            P2PStream::Tcp(stream) => stream.peer_addr(),
            P2PStream::Relay(_stream) => Err(io::Error::new(io::ErrorKind::Unsupported, "peer_addr not supported for RelayStream")),
            P2PStream::Udp(stream) => Ok(stream.src),
        }
    }

    pub fn describe(&self) -> String {
        match self {
            P2PStream::Tcp(stream) => {
                match stream.peer_addr() {
                    Ok(addr) => addr.to_string(),
                    Err(_) => "TCP (disconnected)".to_string(),
                }
            }
            P2PStream::Relay(stream) => format!("via {} to {}", stream.from, stream.to),
            P2PStream::Udp(stream) => stream.src.to_string(),
        }
    }

    pub fn shutdown(&self) -> io::Result<()> {
        match self {
            P2PStream::Tcp(stream) => stream.shutdown(Shutdown::Both),
            P2PStream::Relay(_stream) => Ok(()),
            P2PStream::Udp(stream) => {
                let mut cloned_udp_stream_data = stream.duplicate().data;
                cloned_udp_stream_data.put_boolean("dead", true);
                Ok(())
            }
        }
    }

    pub fn peek(&self, buf: &mut [u8]) -> io::Result<usize> {
        match self {
            P2PStream::Tcp(stream) => stream.peek(buf),
            P2PStream::Relay(_stream) => Err(io::Error::new(io::ErrorKind::Unsupported, "peek not supported for RelayStream")),
            P2PStream::Udp(_stream) => Err(io::Error::new(io::ErrorKind::Unsupported, "peek not supported for UdpStream")),
        }
    }

    pub fn last_contact(&self) -> i64 {
        match self {
            P2PStream::Tcp(_stream) => time(),
            P2PStream::Relay(stream) => stream.last_contact(),
            P2PStream::Udp(stream) => stream.last_contact(),
        }
    }
}

#[derive(Debug)]
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
        let cloned_stream = self.stream.try_clone()
            .expect(&format!("[P2P_CONN_DUPLICATE] Failed to clone P2PStream for SID: {}", self.sessionid));
        P2PConnection {
            stream: cloned_stream,
            sessionid: self.sessionid.clone(),
            cipher: self.cipher.clone(),
            uuid: self.uuid.clone(),
            res: self.res.clone(),
            pending: self.pending.clone(),
        }
    }

    pub fn begin(uuid: String, stream: P2PStream) -> (i64, P2PConnection) {
    //  println!("[P2P_CONN_BEGIN] Attempting for UUID: {}, stream mode: {}", uuid, stream.mode());
        do_init();
        let user = get_user(&uuid)
            .expect(&format!("[P2P_CONN_BEGIN] User not found for UUID '{}'", uuid));
        let mut cons = user.get_array("connections");

        let system = DataStore::globals().get_object("system");
        let runtime = system.get_object("apps").get_object("app").get_object("runtime");

        let my_private_hex = runtime.get_string("privatekey");
        let my_private_bytes = decode_hex(&my_private_hex)
            .expect("[P2P_CONN_BEGIN] Failed to decode private key");
        let my_private_arr: [u8; 32] = my_private_bytes.try_into()
            .expect("[P2P_CONN_BEGIN] Private key slice with incorrect length");

        let peer_public_hex = user.get_string("publickey");
        let peer_public_bytes = decode_hex(&peer_public_hex)
            .expect("[P2P_CONN_BEGIN] Failed to decode peer public key");
        let peer_public_arr: [u8; 32] = peer_public_bytes.try_into()
            .expect("[P2P_CONN_BEGIN] Peer public key slice with incorrect length");

        let shared_secret = x25519(my_private_arr, peer_public_arr);
        let key = GenericArray::from(shared_secret);
        let cipher = Aes256::new(&key);

        let sessionid = unique_session_id();
    //  println!("[P2P_CONN_BEGIN] Creating new P2PConnection struct for SID: {}", sessionid);
        let new_p2p_connection = P2PConnection {
            stream: stream,
            sessionid: sessionid.to_owned(),
            cipher: cipher,
            uuid: uuid.to_string(),
            res: DataObject::new(),
            pending: DataArray::new(),
        };
    //  println!("[P2P_CONN_BEGIN] P2PConnection struct created for SID: {}", new_p2p_connection.sessionid);


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
        //  println!("[P2P_CONN_BEGIN] Acquiring P2PCONS and P2PCONLOCKS write locks for SID: {}", new_p2p_connection.sessionid);
            let mut p2pcons_map_guard = P2PCONS.get().lock();
            let mut p2pconlocks_map_guard = P2PCONLOCKS.get().lock();
        //  println!("[P2P_CONN_BEGIN] Acquired P2PCONS and P2PCONLOCKS write locks for SID: {}", new_p2p_connection.sessionid);

        //  println!("[P2P_CONN_BEGIN] Entering loop to find conid for SID: {}", new_p2p_connection.sessionid);
            loop {
                let random_id = rand_i64();

                if !p2pcons_map_guard.contains_key(&random_id) {
                    conid = random_id;
                //  println!("[P2P_CONN_BEGIN] Generated conid: {}. Preparing to insert SID: {}", conid, new_p2p_connection.sessionid);

                    let duplicated_conn_for_map = new_p2p_connection.duplicate();

                    p2pcons_map_guard.insert(conid, duplicated_conn_for_map);
                //  println!("[P2P_CONN_BEGIN] Inserted into P2PCONS. Inserting into P2PCONLOCKS for SID: {}", new_p2p_connection.sessionid);

                    p2pconlocks_map_guard.insert(new_p2p_connection.sessionid.clone(), AtomicBool::new(false));
                //  println!("[P2P_CONN_BEGIN] Inserted into P2PCONLOCKS. Pushing conid to user's connections array.");

                    cons.push_int(conid);
                //  println!("[P2P_CONN_BEGIN] Inserted conid {} (SID {}) into P2PCONS and P2PCONLOCKS successfully.", conid, new_p2p_connection.sessionid);
                    break;
                }
            }
        //  println!("[P2P_CONN_BEGIN] Releasing P2PCONS and P2PCONLOCKS write locks for SID: {}", new_p2p_connection.sessionid);
        }

        fire_event("peer", "UPDATE", user_to_peer(user.clone(), uuid.to_string()));
        fire_event("peer", "CONNECT", user_to_peer(user.clone(), uuid.to_string()));
    //  println!("[P2P_CONN_BEGIN] Success for UUID: {}, conid: {}, sessionid: {}", uuid, conid, new_p2p_connection.sessionid);
    //  println!("P2P {} Connect {} / {} / {} / {}", new_p2p_connection.stream.mode(), new_p2p_connection.stream.describe(), new_p2p_connection.sessionid, user.get_string("displayname"), uuid);

        (conid, new_p2p_connection)
    }

    pub fn shutdown(&self, uuid_str: &str, conid: i64) -> io::Result<()> {
    //  println!("[P2P_CONN_SHUTDOWN] Attempting for UUID: {}, conid: {}", uuid_str, conid);
        do_init();
        let user_opt = get_user(uuid_str);
        //let mut uname = "??".to_string();

        if let Some(user) = user_opt {
            //uname = user.get_string("displayname");
            user.get_array("connections").remove_data(Data::DInt(conid));
            fire_event("peer", "UPDATE", user_to_peer(user.clone(), uuid_str.to_string()));
            fire_event("peer", "DISCONNECT", user_to_peer(user.clone(), uuid_str.to_string()));
        }

        let mut removed_con_opt: Option<P2PConnection> = None;
        {
        //  println!("[P2P_CONN_SHUTDOWN] Acquiring P2PCONS and P2PCONLOCKS write locks for conid: {}", conid);
            let mut p2pcons_map_guard = P2PCONS.get().lock();
            let mut p2pconlocks_map_guard = P2PCONLOCKS.get().lock();
        //  println!("[P2P_CONN_SHUTDOWN] Acquired P2PCONS and P2PCONLOCKS write locks for conid: {}", conid);

            if let Some(conn_to_remove) = p2pcons_map_guard.remove(&conid) {
            //  println!("[P2P_CONN_SHUTDOWN] Removing SID '{}' from P2PCONLOCKS for conid: {}", conn_to_remove.sessionid, conid);
                p2pconlocks_map_guard.remove(&conn_to_remove.sessionid);
                removed_con_opt = Some(conn_to_remove);
            } else {
            //  println!("[P2P_CONN_SHUTDOWN] Conid {} not found in P2PCONS.", conid);
            }
        //  println!("[P2P_CONN_SHUTDOWN] Releasing P2PCONS and P2PCONLOCKS write locks for conid: {}", conid);
        }

        if let Some(removed_con) = removed_con_opt {
        //  println!("[P2P_CONN_SHUTDOWN] Processing removed connection for conid: {}, SID: {}", conid, removed_con.sessionid);
            let shutdown_result = removed_con.stream.shutdown(); // Operate on the removed connection's stream

            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");
            err_obj.put_string("msg", "Connection closed");

            let mut res_clone_for_pending = removed_con.res.clone();
            for pid_data in removed_con.pending.objects() {
                if let Data::DInt(pid_val) = pid_data {
                    res_clone_for_pending.put_object(&pid_val.to_string(), err_obj.clone());
                }
            }
            // Note: res_clone_for_pending is a clone. If these updates need to affect a global state,
            // the P2PConnection's `res` field might need to be an Arc<SharedMutex<DataObject>> itself,
            // or updates handled differently. For now, this modifies a local clone.

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

        //  println!("[P2P_CONN_SHUTDOWN] Success for UUID: {}, conid: {}", uuid_str, conid);
        //  println!("P2P {} Disconnect {} / {} / {} / {}", removed_con.stream.mode(), removed_con.stream.describe(), removed_con.sessionid, uname, uuid_str);
            return shutdown_result;
        }

    //  println!("[P2P_CONN_SHUTDOWN] No connection found to remove for conid: {}. Returning Ok.", conid);
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
            //  println!("[WRITE_STREAM] Timeout waiting for join for upstream_id {}. Discarding stream.", upstream_id);
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


// Helper function to get the best connection (TCP > UDP > Relay)
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

// Helper function to get a TCP connection
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

// Helper function to get a UDP connection
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

// Helper function to get a Relay connection
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
        None => {
            eprintln!("[RELAY] Target user {} not found", to_uuid);
            return None;
        }
    };
    let user_connections = user_to.get_array("connections");

    {
        let p2pcons_guard = P2PCONS.get().read();
        for con_id_data in user_connections.objects() {
            if let Data::DInt(conid) = con_id_data {
                if let Some(p2p_conn_ref) = p2pcons_guard.get(&conid) {
                    if let P2PStream::Relay(ref relay_stream) = p2p_conn_ref.stream {
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
        let p2p_stream = P2PStream::Relay(new_relay_stream);
        let (_conid, new_conn) = P2PConnection::begin(to_uuid.to_string(), p2p_stream);
        return Some(new_conn);
    }
    None
}

/* Helper to ensure all bytes are written to the stream
fn write_all_to_stream(stream: &mut P2PStream, buf: &[u8], context: &str) -> io::Result<()> {
    match stream.write(buf, "HANDSHAKE".to_string()) { // Using "HANDSHAKE" as sid for these internal writes
        Ok(n) if n == buf.len() => Ok(()),
        Ok(n) => {
            eprintln!("[HANDSHAKE] {} Partial write. Expected {}, wrote {}.", context, buf.len(), n);
            Err(io::Error::new(io::ErrorKind::WriteZero, format!("Partial write during handshake: {}", context)))
        }
        Err(e) => {
            eprintln!("[HANDSHAKE] {} Write error: {}", context, e);
            Err(e)
        }
    }
}
*/

pub fn handshake(stream: &mut P2PStream, peer: Option<String>) -> Option<(i64, P2PConnection)> {
  let system = DataStore::globals().get_object("system");
  let runtime = system.get_object("apps").get_object("app").get_object("runtime");
  let my_uuid = runtime.get_string("uuid");

  // FIXME - move cipher generation to its own function
  let my_public = runtime.get_string("publickey");
//  let my_private = runtime.get_string("privatekey");
//  let my_private = decode_hex(&my_private).unwrap();
//  let my_private: [u8; 32] = my_private.try_into().expect("slice with incorrect length");
//  let my_private = StaticSecret::from(my_private);
    let my_private_hex = runtime.get_string("privatekey");
    let my_private = decode_hex(&my_private_hex).unwrap();
    let my_private: [u8; 32] = my_private.try_into().expect("slice with incorrect length");

  // Temp key pair for initial exchange
  //let my_session_private = StaticSecret::new(OsRng);
  //let my_session_public = PublicKey::from(&my_session_private);
  let (my_session_private, my_session_public) = generate_x25519_keypair();

  // Send temp pubkey if init
  let init = peer.is_some();
  if init { let _x = stream.write(&my_session_public, "HANDSHAKE".to_string()).unwrap(); }

  // Read remote temp pubkey
  let mut bytes = vec![0u8; 32];
  let _x = stream.read_exact(&mut bytes);
  if _x.is_err() { return None;}
  //let _x = x.unwrap();
  let remote_session_public: [u8; 32] = bytes.try_into().expect("slice with incorrect length");
  //let remote_session_public = PublicKey::from(remote_session_public);

  // Send temp pubkey if not init
  if !init { let _x = stream.write(&my_session_public, "HANDSHAKE".to_string()).unwrap(); }

  // Temp cipher for initial exchange
  //let shared_secret = my_session_private.diffie_hellman(&remote_session_public);
  //let key = GenericArray::from(shared_secret.to_bytes());
  //let cipher = Aes256::new(&key);
  let shared_secret = x25519(my_session_private, remote_session_public);
  let key = GenericArray::from(shared_secret);
  let cipher = Aes256::new(&key);

  // Send my UUID
  let bytes = encrypt(&cipher, my_uuid.as_bytes());
  let _x = stream.write(&bytes, "HANDSHAKE".to_string()).unwrap();

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
    let _x = stream.write(&[my_step], "HANDSHAKE".to_string()).unwrap();

    //read remote_step
    let mut bytes = vec![0u8; 1];
    let x = stream.read_exact(&mut bytes);
    if x.is_err() { return None; }

    let remote_step = bytes[0];

    // Remote step
    if remote_step == 0 {
      let bytes = encrypt(&cipher, &decode_hex(&my_public).unwrap());
      let _x = stream.write(&bytes, "HANDSHAKE".to_string()).unwrap();
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
    //let peer_public = PublicKey::from(peer_public);
    //let shared_secret = my_private.diffie_hellman(&peer_public);
    //let key = GenericArray::from(shared_secret.to_bytes());
    //let cipher = Aes256::new(&key);

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
        let buf = encrypt(&cipher, "All is good now!".as_bytes());
        let _x = stream.write(&buf, "HANDSHAKE".to_string()).unwrap();
        isok = true;
      }
    }
    else {
      let buf = encrypt(&cipher, "What's good, yo?".as_bytes());
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
        Err(e) => {
            eprintln!("[DO_LISTEN] Failed to bind to {}: {}", socket_address, e);
            return -1;
        }
    };

    let actual_port = listener.local_addr().expect("[DO_LISTEN] Failed to get local address from listener").port();

    let system_globals = DataStore::globals().get_object("system");
    let mut peer_runtime_config = system_globals.get_object("apps").get_object("peer").get_object("runtime");
    peer_runtime_config.put_int("port", actual_port as i64);

    if port == 0 {
        let properties_path = Path::new("runtime").join("peer").join("botd.properties");
        if let Some(parent_dir) = properties_path.parent() {
            fs::create_dir_all(parent_dir).unwrap_or_else(|e| {
                eprintln!("[DO_LISTEN] Failed to create directory for botd.properties: {}", e);
            });
        }
        let _ = write_properties(properties_path.to_string_lossy().into_owned(), peer_runtime_config);
    }

  println!("P2P TCP listening on port {}", actual_port);

    thread::spawn(move || {
    //  println!("[DO_LISTEN] Listener thread started for port {}", actual_port);
        for stream_result in listener.incoming() {
            if !DataStore::globals().get_object("system").get_boolean("running") {
            //  println!("[DO_LISTEN] System not running, stopping P2P listener thread for port {}.", actual_port);
                break;
            }
            match stream_result {
                Ok(tcp_stream) => {
                //  let peer_addr_for_log = tcp_stream.peer_addr().map_or_else(|_| "unknown".to_string(), |a| a.to_string());
                //  println!("[DO_LISTEN] Accepted new connection from {}, spawning handler thread.", peer_addr_for_log);
                    thread::spawn(move || {
                        let remote_addr_str = tcp_stream.peer_addr().map_or_else(|_| "unknown".to_string(), |a| a.to_string());
                    //  println!("[HANDLER_THREAD {}] Started.", remote_addr_str);
                        let mut event_data = DataObject::new();
                        event_data.put_string("addr", &remote_addr_str);
                        fire_event("peer", "TCP_REQUEST_RECEIVED", event_data);

                        let mut p2p_stream = P2PStream::Tcp(tcp_stream);
                        if let Some((conid, p2p_connection)) = handshake(&mut p2p_stream, None) {
                        //  println!("[HANDLER_THREAD {}] Handshake successful, conid: {}. Calling handle_connection.", remote_addr_str, conid);
                            handle_connection(conid, p2p_connection);
                        //  println!("[HANDLER_THREAD {}] handle_connection finished for conid: {}.", remote_addr_str, conid);
                        } else {
                        //  println!("[HANDLER_THREAD {}] Handshake FAILED.", remote_addr_str);
                            let _ = p2p_stream.shutdown();
                        }
                    //  println!("[HANDLER_THREAD {}] Terminating.", remote_addr_str);
                    });
                }
                Err(e) => {
                    eprintln!("[DO_LISTEN] Listener incoming connection error on port {}: {}", actual_port, e);
                }
            }
        }
    //  println!("[DO_LISTEN] Listener thread for port {} terminated.", actual_port);
    });
    actual_port as i64
}


pub fn handle_connection(conid: i64, p2p_conn: P2PConnection) {
//  println!("[HANDLE_CONNECTION] Started for conid: {}", conid);
    let current_connection = p2p_conn;
    let system_globals = DataStore::globals().get_object("system");

    while system_globals.get_boolean("running") {
        if !handle_next_message(current_connection.duplicate()) {
        //  println!("[HANDLE_CONNECTION] handle_next_message returned false for conid: {}, SID: {}. Terminating loop.", conid, current_connection.sessionid);
            break;
        }
    }

//  println!("[HANDLE_CONNECTION] Loop terminated for conid: {}. Shutting down connection.", conid);
    let _ = current_connection.shutdown(&current_connection.uuid, conid);
//  println!("[HANDLE_CONNECTION] Finished for conid: {}", conid);
}


pub fn handle_next_message(mut conn: P2PConnection) -> bool {
    let system_globals = DataStore::globals().get_object("system");
    let sessions_map = system_globals.get_object("sessions");
    let mut current_session = sessions_map.get_object(&conn.sessionid);

//  println!("[HANDLE_NEXT_MSG SID {}] Attempting to read 2-byte length from stream: {:?}", conn.sessionid, conn.stream.describe());
    let mut len_bytes = vec![0u8; 2];
    if let Err(e) = conn.stream.read_exact(&mut len_bytes) {
        eprintln!("[HANDLE_NEXT_MSG SID {}] read_exact for length failed: {}. Stream: {:?}", conn.sessionid, e, conn.stream.describe());
        return false;
    }
//  println!("[HANDLE_NEXT_MSG SID {}] Read 2-byte length: {:02X?}", conn.sessionid, len_bytes);


    let msg_len_arr: [u8; 2] = match len_bytes.try_into() {
        Ok(arr) => arr,
        Err(e) => {
            eprintln!("[HANDLE_NEXT_MSG SID {}] Connection corrupted (len_bytes wrong size: {:?}): {:?}", conn.sessionid, e, conn.stream.describe());
            return false;
        }
    };
    let msg_len = i16::from_be_bytes(msg_len_arr) as usize;
//  println!("[HANDLE_NEXT_MSG SID {}] Parsed message length: {}", conn.sessionid, msg_len);


    if msg_len == 0 || msg_len > 16400 {
        eprintln!("[HANDLE_NEXT_MSG SID {}] Connection corrupted (invalid message length: {}): {:?}", conn.sessionid, msg_len, conn.stream.describe());
        return false;
    }

    let mut encrypted_payload_bytes = vec![0u8; msg_len];
    if let Err(e) = conn.stream.read_exact(&mut encrypted_payload_bytes) {
        eprintln!("[HANDLE_NEXT_MSG SID {}] Connection dropped (payload read failed: {}): {:?}", conn.sessionid, e, conn.stream.describe());
        return false;
    }
 //  println!("[HANDLE_NEXT_MSG SID {}] Read encrypted payload ({} bytes): {:02X?}...", conn.sessionid, encrypted_payload_bytes.len(), &encrypted_payload_bytes[..std::cmp::min(32, encrypted_payload_bytes.len())]);


    let decrypted_payload = decrypt(&conn.cipher, &encrypted_payload_bytes);
    if decrypted_payload.is_empty() && !encrypted_payload_bytes.is_empty() { // decrypt returns empty on error (e.g. non-multiple of 16)
         eprintln!("[HANDLE_NEXT_MSG SID {}] Decryption failed (likely due to non-block-size length {}). Encrypted payload was: {:02X?}...", conn.sessionid, encrypted_payload_bytes.len(), &encrypted_payload_bytes[..std::cmp::min(32, encrypted_payload_bytes.len())]);
        return false;
    }
    if decrypted_payload.len() < 4 {
        eprintln!("[HANDLE_NEXT_MSG SID {}] Connection corrupted (payload too short after decryption, len {}). Decrypted: {:02X?}", conn.sessionid, decrypted_payload.len(), decrypted_payload);
        return false;
    }
 //  println!("[HANDLE_NEXT_MSG SID {}] Decrypted payload ({} bytes): {:02X?}...", conn.sessionid, decrypted_payload.len(), &decrypted_payload[..std::cmp::min(32, decrypted_payload.len())]);


    let method_str = match String::from_utf8(decrypted_payload[0..4].to_vec()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[HANDLE_NEXT_MSG SID {}] Connection corrupted (invalid method UTF-8: {}): {:?}", conn.sessionid, e, conn.stream.describe());
            return false;
        }
    };
//  println!("[HANDLE_NEXT_MSG SID {}] Method: '{}'", conn.sessionid, method_str);


    let session_timeout_millis = system_globals.get_object("config").get_int("sessiontimeoutmillis");
    current_session.put_int("expire", time() + session_timeout_millis);
    let new_count = current_session.get_int("count") + 1;
    current_session.put_int("count", new_count);

    if method_str == "s_1 " {
        if decrypted_payload.len() < 20 { eprintln!("[HANDLE_NEXT_MSG SID {}] s_1 payload too short", conn.sessionid); return false; }
        let writer_stream_id = i64::from_be_bytes(decrypted_payload[4..12].try_into().expect("[HANDLE_NEXT_MSG] s_1 writer_id slice error"));
        let reader_downstream_id = i64::from_be_bytes(decrypted_payload[12..20].try_into().expect("[HANDLE_NEXT_MSG] s_1 reader_id slice error"));

        let mut streamwriters_map_guard = STREAMWRITERS.get().lock();
        streamwriters_map_guard.insert(writer_stream_id, reader_downstream_id);

    } else if method_str == "s_2 " {
        if decrypted_payload.len() < 14 { eprintln!("[HANDLE_NEXT_MSG SID {}] s_2 payload too short for header", conn.sessionid); return false; }
        let reader_downstream_id = i64::from_be_bytes(decrypted_payload[4..12].try_into().expect("[HANDLE_NEXT_MSG] s_2 reader_id slice error"));
        let data_chunk_len = i16::from_be_bytes(decrypted_payload[12..14].try_into().expect("[HANDLE_NEXT_MSG] s_2 data_len slice error")) as usize;

        if decrypted_payload.len() < 14 + data_chunk_len { eprintln!("[HANDLE_NEXT_MSG SID {}] s_2 payload too short for data (expected {}, got {})", conn.sessionid, 14 + data_chunk_len, decrypted_payload.len()); return false; }
        let data_chunk = &decrypted_payload[14 .. 14 + data_chunk_len];

        let streamreaders_map_guard = STREAMREADERS.get().read();
        if let Some(databytes_handle) = streamreaders_map_guard.get(&reader_downstream_id) {
            if databytes_handle.is_write_open() {
                databytes_handle.write(data_chunk);
            }
        }

    } else if method_str == "s_3 " {
        if decrypted_payload.len() < 12 { eprintln!("[HANDLE_NEXT_MSG SID {}] s_3 payload too short", conn.sessionid); return false; }
        let reader_downstream_id = i64::from_be_bytes(decrypted_payload[4..12].try_into().expect("[HANDLE_NEXT_MSG] s_3 reader_id slice error"));

        let streamreaders_map_guard = STREAMREADERS.get().read();
        if let Some(databytes_handle) = streamreaders_map_guard.get(&reader_downstream_id) {
            databytes_handle.close_write();
        }

    } else if method_str == "rcv " {
        if decrypted_payload.len() < 4 + 36 { eprintln!("[HANDLE_NEXT_MSG SID {}] rcv payload too short", conn.sessionid); return false; }
        let from_uuid = String::from_utf8_lossy(&decrypted_payload[4..40]).into_owned();
        let original_payload_with_len_prefix = &decrypted_payload[40..];

        if let Some(mut relay_conn_to_sender) = relay(&conn.uuid, &from_uuid, true) {
            if let P2PStream::Relay(ref mut relay_stream_to_sender) = relay_conn_to_sender.stream {
                let data_to_buffer = DataBytes::from_bytes(&original_payload_with_len_prefix.to_vec());
                relay_stream_to_sender.buf.push_bytes(data_to_buffer);
                relay_stream_to_sender.data.put_int("last_contact", time());

                thread::spawn(move || {
                    handle_next_message(relay_conn_to_sender);
                });
            }
        }

    } else if method_str == "fwd " {
        if decrypted_payload.len() < 4 + 36 { eprintln!("[HANDLE_NEXT_MSG SID {}] fwd payload too short", conn.sessionid); return false; }
        let target_uuid = String::from_utf8_lossy(&decrypted_payload[4..40]).into_owned();
        let actual_payload_to_forward = &decrypted_payload[40..];

        if let Some(target_user) = get_user(&target_uuid) {
            if let Some(mut tcp_conn_to_target) = get_tcp(target_user) {
                let mut message_for_target = "rcv ".as_bytes().to_vec();
                message_for_target.extend_from_slice(conn.uuid.as_bytes());
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
        if decrypted_payload.len() < 4 + 4 + 36 + 2 { eprintln!("[HANDLE_NEXT_MSG SID {}] err payload too short", conn.sessionid); return false; }
        let error_type = String::from_utf8_lossy(&decrypted_payload[4..8]).into_owned();
        if error_type == "fwd " {
            let failed_target_uuid = String::from_utf8_lossy(&decrypted_payload[8..44]).trim_matches('\0').to_string();
            let original_payload_len = i16::from_be_bytes(decrypted_payload[44..46].try_into().expect("[HANDLE_NEXT_MSG] err fwd original_payload_len slice error")) as usize;
            if decrypted_payload.len() < 46 + original_payload_len { eprintln!("[HANDLE_NEXT_MSG SID {}] err fwd payload too short for data", conn.sessionid); return false; }

            if let Some(failed_user) = get_user(&failed_target_uuid) {
                let system = DataStore::globals().get_object("system");
                let runtime = system.get_object("apps").get_object("app").get_object("runtime");
                let my_private_hex = runtime.get_string("privatekey");

                let my_private = decode_hex(&my_private_hex).expect("[HANDLE_NEXT_MSG] err fwd: Failed to decode my_private_hex");
                let my_private_arr: [u8; 32] = my_private.try_into().expect("[HANDLE_NEXT_MSG] err fwd: my_private slice error");

                let peer_public_hex = failed_user.get_string("publickey");
                let peer_public = decode_hex(&peer_public_hex).expect("[HANDLE_NEXT_MSG] err fwd: Failed to decode peer_public_hex");
                let peer_public_arr: [u8; 32] = peer_public.try_into().expect("[HANDLE_NEXT_MSG] err fwd: peer_public slice error");

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

        let thread_conn_stream_clone = match conn.stream.try_clone() {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[HANDLE_NEXT_MSG SID {}] cmd: Failed to clone stream for cmd thread: {}", conn.sessionid, e);
                return false;
            }
        };
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

            let mut stream_for_response = thread_conn_stream_clone;
            if let Err(e) = stream_for_response.write(&final_response_bytes, thread_conn_sessionid.clone()) {
                eprintln!("[CMD_THREAD SID {}] Error sending response: {}", thread_conn_sessionid, e);
            }
        });

    } else if method_str == "res " {
        let msg_str = String::from_utf8_lossy(&decrypted_payload[4..]).trim_matches('\0').to_string();
        let response_data_obj = DataObject::from_string(&msg_str);
        let pid_val = response_data_obj.get_int("pid");
        conn.res.put_object(&pid_val.to_string(), response_data_obj);

    } else {
    //  println!("[HANDLE_NEXT_MSG SID {}] Unknown P2P message type received: '{}'", conn.sessionid, method_str);
    }

    true
}


// --- Utility functions (encrypt, decrypt, to_hex, decode_hex) ---
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
    if buf.len() % 16 != 0 {
        // This case should ideally not happen if encryption always pads to a multiple of 16
        // and reads are exact multiples of 16 (or the full expected padded length).
        eprintln!("[DECRYPT] Error: input buffer length {} is not a multiple of 16. Potential data corruption.", buf.len());
        return Vec::new();
    }
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
    if hex_str.len() % 2 != 0 {
        // Consider returning a specific error for odd length
        // For now, this will likely cause u8::from_str_radix to fail on the last byte.
    }
    (0..hex_str.len())
        .step_by(2)
        .map(|i| {
            let end = std::cmp::min(i + 2, hex_str.len());
            u8::from_str_radix(&hex_str[i..end], 16)
        })
        .collect()