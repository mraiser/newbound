// How was THIS process launched? /proc/self/cgroup answers:
//   system systemd unit:  .../system.slice/<unit>.service
//   user systemd unit:    .../user@<uid>.service/.../<unit>.service
//   plain process:        a session/user scope with no non-manager .service
// No /proc (macOS, the BSDs) means no systemd either: a plain process.
let cg = fs::read_to_string("/proc/self/cgroup").unwrap_or_default();
let mut unit = String::new();
let mut under_user_mgr = false;
for line in cg.lines() {
  let path = line.rsplit(':').next().unwrap_or("");
  if path.contains("user@") { under_user_mgr = true; }
  for seg in path.split('/') {
    // user@<uid>.service is the per-user MANAGER, not our unit
    if seg.ends_with(".service") && !seg.starts_with("user@") {
      unit = seg.to_string();
    }
  }
}

if !unit.is_empty() {
  // systemd case: --no-block is load-bearing - a blocking systemctl from
  // inside the unit deadlocks waiting on our own SIGTERM.
  let mut c: Command;
  if under_user_mgr {
    c = Command::new("systemctl");
    c.arg("--user");
  } else {
    #[cfg(unix)]
    let uid = fs::metadata("/proc/self").map(|m| m.uid()).unwrap_or(0);
    #[cfg(not(unix))]
    let uid = 0u32;
    if uid == 0 {
      c = Command::new("systemctl");
    } else {
      c = Command::new("sudo");
      c.arg("-n").arg("systemctl");
    }
  }
  c.arg("--no-block").arg("restart").arg(&unit);
  return match c.stdin(Stdio::null()).output() {
    Ok(o) if o.status.success() => format!("OK: restarting via systemd unit {}", unit),
    Ok(o) => format!("ERROR: systemctl restart {} failed: {}", unit, String::from_utf8_lossy(&o.stderr).trim()),
    Err(e) => format!("ERROR: could not run systemctl: {}", e),
  };
}

// Plain process (command line, nohup, session scope): restart IN PLACE.
// exec() swaps this process for a fresh copy of the same program with the
// same arguments: same pid, same terminal, so an instance started in a
// terminal tab stays in that tab (output keeps scrolling there, Ctrl-C still
// stops it). Rust opens sockets close-on-exec, so the ports are free again
// for the fresh copy. exec() returns only when it fails; then a detached
// watcher waits for our pid to vanish and relaunches us in the background.
fn q(s: &str) -> String { format!("'{}'", s.replace('\'', "'\\''")) }

#[cfg(unix)]
fn exec_self(exe: &std::path::Path, args: &[String], cwd: &std::path::Path) -> std::io::Error {
  use std::os::unix::process::CommandExt;
  Command::new(exe).args(args).current_dir(cwd).exec()
}
#[cfg(not(unix))]
fn exec_self(_: &std::path::Path, _: &[String], _: &std::path::Path) -> std::io::Error {
  std::io::Error::new(std::io::ErrorKind::Unsupported, "exec is unix-only")
}

