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
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Once;
use std::thread;
use std::time::{Duration, Instant};

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
        let dir = unique_dir();
        let admin_password = random_token();
        let user_password = random_token();

        // A failed setup must not leave the directory behind.
        if let Err(e) = build_fixture(&dir, apps, &admin_password, &user_password) {
            let _ = fs::remove_dir_all(&dir);
            panic!("could not build the fixture in {}: {}", dir.display(), e);
        }

        let log = File::create(dir.join(LOG_FILE)).expect("create instance log");
        let log_err = log.try_clone().expect("clone instance log handle");
        let child = Command::new(env!("CARGO_BIN_EXE_newbound"))
            .current_dir(&dir)
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
        self.login("admin", &self.admin_password.clone())
    }

    pub fn login_user(&self) -> Client {
        self.login(USER, &self.user_password.clone())
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

fn unique_dir() -> PathBuf {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let name = format!("newbound-test-{}-{}-{}", std::process::id(), n, &random_token()[..8]);
    std::env::temp_dir().join(name)
}

fn build_fixture(dir: &Path, apps: &[&str], admin_pw: &str, user_pw: &str) -> std::io::Result<()> {
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

    write_lines(
        &dir.join("config.properties"),
        &[
            "headless=true".to_string(),
            "http_address=127.0.0.1".to_string(),
            "http_port=0".to_string(),
            format!("apps={}", apps.join(",")),
            "default_app=app".to_string(),
            "security=on".to_string(),
            "machineid=NEWBOUND_TEST".to_string(),
        ],
    )?;

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

/// 32 hex chars from the std hasher's per-process random keys.
pub fn random_token() -> String {
    let mut s = String::new();
    for i in 0..2u64 {
        let mut h = RandomState::new().build_hasher();
        h.write_u64(i);
        h.write_u128(Instant::now().elapsed().as_nanos());
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
        let addr = SocketAddr::from(([127, 0, 0, 1], self.port));
        let mut stream = TcpStream::connect_timeout(&addr, IO_TIMEOUT)?;
        stream.set_read_timeout(Some(IO_TIMEOUT))?;
        stream.set_write_timeout(Some(IO_TIMEOUT))?;

        let mut req = format!("GET {} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n", path, self.port);
        if let Some(sid) = &self.session {
            req += &format!("Cookie: sessionid={}\r\n", sid);
        }
        req += "\r\n";
        stream.write_all(req.as_bytes())?;

        let mut raw = Vec::new();
        stream.read_to_end(&mut raw)?;
        let r = Response::parse(&raw)?;
        if let Some(sid) = r.cookie("sessionid") {
            self.session = Some(sid);
        }
        Ok(r)
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
