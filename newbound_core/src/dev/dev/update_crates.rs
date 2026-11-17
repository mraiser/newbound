use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;
use crate::dev::dev::crate_versions::manifest_paths;
use crate::dev::dev::crate_versions::read_dep_version;
use crate::dev::dev::crate_versions::rewrite_dep_version;
use crate::dev::dev::compile::build_compile_command;
use std::fs;
use std::process::Command;
use std::process::Stdio;
// ---- Windows runners ------------------------------------------------------
// Windows has no /bin/sh, kill or /proc. update_crates and hard_reset run
// their steps from a PowerShell script, started detached with no inherited
// handles (an inheriting child would keep this server's sockets bound after
// it exits); update_crates_status and both launchers look the runner's pid up
// in the process table. Unix never calls these: every caller branches on
// cfg!(windows), and the non-Windows stubs exist only so that branch compiles.

/// \\?\C:\x -> C:\x: canonicalize() adds the prefix; PowerShell and cmd reject it.
pub fn win_plain(p: &std::path::Path) -> String {
  let s = p.display().to_string();
  s.strip_prefix(r"\\?\").unwrap_or(&s).to_string()
}

/// The shared head of a Windows runner script: cd to the instance, then
/// St (status.json in the shape update_crates_status reads), Log, Run (a
/// native command, its output appended to run.log), H (sha256 of the host
/// binary) and Build (a cargo build that can relink the running host).
/// extra_json is appended to every status object, e.g. ,"steps":6.
pub fn win_runner_prelude(base: &str, profile: &str, extra_json: &str) -> String {
  WIN_RUNNER_PRELUDE
    .replace("@BASE@", &base.replace('\'', "''"))
    .replace("@PROFILE@", profile)
    .replace("@EXTRA@", extra_json)
}

const WIN_RUNNER_PRELUDE: &str = r##"$ErrorActionPreference = 'Continue'
$BASE = '@BASE@'
Set-Location -LiteralPath $BASE
$D = Join-Path $BASE 'runtime\dev\update_crates'
$LOG = Join-Path $D 'run.log'
$RBIN = 'target\@PROFILE@\newbound.exe'
$BIN = Join-Path $BASE $RBIN
function St($state, $step, $label, $verdict) {
  $label = $label -replace '["\\]', ''
  $t = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $j = '{"state":"' + $state + '","step":' + $step + '@EXTRA@,"label":"' + $label + '","verdict":"' + $verdict + '","pid":' + $PID + ',"time":' + $t + '}'
  [IO.File]::WriteAllText((Join-Path $D 'status.json'), $j)
}
function Log($m) { [IO.File]::AppendAllText($LOG, "$m`r`n") }
# Native commands run through cmd so their output reaches run.log byte for
# byte: Windows PowerShell 5.1 would re-encode it as UTF-16.
function Run($cmdline) { cmd /c "$cmdline >> `"$LOG`" 2>&1"; return $LASTEXITCODE }
function H { if (Test-Path -LiteralPath $BIN) { (Get-FileHash -Algorithm SHA256 -LiteralPath $BIN).Hash } else { 'none' } }
# Windows locks a running .exe but lets it be renamed. Park the running host
# binary and put an unlocked copy, timestamp kept, back in its place: an
# unchanged build stays fresh (no relink, so the hash verdict holds) and a
# changed one overwrites the copy. Restore the parked one if the build left
# no binary at all.
function Build($cargo) {
  Get-ChildItem -LiteralPath (Split-Path $BIN) -Filter 'newbound.exe.old-*' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  $p = $null
  if (Test-Path -LiteralPath $BIN) {
    $p = "$BIN.old-runner-" + [DateTime]::UtcNow.Ticks
    Move-Item -LiteralPath $BIN -Destination $p -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination $BIN -ErrorAction SilentlyContinue } else { $p = $null }
  }
  $rc = Run $cargo
  if ($p -and -not (Test-Path -LiteralPath $BIN)) { Move-Item -LiteralPath $p -Destination $BIN -ErrorAction SilentlyContinue }
  return $rc
}
"##;

/// Start a runner script: powershell -File, detached (CREATE_NO_WINDOW |
/// CREATE_NEW_PROCESS_GROUP, first trying to break away from any job object)
/// and with bInheritHandles = FALSE. Returns the runner's pid.
#[cfg(windows)]
pub fn win_launch_runner(base: &std::path::Path, script: &std::path::Path) -> Result<u32, String> {
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
  let line = format!("powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{}\"", win_plain(script));
  let dir: Vec<u16> = std::ffi::OsStr::new(&win_plain(base)).encode_wide().chain(Some(0)).collect();
  let mut last = String::new();
  for extra in [0x0100_0000u32, 0] {
    let mut cmdline: Vec<u16> = std::ffi::OsStr::new(&line).encode_wide().chain(Some(0)).collect();
    let mut si: StartupInfoW = unsafe { std::mem::zeroed() };
    si.cb = std::mem::size_of::<StartupInfoW>() as u32;
    let mut pi: ProcessInformation = unsafe { std::mem::zeroed() };
    let ok = unsafe { CreateProcessW(std::ptr::null(), cmdline.as_mut_ptr(), std::ptr::null_mut(),
      std::ptr::null_mut(), 0, 0x0800_0000 | 0x0000_0200 | extra, std::ptr::null_mut(),
      dir.as_ptr(), &mut si, &mut pi) };
    if ok != 0 {
      let pid = pi.pid;
      unsafe { CloseHandle(pi.process); CloseHandle(pi.thread); }
      return Ok(pid);
    }
    last = std::io::Error::last_os_error().to_string();
  }
  Err(last)
}
#[cfg(not(windows))]
pub fn win_launch_runner(_: &std::path::Path, _: &std::path::Path) -> Result<u32, String> {
  Err("the PowerShell runner is Windows-only".to_string())
}

/// Is this pid a live process? (OpenProcess + GetExitCodeProcess.)
#[cfg(windows)]
pub fn win_pid_alive(pid: i64) -> bool {
  use std::ffi::c_void;
  #[link(name = "kernel32")]
  extern "system" {
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut c_void;
    fn GetExitCodeProcess(h: *mut c_void, code: *mut u32) -> i32;
    fn CloseHandle(h: *mut c_void) -> i32;
  }
  if pid <= 0 || pid > u32::MAX as i64 { return false; }
  unsafe {
    // PROCESS_QUERY_LIMITED_INFORMATION
    let h = OpenProcess(0x1000, 0, pid as u32);
    if h.is_null() { return false; }
    let mut code: u32 = 0;
    let ok = GetExitCodeProcess(h, &mut code);
    CloseHandle(h);
    // STILL_ACTIVE
    ok != 0 && code == 259
  }
}
#[cfg(not(windows))]
pub fn win_pid_alive(_: i64) -> bool { false }

/// update_crates' four steps for the Windows runner (the run.sh steps).
const WIN_UPDATE_STEPS: &str = r##"
$H0 = H
St 'running' 1 'host build with new crates' ''
Log '== STEP 1: @CARGO@'
if ((Build '@CARGO@') -ne 0) { St 'failed' 1 'host build failed' ''; exit 1 }
St 'running' 2 'newbound rebuild' ''
Log "== STEP 2: $RBIN rebuild"
if ((Run "$RBIN rebuild") -ne 0) { St 'failed' 2 'rebuild failed' ''; exit 1 }
St 'running' 3 'newbound recompile' ''
Log "== STEP 3: $RBIN recompile"
if ((Run "$RBIN recompile") -ne 0) { Log '== STEP 3: some libraries failed to compile (continuing; they keep their old build)' }
$RC = Select-String -LiteralPath $LOG -Pattern '^[0-9]+ compiled, [0-9]+ failed' | Select-Object -Last 1 | ForEach-Object { $_.Line -replace '["\\]', '' }
St 'running' 4 'final host build' ''
Log '== STEP 4: @CARGO@'
if ((Build '@CARGO@') -ne 0) { St 'failed' 4 'final host build failed' ''; exit 1 }
$H1 = H
if ($H0 -eq $H1) { $V = 'no-restart' } else { $V = 'restart' }
$L = 'complete'; if ($RC) { $L = "complete; recompile: $RC" }
St 'done' 4 $L $V
Log "== DONE: verdict=$V"
"##;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["flowlang", "ndata"] {
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
        let arg_0: String = o.get_string("flowlang");
        let arg_1: String = o.get_string("ndata");
        update_crates(arg_0, arg_1)
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

pub fn update_crates(flowlang: String, ndata: String) -> DataObject {
fn ver_ok(v: &str) -> bool {
  let mut ch = v.chars();
  match ch.next() { Some(c) if c.is_ascii_digit() => (), _ => return false }
  v.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
}
fn err(msg: &str) -> DataObject {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("msg", msg);
  o
}
fn now_secs() -> i64 {
  std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}
// Is the runner still alive? /proc answers on Linux; elsewhere (macOS, the
// BSDs) `kill -0` does - signal 0 only checks that the pid exists.
fn pid_alive(pid: i64) -> bool {
  if cfg!(windows) { return win_pid_alive(pid); }
  if std::path::Path::new("/proc/self").exists() {
    return std::path::Path::new(&format!("/proc/{}", pid)).exists();
  }
  Command::new("kill").arg("-0").arg(pid.to_string())
    .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
    .status().map(|s| s.success()).unwrap_or(false)
}

if !ver_ok(&flowlang) || !ver_ok(&ndata) {
  return err("versions must start with a digit and contain only [0-9A-Za-z.-], e.g. 0.3.35");
}

let store = DataStore::new();
let base = store.root.canonicalize().unwrap();
let base = base.parent().unwrap().to_path_buf();

let root_manifest = base.join("Cargo.toml");
let cur = fs::read_to_string(&root_manifest).unwrap_or_default();
let cur_fl = read_dep_version(&cur, "flowlang");
let cur_nd = read_dep_version(&cur, "ndata");

// ndata cannot move independently of flowlang: ndata changes ship inside
// flowlang releases, and the hotswap ABI contract string carries only the
// flowlang version - so a lone ndata bump would evade the mid-run skew guard.
if ndata != cur_nd && flowlang == cur_fl {
  return err(&format!("refused: ndata {} -> {} without a flowlang bump (flowlang stays {}). ndata versions ride flowlang releases; bump both together.", cur_nd, ndata, cur_fl));
}

let rundir = base.join("runtime").join("dev").join("update_crates");
let status_path = rundir.join("status.json");
if let Ok(s) = fs::read_to_string(&status_path) {
  if let Ok(o) = DataObject::try_from_string(&s) {
    if o.has("state") && o.get_string("state") == "running" {
      let pid = if o.has("pid") { o.get_int("pid") } else { 0 };
      if pid > 0 && pid_alive(pid) {
        return err(&format!("refused: an update run is already in progress (runner pid {})", pid));
      }
    }
  }
}
if let Err(e) = fs::create_dir_all(&rundir) {
  return err(&format!("cannot create {}: {}", rundir.display(), e));
}

// ---- STEP 0: pin every manifest in lockstep ----
let mut pinned = DataArray::new();
for p in manifest_paths() {
  let mut o = DataObject::new();
  o.put_string("path", &p.display().to_string());
  match fs::read_to_string(&p) {
    Ok(content) => {
      let (c1, ch1) = rewrite_dep_version(&content, "flowlang", &flowlang);
      let (c2, ch2) = rewrite_dep_version(&c1, "ndata", &ndata);
      if ch1 || ch2 {
        match fs::write(&p, &c2) {
          Ok(_) => { o.put_string("result", "pinned"); },
          Err(e) => { o.put_string("result", &format!("WRITE FAILED: {}", e)); },
        }
      } else {
        o.put_string("result", "unchanged");
      }
    },
    Err(e) => { o.put_string("result", &format!("READ FAILED: {}", e)); },
  }
  pinned.push_object(o);
}

// Gate hot-reload for the duration. In-memory on purpose: a restart clears it
// inherently, and update_crates_status clears it on a no-restart finish.
// (Inert until a gate-aware flowlang runs; the ABI contract check is the
// interim guard, complete because a lone ndata bump is refused above.)
let mut g = DataStore::globals();
if g.has("system") {
  g.get_object("system").put_boolean("hotswap_paused", true);
}

// ---- the detached runner: steps 1-4 run through the NEW code via the CLI ----
let profile = if cfg!(debug_assertions) { "debug" } else { "release" };
let mut cargo_cmd = String::new();
for a in build_compile_command().objects() {
  if !cargo_cmd.is_empty() { cargo_cmd.push(' '); }
  cargo_cmd.push_str(&a.string());
}
let binpath = format!("target/{}/newbound", profile);
let script = format!(r#"#!/bin/sh
cd '{base}'
D=runtime/dev/update_crates
LOG="$D/run.log"
BIN='{bin}'
st() {{ printf '{{"state":"%s","step":%s,"label":"%s","verdict":"%s","pid":%s,"time":%s}}' "$1" "$2" "$3" "$4" $$ "$(date +%s)" > "$D/status.json.tmp"; mv "$D/status.json.tmp" "$D/status.json"; }}
h() {{ if [ -f "$BIN" ]; then {{ sha256sum "$BIN" 2>/dev/null || shasum -a 256 "$BIN"; }} | cut -d' ' -f1; else echo none; fi; }}
H0=$(h)
st running 1 'host build with new crates' ''
echo "== STEP 1: {cargo}" >> "$LOG"
{cargo} >> "$LOG" 2>&1 || {{ st failed 1 'host build failed' ''; exit 1; }}
st running 2 'newbound rebuild' ''
echo "== STEP 2: $BIN rebuild" >> "$LOG"
"$BIN" rebuild >> "$LOG" 2>&1 || {{ st failed 2 'rebuild failed' ''; exit 1; }}
st running 3 'newbound recompile' ''
echo "== STEP 3: $BIN recompile" >> "$LOG"
"$BIN" recompile >> "$LOG" 2>&1 || echo "== STEP 3: some libraries failed to compile (continuing; they keep their old build)" >> "$LOG"
RC=$(grep -E '^[0-9]+ compiled, [0-9]+ failed' "$LOG" | tail -1 | tr -d '"\\')
st running 4 'final host build' ''
echo "== STEP 4: {cargo}" >> "$LOG"
{cargo} >> "$LOG" 2>&1 || {{ st failed 4 'final host build failed' ''; exit 1; }}
H1=$(h)
if [ "$H0" = "$H1" ]; then V=no-restart; else V=restart; fi
L=complete; [ -n "$RC" ] && L="complete; recompile: $RC"
st done 4 "$L" "$V"
echo "== DONE: verdict=$V" >> "$LOG"
"#, base = base.display(), bin = binpath, cargo = cargo_cmd);

// Windows has no /bin/sh: the same steps run as a PowerShell script
// (update_crates' win_runner_prelude + WIN_UPDATE_STEPS), whose cargo builds
// move the running host .exe aside so the link step can replace it.
let (script, script_name) = if cfg!(windows) {
  (win_runner_prelude(&win_plain(&base), profile, "") + &WIN_UPDATE_STEPS.replace("@CARGO@", &cargo_cmd), "run.ps1")
} else {
  (script, "run.sh")
};
let script_path = rundir.join(script_name);
if let Err(e) = fs::write(&script_path, &script) {
  return err(&format!("cannot write runner script: {}", e));
}
let _ = fs::write(rundir.join("run.log"), "");
let init_status = format!("{{\"state\":\"running\",\"step\":0,\"label\":\"manifests pinned; launching runner\",\"verdict\":\"\",\"pid\":0,\"time\":{}}}", now_secs());
let _ = fs::write(&status_path, &init_status);

let mut runner = Command::new("/bin/sh");
runner.arg(&script_path)
  .current_dir(&base)
  .stdin(Stdio::null())
  .stdout(Stdio::null())
  .stderr(Stdio::null());
// Detach the runner into its own process group, so stopping this server
// (Ctrl-C, or a stop of its group) doesn't take the build with it. This was
// the `setsid` binary, which exists on Linux only; process_group is the
// same POSIX call (setpgid) on Linux, macOS and the BSDs.
#[cfg(unix)]
{
  use std::os::unix::process::CommandExt;
  runner.process_group(0);
}
let spawned = if cfg!(windows) {
  win_launch_runner(&base, &script_path)
} else {
  runner.spawn().map(|c| c.id()).map_err(|e| e.to_string())
};
if let Err(e) = spawned {
  let _ = fs::write(&status_path, format!("{{\"state\":\"failed\",\"step\":0,\"label\":\"could not launch runner: {}\",\"verdict\":\"\",\"pid\":0,\"time\":{}}}", e, now_secs()));
  return err(&format!("manifests are pinned but the runner failed to launch: {}", e));
}

let mut out = DataObject::new();
out.put_string("status", "ok");
out.put_string("msg", &format!("pinned flowlang={} ndata={}; runner launched. Poll dev.dev.update_crates_status.", flowlang, ndata));
out.put_string("flowlang", &flowlang);
out.put_string("ndata", &ndata);
out.put_string("previous_flowlang", &cur_fl);
out.put_string("previous_ndata", &cur_nd);
out.put_array("pinned", pinned);
out.put_string("log", &rundir.join("run.log").display().to_string());
out
}