// the fallback: a detached watcher that relaunches us once our pid is gone
// (output then goes to runtime/restart.log, since no terminal owns it)
// Windows: no exec() and no /bin/sh - a cmd script polls tasklist for our
// pid, then relaunches; it runs detached in its own process group so our
// exit does not take it down.
#[cfg(windows)]
fn respawn_watcher(pid: u32, exe: &std::path::Path, args: &[String], cwd: &std::path::Path) -> Result<(), String> {
  fn plain(p: &std::path::Path) -> String {
    let s = p.display().to_string();
    s.strip_prefix(r"\\?\").unwrap_or(&s).to_string()
  }
  let mut argstr = String::new();
  for a in args { argstr.push_str(" \""); argstr.push_str(&a.replace('"', "\"\"")); argstr.push('"'); }
  let script = format!("@echo off\r\n:wait\r\ntasklist /FI \"PID eq {pid}\" /NH 2>nul | find \" {pid} \" >nul && (ping -n 2 127.0.0.1 >nul & goto wait)\r\ncd /d \"{cwd}\"\r\n\"{exe}\"{args} >> runtime\\restart.log 2>&1\r\n",
    pid = pid, cwd = plain(cwd), exe = plain(exe), args = argstr);
  let dir = cwd.join("runtime");
  let _ = fs::create_dir_all(&dir);
  fs::write(dir.join("restart_respawn.cmd"), &script).map_err(|e| format!("cannot write respawn script: {}", e))?;
  // CreateProcessW with bInheritHandles = FALSE: std's Command always lets
  // the child inherit, and a watcher holding our inherited UDP sockets keeps
  // the discovery/P2P ports busy after we exit, so the relaunched instance
  // cannot bind them. CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP: a hidden
  // console (with none at all, DETACHED_PROCESS, the relaunched instance's
  // output never reaches runtime/restart.log), and our exit must not take it
  // down. First try also breaking away from any job object (one may kill its
  // members when we exit).
  use std::os::windows::ffi::OsStrExt;
  use std::ffi::c_void;
  #[repr(C)]
  struct StartupInfoW { cb: u32, reserved: *mut u16, desktop: *mut u16, title: *mut u16,
    x: u32, y: u32, x_size: u32, y_size: u32, x_chars: u32, y_chars: u32, fill: u32,
    flags: u32, show_window: u16, cb_reserved2: u16, reserved2: *mut u8,
    std_in: *mut c_void, std_out: *mut c_void, std_err: *mut c_void }
  #[repr(C)]
  struct ProcessInformation { process: *mut c_void, thread: *mut c_void, pid: u32, tid: u32 }
  #[link(name = "kernel32")]
  extern "system" {
    fn CreateProcessW(app: *const u16, cmdline: *mut u16, pattr: *mut c_void, tattr: *mut c_void,
      inherit: i32, flags: u32, env: *mut c_void, cwd: *const u16,
      si: *mut StartupInfoW, pi: *mut ProcessInformation) -> i32;
    fn CloseHandle(h: *mut c_void) -> i32;
  }
  let dir: Vec<u16> = std::ffi::OsStr::new(&plain(cwd)).encode_wide().chain(Some(0)).collect();
  let mut last = String::new();
  for extra in [0x0100_0000u32, 0] {
    let mut cmdline: Vec<u16> = std::ffi::OsStr::new("cmd.exe /C runtime\\restart_respawn.cmd")
      .encode_wide().chain(Some(0)).collect();
    let mut si: StartupInfoW = unsafe { std::mem::zeroed() };
    si.cb = std::mem::size_of::<StartupInfoW>() as u32;
    let mut pi: ProcessInformation = unsafe { std::mem::zeroed() };
    let ok = unsafe { CreateProcessW(std::ptr::null(), cmdline.as_mut_ptr(), std::ptr::null_mut(),
      std::ptr::null_mut(), 0, 0x0800_0000 | 0x0000_0200 | extra, std::ptr::null_mut(),
      dir.as_ptr(), &mut si, &mut pi) };
    if ok != 0 {
      unsafe { CloseHandle(pi.process); CloseHandle(pi.thread); }
      return Ok(());
    }
    last = std::io::Error::last_os_error().to_string();
  }
  Err(format!("could not launch respawn watcher: {}", last))
}
#[cfg(not(windows))]
fn respawn_watcher(pid: u32, exe: &std::path::Path, args: &[String], cwd: &std::path::Path) -> Result<(), String> {
  let mut argstr = String::new();
  for a in args { argstr.push(' '); argstr.push_str(&q(a)); }
  let script = format!("#!/bin/sh\nwhile kill -0 {} 2>/dev/null; do sleep 0.2; done\ncd {}\nexec {}{} >> runtime/restart.log 2>&1\n",
    pid, q(&cwd.display().to_string()), q(&exe.display().to_string()), argstr);
  let dir = cwd.join("runtime");
  let _ = fs::create_dir_all(&dir);
  let sp = dir.join("restart_respawn.sh");
  fs::write(&sp, &script).map_err(|e| format!("cannot write respawn script: {}", e))?;
  let mut watcher = Command::new("/bin/sh");
  watcher.arg(&sp)
    .current_dir(cwd)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());
  // its own process group (was the Linux-only `setsid` binary): our exit
  // must not take the watcher down with us
  #[cfg(unix)]
  {
    use std::os::unix::process::CommandExt;
    watcher.process_group(0);
  }
  watcher.spawn().map(|_| ()).map_err(|e| format!("could not launch respawn watcher: {}", e))
}

// /proc/self answers on Linux; the std calls answer the same on macOS
let exe = match fs::read_link("/proc/self/exe").or_else(|_| std::env::current_exe()) {
  Ok(p) => p, Err(e) => { return format!("ERROR: cannot resolve this program's path: {}", e); }
};
// Windows: a host rebuild while running parks the running image as
// <exe>.old-<pid>-<n> (dev.dev.compile); relaunch the fresh build at the
// original name, never the parked copy.
#[cfg(windows)]
let exe = {
  let s = exe.display().to_string();
  let s = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
  match s.find(".old-") { Some(i) => std::path::PathBuf::from(&s[..i]), None => std::path::PathBuf::from(s) }
};
let cwd = match fs::read_link("/proc/self/cwd").or_else(|_| std::env::current_dir()) {
  Ok(p) => p, Err(e) => { return format!("ERROR: cannot resolve the working directory: {}", e); }
};
let mut args: Vec<String> = match fs::read("/proc/self/cmdline") {
  Ok(cmdline) => cmdline.split(|b| *b == 0)
    .filter(|s| !s.is_empty())
    .map(|s| String::from_utf8_lossy(s).to_string())
    .collect(),
  Err(_) => std::env::args().collect(),
};
if !args.is_empty() { args.remove(0); }
let pid = std::process::id();
// answer first (the reply must leave before the program is replaced), then
// restart in place; if exec fails, fall back to the background watcher
std::thread::spawn(move || {
  std::thread::sleep(std::time::Duration::from_millis(750));
  let e = exec_self(&exe, &args, &cwd);
  eprintln!("restart in place failed ({}); relaunching in the background (output: runtime/restart.log)", e);
  match respawn_watcher(pid, &exe, &args, &cwd) {
    Ok(_) => std::process::exit(0),
    Err(m) => eprintln!("restart failed: {}; this instance keeps running", m),
  }
});
format!("OK: restarting in place (pid {}); the instance will be back on the same port shortly", pid)