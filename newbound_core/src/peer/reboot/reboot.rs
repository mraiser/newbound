use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::datastore::DataStore;

pub fn reboot_plan(os: &str) -> Vec<Vec<String>> {
  fn v(parts: &[&str]) -> Vec<String> { parts.iter().map(|s| s.to_string()).collect() }
  match os {
    "linux" => vec![
      v(&["systemctl", "reboot"]),
      v(&["loginctl", "reboot"]),
      v(&["sudo", "-n", "reboot"]),
    ],
    "macos" => vec![
      v(&["osascript", "-e", "tell application \"System Events\" to restart"]),
      v(&["sudo", "-n", "shutdown", "-r", "now"]),
    ],
    "windows" => vec![
      v(&["shutdown", "/r", "/t", "0"]),
    ],
    _ => vec![],
  }
}

pub fn failure_message(os: &str, machine: &str, attempts: &[(String, i64, String)]) -> String {
  if reboot_plan(os).is_empty() {
    return format!("Reboot isn't supported on {} yet.", os);
  }
  let mut tried: Vec<String> = Vec::new();
  for (cmd, code, err) in attempts {
    let first = err.trim().lines().next().unwrap_or("").trim().to_string();
    let reason = if first.is_empty() {
      format!("exit code {}", code)
    } else if first.chars().count() > 200 {
      let mut s: String = first.chars().take(200).collect();
      s.push_str("...");
      s
    } else {
      first
    };
    tried.push(format!("{} failed ({})", cmd, reason));
  }
  let tried = if tried.is_empty() {
    "no reboot command could be tried".to_string()
  } else {
    tried.join("; ")
  };
  let fix = match os {
    "linux" => "Allow this user to reboot without a password: a polkit rule for org.freedesktop.login1.reboot, or a sudoers line like '<user> ALL=(root) NOPASSWD: <path of reboot>'.",
    "macos" => "Allow Newbound under System Settings → Privacy & Security → Automation → System Events (osascript error -1743 means that permission is missing), or add a sudoers line letting this user run shutdown without a password.",
    _ => "This user needs the right to shut down the system (the 'Shut down the system' security policy, SeShutdownPrivilege).",
  };
  format!("{} couldn't reboot: {}. {}", machine, tried, fix)
}

pub fn find_on_path(tool: &str) -> Option<std::path::PathBuf> {
  let path = std::env::var_os("PATH")?;
  let mut exts: Vec<String> = Vec::new();
  if std::env::consts::OS == "windows" {
    let pathext = std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string());
    for e in pathext.split(';') {
      let e = e.trim();
      if !e.is_empty() { exts.push(e.to_string()); }
    }
  }
  for dir in std::env::split_paths(&path) {
    if dir.as_os_str().is_empty() { continue; }
    let cand = dir.join(tool);
    if is_executable_file(&cand) { return Some(cand); }
    for ext in &exts {
      let cand = dir.join(format!("{}{}", tool, ext));
      if is_executable_file(&cand) { return Some(cand); }
    }
  }
  None
}

pub fn is_executable_file(p: &std::path::Path) -> bool {
  let md = match std::fs::metadata(p) { Ok(m) => m, Err(_) => return false };
  if !md.is_file() { return false; }
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    if md.permissions().mode() & 0o111 == 0 { return false; }
  }
  true
}

fn join_stderr(h: Option<std::thread::JoinHandle<String>>) -> String {
  match h {
    Some(h) => h.join().unwrap_or_default().trim().to_string(),
    None => String::new(),
  }
}

