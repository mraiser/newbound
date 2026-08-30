// How was THIS process launched? /proc/self/cgroup answers:
//   system systemd unit:  .../system.slice/<unit>.service
//   user systemd unit:    .../user@<uid>.service/.../<unit>.service
//   plain process:        a session/user scope with no non-manager .service
let cg = match fs::read_to_string("/proc/self/cgroup") {
  Ok(s) => s,
  Err(e) => { return format!("ERROR: cannot read /proc/self/cgroup ({}); restart_instance is Linux-only", e); }
};
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
    let uid = fs::metadata("/proc/self").map(|m| m.uid()).unwrap_or(0);
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

// Plain process (command line, nohup, session scope): self-respawn. A detached
// watcher waits for our pid to vanish, then execs our exact cmdline in our cwd.
fn q(s: &str) -> String { format!("'{}'", s.replace('\'', "'\\''")) }

let exe = match fs::read_link("/proc/self/exe") {
  Ok(p) => p, Err(e) => { return format!("ERROR: cannot resolve /proc/self/exe: {}", e); }
};
let cwd = match fs::read_link("/proc/self/cwd") {
  Ok(p) => p, Err(e) => { return format!("ERROR: cannot resolve /proc/self/cwd: {}", e); }
};
let cmdline = fs::read("/proc/self/cmdline").unwrap_or_default();
let mut args: Vec<String> = cmdline.split(|b| *b == 0)
  .filter(|s| !s.is_empty())
  .map(|s| String::from_utf8_lossy(s).to_string())
  .collect();
if !args.is_empty() { args.remove(0); }
let pid = std::process::id();
let mut argstr = String::new();
for a in &args { argstr.push(' '); argstr.push_str(&q(a)); }
let script = format!("#!/bin/sh\nwhile kill -0 {} 2>/dev/null; do sleep 0.2; done\ncd {}\nexec {}{} >> runtime/restart.log 2>&1\n",
  pid, q(&cwd.display().to_string()), q(&exe.display().to_string()), argstr);

let dir = cwd.join("runtime");
let _ = fs::create_dir_all(&dir);
let sp = dir.join("restart_respawn.sh");
if let Err(e) = fs::write(&sp, &script) {
  return format!("ERROR: cannot write respawn script: {}", e);
}
let spawned = Command::new("setsid")
  .arg("/bin/sh")
  .arg(&sp)
  .current_dir(&cwd)
  .stdin(Stdio::null())
  .stdout(Stdio::null())
  .stderr(Stdio::null())
  .spawn();
if let Err(e) = spawned {
  return format!("ERROR: could not launch respawn watcher: {}", e);
}
// answer first, then die: the watcher relaunches us the moment the pid clears
std::thread::spawn(|| {
  std::thread::sleep(std::time::Duration::from_millis(750));
  std::process::exit(0);
});
format!("OK: restarting (self-respawn of pid {}); the instance will be back on the same port shortly", pid)