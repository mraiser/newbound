//! Integration-test harness: a disposable Newbound instance per test.
//!
//! `Instance::start()` copies the core libraries out of this checkout into a
//! fresh directory under the system temp dir, writes a config and two
//! fixture users, starts the `newbound` binary there on a free localhost
//! port, and waits until it answers HTTP. Dropping the `Instance` kills the
//! process and deletes the directory. Nothing is ever written to the
//! checkout or to a running instance.
//!
//! Portable by construction: std paths and processes only, no shell, so the
//! same code runs on Linux, NixOS, macOS, Windows and Raspberry Pi.
//!
//! A minimal HTTP/1.1 client (`Client`) carries the session cookie between
//! requests; JSON bodies are parsed with ndata.
#![allow(dead_code)] // each test binary uses a different subset

use std::collections::hash_map::RandomState;
use std::fs::{self, File};
use std::hash::{BuildHasher, Hasher};
use std::io::{Read, Write};
use std::net::{Shutdown, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Once;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use ndata::dataobject::DataObject;

/// Libraries an instance loads unless a test asks for others. `peer` is left
/// out on purpose: it opens a P2P listener and LAN discovery, and a test
/// instance must never announce itself to real instances on the network.
pub const DEFAULT_APPS: &[&str] = &["app", "dev", "security"];

/// The fixture user who is not an admin. Their group grants nothing in the
/// core libraries, so they see what any non-admin user sees.
pub const USER: &str = "tester";
pub const USER_GROUP: &str = "testers";

const BOOT_TIMEOUT: Duration = Duration::from_secs(60);
const IO_TIMEOUT: Duration = Duration::from_secs(30);
const LOG_FILE: &str = "newbound.log";

static COUNTER: AtomicUsize = AtomicUsize::new(0);
static NDATA: Once = Once::new();

/// ndata's heaps must exist in this (test) process before any DataObject.
fn init_ndata() {
    NDATA.call_once(|| {
        ndata::init();
    });
}

pub struct Instance {
    /// The instance's working directory (data/, html/, runtime/, users/).
    pub dir: PathBuf,
    pub port: u16,
    pub admin_password: String,
    pub user_password: String,
    child: Child,
}

impl Instance {
    /// An instance running `DEFAULT_APPS`.
    pub fn start() -> Instance {
        Instance::start_with_apps(DEFAULT_APPS)
    }

    pub fn start_with_apps(apps: &[&str]) -> Instance {
        Instance::start_with(apps, &[])
    }

    /// An instance running `DEFAULT_APPS` with extra `config.properties`
    /// entries, e.g. `[("basicauth", "true")]`. An entry replaces the
    /// harness default of the same key.
    pub fn start_with_config(config: &[(&str, &str)]) -> Instance {
        Instance::start_with(DEFAULT_APPS, config)
    }

    pub fn start_with(apps: &[&str], config: &[(&str, &str)]) -> Instance {
        let dir = unique_dir();
        let admin_password = random_token();
        let user_password = random_token();

        // A failed setup must not leave the directory behind.
        if let Err(e) = build_fixture(&dir, apps, config, &admin_password, &user_password) {
            let _ = fs::remove_dir_all(&dir);
            panic!("could not build the fixture in {}: {}", dir.display(), e);
        }

        // The server's own temp files (e.g. multipart uploads) stay inside
        // the instance directory too: std::env::temp_dir() reads TMPDIR on
        // Unix and TMP/TEMP on Windows.
        let tmp = dir.join("tmp");
        fs::create_dir_all(&tmp).expect("create instance tmp");

        let log = File::create(dir.join(LOG_FILE)).expect("create instance log");
        let log_err = log.try_clone().expect("clone instance log handle");
        let child = Command::new(env!("CARGO_BIN_EXE_newbound"))
            .current_dir(&dir)
            .env("TMPDIR", &tmp)
            .env("TMP", &tmp)
            .env("TEMP", &tmp)
            .stdin(Stdio::null())
            .stdout(Stdio::from(log))
            .stderr(Stdio::from(log_err))
            .spawn()
            .expect("spawn newbound");

        // From here on Drop cleans up, including when waiting panics.
        let mut inst = Instance { dir, port: 0, admin_password, user_password, child };
        inst.port = inst.wait_for_port();
        inst.wait_for_http();
        inst
    }

    pub fn base_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    /// A fresh client with no session cookie (an anonymous visitor).
    pub fn client(&self) -> Client {
        Client { port: self.port, session: None }
    }

    /// A client already logged in as `user`. Panics if login fails.
    pub fn login(&self, user: &str, password: &str) -> Client {
        let mut c = self.client();
        let r = c.get(&format!("/app/login?user={}&pass={}", encode(user), encode(password)));
        let j = r.json();
        assert_eq!(j.get_string("status"), "ok", "login as {} failed: {}", user, r.text());
        c
    }

    pub fn login_admin(&self) -> Client {
        self.login("admin", &self.admin_password)
    }

    pub fn login_user(&self) -> Client {
        self.login(USER, &self.user_password)
    }

    /// Everything the instance has printed so far, for failure messages.
    pub fn log(&self) -> String {
        fs::read_to_string(self.dir.join(LOG_FILE)).unwrap_or_default()
    }

    /// True while the server process is still running.
    pub fn is_running(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    fn wait_for_port(&mut self) -> u16 {
        let deadline = Instant::now() + BOOT_TIMEOUT;
        loop {
            let log = self.log();
            if let Some(port) = parse_port(&log) {
                return port;
            }
            if let Ok(Some(status)) = self.child.try_wait() {
                panic!("newbound exited during startup ({})\n--- log ---\n{}", status, log);
            }
            if Instant::now() > deadline {
                panic!("newbound did not report its port within {:?}\n--- log ---\n{}", BOOT_TIMEOUT, log);
            }
            thread::sleep(Duration::from_millis(25));
        }
    }

    fn wait_for_http(&mut self) {
        let deadline = Instant::now() + BOOT_TIMEOUT;
        loop {
            if let Ok(r) = self.client().try_get("/") {
                if r.status > 0 {
                    return;
                }
            }
            if let Ok(Some(status)) = self.child.try_wait() {
                panic!("newbound exited before answering HTTP ({})\n--- log ---\n{}", status, self.log());
            }
            if Instant::now() > deadline {
                panic!("newbound did not answer HTTP within {:?}\n--- log ---\n{}", BOOT_TIMEOUT, self.log());
            }
            thread::sleep(Duration::from_millis(25));
        }
    }
}

impl Drop for Instance {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        if std::env::var_os("NEWBOUND_TEST_KEEP").is_some() {
            eprintln!("NEWBOUND_TEST_KEEP: left {}", self.dir.display());
            return;
        }
        // Windows can hold a file briefly after the process exits; retry.
        for _ in 0..50 {
            if fs::remove_dir_all(&self.dir).is_ok() || !self.dir.exists() {
                return;
            }
            thread::sleep(Duration::from_millis(100));
        }
        eprintln!("warning: could not remove {}", self.dir.display());
    }
}

// ---------------------------------------------------------------- fixture

/// The checkout this test binary was built from.
pub fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// A record from this checkout's store (the same files every fixture copies),
/// as the JSON object the store holds.
pub fn store_record(lib: &str, id: &str) -> DataObject {
    // The store shards a record into four 4-character folders from its id,
    // padded with '_' (flowlang's DataStore::get_data_file).
    let padded: String = id.chars().chain(std::iter::repeat('_')).take(16).collect();
    let mut path = repo_root().join("data").join(lib);
    for i in 0..4 {
        path = path.join(&padded[i * 4..i * 4 + 4]);
    }
    path = path.join(id);
    let text = fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {}", path.display(), e));
    init_ndata();
    DataObject::from_string(&text)
}

/// The record id of command `cmd` on control `ctl` of library `lib`: what
/// `app.exec` takes as `id`. Looked up by name so tests survive re-ids.
pub fn command_id(lib: &str, ctl: &str, cmd: &str) -> String {
    let find = |list: ndata::dataarray::DataArray, name: &str| -> Option<String> {
        list.objects()
            .into_iter()
            .map(|d| d.object())
            .find(|o| o.has("name") && o.get_string("name") == name)
            .map(|o| o.get_string("id"))
    };
    let controls = store_record(lib, "controls").get_object("data").get_array("list");
    let ctl_id = find(controls, ctl).unwrap_or_else(|| panic!("no control {}.{}", lib, ctl));
    let cmds = store_record(lib, &ctl_id).get_object("data").get_array("cmd");
    find(cmds, cmd).unwrap_or_else(|| panic!("no command {}.{}.{}", lib, ctl, cmd))
}

fn unique_dir() -> PathBuf {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let name = format!("newbound-test-{}-{}-{}", std::process::id(), n, &random_token()[..8]);
    std::env::temp_dir().join(name)
}

fn build_fixture(
    dir: &Path,
    apps: &[&str],
    config: &[(&str, &str)],
    admin_pw: &str,
    user_pw: &str,
) -> std::io::Result<()> {
    let root = repo_root();
    fs::create_dir_all(dir)?;

    for lib in apps {
        // The store: only the libraries under test.
        copy_tree(&root.join("data").join(lib), &dir.join("data").join(lib))?;
        // The app's runtime: its properties and shipped html, never the
        // per-instance state a developer's checkout may hold beside them.
        let rt_src = root.join("runtime").join(lib);
        let rt_dst = dir.join("runtime").join(lib);
        fs::create_dir_all(&rt_dst)?;
        fs::copy(rt_src.join("app.properties"), rt_dst.join("app.properties"))?;
        if rt_src.join("src").is_dir() {
            copy_tree(&rt_src.join("src"), &rt_dst.join("src"))?;
        }
    }
    copy_tree(&root.join("html"), &dir.join("html"))?;

    let apps_line = apps.join(",");
    let defaults = [
        ("headless", "true"),
        ("http_address", "127.0.0.1"),
        ("http_port", "0"),
        ("apps", apps_line.as_str()),
        ("default_app", "app"),
        ("security", "on"),
        ("machineid", "NEWBOUND_TEST"),
    ];
    let mut lines: Vec<String> = defaults
        .iter()
        .filter(|(k, _)| !config.iter().any(|(ck, _)| ck == k))
        .map(|(k, v)| format!("{}={}", k, v))
        .collect();
    lines.extend(config.iter().map(|(k, v)| format!("{}={}", k, v)));
    write_lines(&dir.join("config.properties"), &lines)?;

    let users = dir.join("users");
    fs::create_dir_all(&users)?;
    write_lines(
        &users.join("admin.properties"),
        &["displayname=Test Admin".to_string(), "groups=admin".to_string(), format!("password={}", admin_pw)],
    )?;
    write_lines(
        &users.join(format!("{}.properties", USER)),
        &["displayname=Test User".to_string(), format!("groups={}", USER_GROUP), format!("password={}", user_pw)],
    )?;
    Ok(())
}

fn write_lines(path: &Path, lines: &[String]) -> std::io::Result<()> {
    let mut f = File::create(path)?;
    for l in lines {
        f.write_all(l.as_bytes())?;
        f.write_all(b"\n")?;
    }
    Ok(())
}

fn copy_tree(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        // metadata() follows symlinks, so a linked file or folder is copied
        // as its contents.
        if fs::metadata(&from)?.is_dir() {
            copy_tree(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

fn parse_port(log: &str) -> Option<u16> {
    let marker = "HTTP TCP listening on port ";
    let rest = &log[log.find(marker)? + marker.len()..];
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    // Only a complete line counts; the number may still be being written.
    if rest[digits.len()..].starts_with('\n') || rest[digits.len()..].starts_with('\r') {
        digits.parse().ok()
    } else {
        None
    }
}

/// 32 hex chars: the std hasher's random keys (fresh per RandomState) mixed
/// with the clock and a counter. Unique per call; not for cryptography.
pub fn random_token() -> String {
    let mut s = String::new();
    for i in 0..2u64 {
        let mut h = RandomState::new().build_hasher();
        h.write_u64(i);
        h.write_u128(SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        h.write_usize(COUNTER.load(Ordering::SeqCst));
        s += &format!("{:016x}", h.finish());
    }
    s
}

/// Percent-encodes a query-string value.
pub fn encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out += &format!("%{:02X}", b),
        }
    }
    out
}

// ---------------------------------------------------------------- client

/// An HTTP client for one instance that keeps the `sessionid` cookie the
/// server hands out, like a browser would.
pub struct Client {
    port: u16,
    pub session: Option<String>,
}

impl Client {
    /// GET `path` (starting with `/`, query string included). Panics on an
    /// I/O error; use `try_get` to observe one.
    pub fn get(&mut self, path: &str) -> Response {
        self.try_get(path).unwrap_or_else(|e| panic!("GET {} failed: {}", path, e))
    }

    pub fn try_get(&mut self, path: &str) -> std::io::Result<Response> {
        self.try_request("GET", path, &[], None)
    }

    /// Any request. `body` adds a Content-Length; extra `headers` go after
    /// Host, Connection and the session cookie.
    pub fn request(&mut self, method: &str, path: &str, headers: &[(&str, &str)], body: Option<&[u8]>) -> Response {
        self.try_request(method, path, headers, body)
            .unwrap_or_else(|e| panic!("{} {} failed: {}", method, path, e))
    }

    pub fn try_request(
        &mut self,
        method: &str,
        path: &str,
        headers: &[(&str, &str)],
        body: Option<&[u8]>,
    ) -> std::io::Result<Response> {
        let mut req = self.head(method, path, headers);
        if let Some(b) = body {
            req += &format!("Content-Length: {}\r\n", b.len());
        }
        req += "\r\n";
        let mut bytes = req.into_bytes();
        if let Some(b) = body {
            bytes.extend_from_slice(b);
        }
        self.send(&bytes)
    }

    /// POST a JSON object (`Content-Type: application/json`).
    pub fn post_json(&mut self, path: &str, json: &str) -> Response {
        self.request("POST", path, &[("Content-Type", "application/json")], Some(json.as_bytes()))
    }

    /// POST url-encoded form fields.
    pub fn post_form(&mut self, path: &str, fields: &[(&str, &str)]) -> Response {
        let body: Vec<String> = fields.iter().map(|(k, v)| format!("{}={}", encode(k), encode(v))).collect();
        let body = body.join("&");
        self.request(
            "POST",
            path,
            &[("Content-Type", "application/x-www-form-urlencoded")],
            Some(body.as_bytes()),
        )
    }

    /// POST text fields as multipart/form-data.
    pub fn post_multipart(&mut self, path: &str, fields: &[(&str, &str)]) -> Response {
        let boundary = format!("nbtest{}", &random_token()[..16]);
        let mut body = String::new();
        for (k, v) in fields {
            body += &format!("--{}\r\nContent-Disposition: form-data; name=\"{}\"\r\n\r\n{}\r\n", boundary, k, v);
        }
        body += &format!("--{}--\r\n", boundary);
        let ct = format!("multipart/form-data; boundary={}", boundary);
        self.request("POST", path, &[("Content-Type", ct.as_str())], Some(body.as_bytes()))
    }

    /// POST a JSON body with `Transfer-Encoding: chunked`, one chunk per
    /// element of `chunks`.
    pub fn post_chunked_json(&mut self, path: &str, chunks: &[&str]) -> Response {
        let mut req = self.head(
            "POST",
            path,
            &[("Content-Type", "application/json"), ("Transfer-Encoding", "chunked")],
        );
        req += "\r\n";
        for c in chunks {
            req += &format!("{:x}\r\n{}\r\n", c.len(), c);
        }
        req += "0\r\n\r\n";
        self.send(req.as_bytes()).unwrap_or_else(|e| panic!("chunked POST {} failed: {}", path, e))
    }

    /// Sends `bytes` exactly as given (a whole request, for malformed or
    /// unusual framing) and reads the response.
    pub fn raw(&mut self, bytes: &[u8]) -> Response {
        self.send(bytes).unwrap_or_else(|e| panic!("raw request failed: {}", e))
    }

    fn head(&self, method: &str, path: &str, headers: &[(&str, &str)]) -> String {
        let mut h = format!("{} {} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n", method, path, self.port);
        if let Some(sid) = &self.session {
            h += &format!("Cookie: sessionid={}\r\n", sid);
        }
        for (k, v) in headers {
            h += &format!("{}: {}\r\n", k, v);
        }
        h
    }

    fn connect(&self) -> std::io::Result<TcpStream> {
        let addr = SocketAddr::from(([127, 0, 0, 1], self.port));
        let stream = TcpStream::connect_timeout(&addr, IO_TIMEOUT)?;
        stream.set_read_timeout(Some(IO_TIMEOUT))?;
        stream.set_write_timeout(Some(IO_TIMEOUT))?;
        Ok(stream)
    }

    fn send(&mut self, bytes: &[u8]) -> std::io::Result<Response> {
        let mut stream = self.connect()?;
        stream.write_all(bytes)?;
        // Half-close: the request is complete. The server reads a form
        // body's last field up to end-of-stream, so without this it would
        // wait for its socket timeout before answering.
        stream.shutdown(Shutdown::Write)?;
        let mut raw = Vec::new();
        stream.read_to_end(&mut raw)?;
        let r = Response::parse(&raw)?;
        if let Some(sid) = r.cookie("sessionid") {
            self.session = Some(sid);
        }
        Ok(r)
    }

    /// Opens a WebSocket on this client's session and checks the handshake.
    pub fn websocket(&mut self) -> WebSocket {
        // The sample key from RFC 6455 section 1.3, and its known answer.
        const KEY: &str = "dGhlIHNhbXBsZSBub25jZQ==";
        const ACCEPT: &str = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=";
        let mut stream = self.connect().expect("connect for WebSocket");
        let mut req = format!(
            "GET / HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\
             Sec-WebSocket-Key: {}\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: newbound\r\n",
            self.port, KEY
        );
        if let Some(sid) = &self.session {
            req += &format!("Cookie: sessionid={}\r\n", sid);
        }
        req += "\r\n";
        stream.write_all(req.as_bytes()).expect("send WebSocket handshake");

        // Read the response head only; the connection stays open.
        let mut head = Vec::new();
        let mut byte = [0u8; 1];
        while !head.ends_with(b"\r\n\r\n") {
            stream.read_exact(&mut byte).expect("read WebSocket handshake");
            head.push(byte[0]);
        }
        let r = Response::parse(&head).expect("parse WebSocket handshake");
        assert_eq!(r.status, 101, "WebSocket handshake: HTTP {}", r.status);
        assert_eq!(r.header("sec-websocket-accept"), Some(ACCEPT));
        WebSocket { stream }
    }

    /// Runs `lib`'s command record `id` through `app.exec`, the HTTP route
    /// for commands that are not on an app's main control.
    pub fn exec(&mut self, lib: &str, id: &str, args: &str) -> Response {
        self.get(&format!("/app/exec?lib={}&id={}&args={}", encode(lib), encode(id), encode(args)))
    }
}

pub struct Response {
    pub status: u16,
    /// Header names lower-cased.
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl Response {
    fn parse(raw: &[u8]) -> std::io::Result<Response> {
        let bad = |m: &str| std::io::Error::new(std::io::ErrorKind::InvalidData, m.to_string());
        let split = raw.windows(4).position(|w| w == b"\r\n\r\n").ok_or_else(|| bad("no end of headers"))?;
        let head = String::from_utf8_lossy(&raw[..split]).to_string();
        let mut body = raw[split + 4..].to_vec();

        let mut lines = head.split("\r\n");
        let status_line = lines.next().ok_or_else(|| bad("empty response"))?;
        let status = status_line
            .split_whitespace()
            .nth(1)
            .and_then(|s| s.parse().ok())
            .ok_or_else(|| bad("bad status line"))?;
        let headers: Vec<(String, String)> = lines
            .filter_map(|l| l.split_once(':'))
            .map(|(k, v)| (k.trim().to_ascii_lowercase(), v.trim().to_string()))
            .collect();

        if let Some((_, len)) = headers.iter().find(|(k, _)| k == "content-length") {
            if let Ok(len) = len.parse::<usize>() {
                body.truncate(len);
            }
        }
        Ok(Response { status, headers, body })
    }

    pub fn header(&self, name: &str) -> Option<&str> {
        let name = name.to_ascii_lowercase();
        self.headers.iter().find(|(k, _)| *k == name).map(|(_, v)| v.as_str())
    }

    /// The value of cookie `name` from any Set-Cookie header.
    pub fn cookie(&self, name: &str) -> Option<String> {
        let prefix = format!("{}=", name);
        self.headers
            .iter()
            .filter(|(k, _)| k == "set-cookie")
            .filter_map(|(_, v)| v.split(';').next())
            .map(str::trim)
            .find(|kv| kv.starts_with(&prefix))
            .map(|kv| kv[prefix.len()..].to_string())
    }

    pub fn text(&self) -> String {
        String::from_utf8_lossy(&self.body).to_string()
    }

    /// The body as a JSON object; panics with the body if it is not one.
    pub fn json(&self) -> DataObject {
        let t = self.text();
        let trimmed = t.trim();
        assert!(trimmed.starts_with('{'), "expected a JSON object (HTTP {}), got: {}", self.status, t);
        init_ndata();
        DataObject::from_string(trimmed)
    }
}

// ---------------------------------------------------------------- websocket

/// A client end of a WebSocket (RFC 6455): masked text frames out, the
/// server's unmasked frames in.
pub struct WebSocket {
    stream: TcpStream,
}

impl WebSocket {
    pub fn send_text(&mut self, text: &str) {
        self.send_frame(0x1, text.as_bytes()).expect("send WebSocket frame");
    }

    /// The next text message from the server.
    pub fn recv_text(&mut self) -> String {
        loop {
            let (opcode, payload) = self.recv_frame();
            match opcode {
                0x1 => return String::from_utf8_lossy(&payload).to_string(),
                0x8 => panic!("server closed the WebSocket"),
                _ => continue,
            }
        }
    }

    /// Runs a command over the socket (`cmd {...}`) and returns the reply
    /// whose `pid` matches.
    pub fn command(&mut self, app: &str, cmd: &str, params_json: &str, pid: i64) -> DataObject {
        self.send_text(&format!(
            r#"cmd {{"bot":"{}","cmd":"{}","pid":{},"params":{}}}"#,
            app, cmd, pid, params_json
        ));
        loop {
            let text = self.recv_text();
            init_ndata();
            let o = DataObject::from_string(&text);
            if o.has("pid") && o.get_property("pid").is_int() && o.get_int("pid") == pid {
                return o;
            }
        }
    }

    fn send_frame(&mut self, opcode: u8, payload: &[u8]) -> std::io::Result<()> {
        let mut f = vec![0x80 | opcode];
        let n = payload.len();
        if n < 126 {
            f.push(0x80 | n as u8);
        } else if n < 65536 {
            f.push(0x80 | 126);
            f.extend_from_slice(&(n as u16).to_be_bytes());
        } else {
            f.push(0x80 | 127);
            f.extend_from_slice(&(n as u64).to_be_bytes());
        }
        let mask: [u8; 4] = random_token().as_bytes()[..4].try_into().unwrap();
        f.extend_from_slice(&mask);
        f.extend(payload.iter().enumerate().map(|(i, b)| b ^ mask[i % 4]));
        self.stream.write_all(&f)
    }

    fn recv_frame(&mut self) -> (u8, Vec<u8>) {
        let mut h = [0u8; 2];
        self.stream.read_exact(&mut h).expect("read WebSocket frame");
        let opcode = h[0] & 0x0f;
        let mut len = (h[1] & 0x7f) as u64;
        if len == 126 {
            let mut b = [0u8; 2];
            self.stream.read_exact(&mut b).expect("read frame length");
            len = u16::from_be_bytes(b) as u64;
        } else if len == 127 {
            let mut b = [0u8; 8];
            self.stream.read_exact(&mut b).expect("read frame length");
            len = u64::from_be_bytes(b);
        }
        let mut mask = [0u8; 4];
        if h[1] & 0x80 != 0 {
            self.stream.read_exact(&mut mask).expect("read frame mask");
        }
        let mut payload = vec![0u8; len as usize];
        self.stream.read_exact(&mut payload).expect("read frame payload");
        if h[1] & 0x80 != 0 {
            for (i, b) in payload.iter_mut().enumerate() {
                *b ^= mask[i % 4];
            }
        }
        (opcode, payload)
    }
}

impl Drop for WebSocket {
    fn drop(&mut self) {
        // A close frame ends the server's read loop for this connection.
        let _ = self.send_frame(0x8, &[]);
        let _ = self.stream.shutdown(Shutdown::Both);
    }
}