pub fn run_attempt(argv: &[String], timeout_secs: u64) -> (i64, String) {
  if argv.is_empty() { return (-1, "empty command".to_string()); }
  let exe = match find_on_path(&argv[0]) {
    Some(p) => p,
    None => return (-1, "not installed".to_string()),
  };
  let mut cmd = std::process::Command::new(&exe);
  cmd.args(&argv[1..]);
  // stdin is closed so no tool can sit on a prompt; stdout is discarded.
  cmd.stdin(std::process::Stdio::null());
  cmd.stdout(std::process::Stdio::null());
  cmd.stderr(std::process::Stdio::piped());
  let mut child = match cmd.spawn() {
    Ok(c) => c,
    Err(e) => return (-1, format!("failed to start: {}", e)),
  };
  // Drain stderr on its own thread: a tool that writes more than the pipe
  // buffer would otherwise block until the timeout. Joined after the process
  // ends, so nothing is read half-written.
  let stderr_handle = child.stderr.take().map(|mut se| {
    std::thread::spawn(move || {
      use std::io::Read;
      let mut buf = String::new();
      let _ = se.read_to_string(&mut buf);
      buf
    })
  });
  let started = std::time::Instant::now();
  loop {
    match child.try_wait() {
      Ok(Some(status)) => {
        let err = join_stderr(stderr_handle);
        return (status.code().unwrap_or(-1) as i64, err);
      }
      Ok(None) => {
        if started.elapsed() >= std::time::Duration::from_secs(timeout_secs) {
          let _ = child.kill();
          let _ = child.wait();
          let err = join_stderr(stderr_handle);
          let msg = if err.is_empty() {
            format!("timed out after {} seconds", timeout_secs)
          } else {
            format!("timed out after {} seconds: {}", timeout_secs, err)
          };
          return (-1, msg);
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
      }
      Err(e) => {
        let _ = child.kill();
        let _ = child.wait();
        let _ = join_stderr(stderr_handle);
        return (-1, format!("wait failed: {}", e));
      }
    }
  }
}

pub fn machine_name() -> String {
  // The name the Peers app shows, read the way peer.info reads it.
  let system = DataStore::globals().get_object("system");
  if system.has("config") {
    let config = system.get_object("config");
    if config.has("machineid") {
      let v = config.get_string("machineid").trim().to_string();
      if !v.is_empty() { return v; }
    }
  }
  for key in ["COMPUTERNAME", "HOSTNAME"] {
    if let Ok(v) = std::env::var(key) {
      let v = v.trim().to_string();
      if !v.is_empty() { return v; }
    }
  }
  if let Some(exe) = find_on_path("hostname") {
    let out = std::process::Command::new(&exe)
      .stdin(std::process::Stdio::null())
      .output();
    if let Ok(out) = out {
      let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
      if !v.is_empty() { return v; }
    }
  }
  "this machine".to_string()
}

pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        reboot()
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
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

pub fn reboot() -> DataObject {
let os = std::env::consts::OS;
let plan = reboot_plan(os);

let system = DataStore::globals().get_object("system");
let mut dryrun = false;
if system.has("config") {
  let config = system.get_object("config");
  if config.has("reboot_dryrun") {
    dryrun = config.get_string("reboot_dryrun").trim() == "true";
  }
}
if dryrun {
  let mut out = DataObject::new();
  out.put_string("status", "ok");
  out.put_boolean("dryrun", true);
  let mut jplan = DataArray::new();
  for argv in &plan {
    let mut jcmd = DataArray::new();
    for part in argv { jcmd.push_string(part); }
    jplan.push_array(jcmd);
  }
  out.put_array("plan", jplan);
  out.put_string("os", os);
  return out;
}

let mut attempts: Vec<(String, i64, String)> = Vec::new();
for argv in &plan {
  let shown = argv.join(" ");
  let (code, err) = run_attempt(argv, 10);
  if code == 0 {
    let mut out = DataObject::new();
    out.put_string("status", "ok");
    out.put_string("method", &shown);
    return out;
  }
  attempts.push((shown, code, err));
}

let mut out = DataObject::new();
out.put_string("status", "err");
out.put_string("msg", &failure_message(os, &machine_name(), &attempts));
let mut jatt = DataArray::new();
for (cmd, code, err) in &attempts {
  let mut a = DataObject::new();
  a.put_string("cmd", cmd);
  a.put_int("code", *code);
  a.put_string("err", err);
  jatt.push_object(a);
}
out.put_array("attempts", jatt);
out
}
