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
      if pid > 0 && std::path::Path::new(&format!("/proc/{}", pid)).exists() {
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
h() {{ if [ -f "$BIN" ]; then sha256sum "$BIN" | cut -d' ' -f1; else echo none; fi; }}
H0=$(h)
st running 1 'host build with new crates' ''
echo "== STEP 1: {cargo}" >> "$LOG"
{cargo} >> "$LOG" 2>&1 || {{ st failed 1 'host build failed' ''; exit 1; }}
st running 2 'newbound rebuild' ''
echo "== STEP 2: $BIN rebuild" >> "$LOG"
"$BIN" rebuild >> "$LOG" 2>&1 || {{ st failed 2 'rebuild failed' ''; exit 1; }}
st running 3 'newbound recompile' ''
echo "== STEP 3: $BIN recompile" >> "$LOG"
"$BIN" recompile >> "$LOG" 2>&1 || {{ st failed 3 'recompile failed' ''; exit 1; }}
st running 4 'final host build' ''
echo "== STEP 4: {cargo}" >> "$LOG"
{cargo} >> "$LOG" 2>&1 || {{ st failed 4 'final host build failed' ''; exit 1; }}
H1=$(h)
if [ "$H0" = "$H1" ]; then V=no-restart; else V=restart; fi
st done 4 'complete' "$V"
echo "== DONE: verdict=$V" >> "$LOG"
"#, base = base.display(), bin = binpath, cargo = cargo_cmd);

let script_path = rundir.join("run.sh");
if let Err(e) = fs::write(&script_path, &script) {
  return err(&format!("cannot write runner script: {}", e));
}
let _ = fs::write(rundir.join("run.log"), "");
let init_status = format!("{{\"state\":\"running\",\"step\":0,\"label\":\"manifests pinned; launching runner\",\"verdict\":\"\",\"pid\":0,\"time\":{}}}", now_secs());
let _ = fs::write(&status_path, &init_status);

let spawned = Command::new("setsid")
  .arg("/bin/sh")
  .arg(&script_path)
  .current_dir(&base)
  .stdin(Stdio::null())
  .stdout(Stdio::null())
  .stderr(Stdio::null())
  .spawn();
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
