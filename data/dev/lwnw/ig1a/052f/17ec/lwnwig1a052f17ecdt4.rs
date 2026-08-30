fn err(msg: &str) -> DataObject {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("msg", msg);
  o
}
fn now_secs() -> i64 {
  std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

let url = url.trim().to_string();
let url = if url.is_empty() { "https://github.com/mraiser/newbound.git".to_string() } else { url };
if !url.chars().all(|c| c.is_ascii_alphanumeric() || "._/:@+-".contains(c)) {
  return err("refused: url may contain only [A-Za-z0-9._/:@+-]");
}

let store = DataStore::new();
let base = store.root.canonicalize().unwrap();
let base = base.parent().unwrap().to_path_buf();

// Shared rundir with update_crates: one status file means the two pipelines
// mutually refuse to stack, and update_crates_status polls both.
let rundir = base.join("runtime").join("dev").join("update_crates");
let status_path = rundir.join("status.json");
if let Ok(s) = fs::read_to_string(&status_path) {
  if let Ok(o) = DataObject::try_from_string(&s) {
    if o.has("state") && o.get_string("state") == "running" {
      let pid = if o.has("pid") { o.get_int("pid") } else { 0 };
      if pid > 0 && std::path::Path::new(&format!("/proc/{}", pid)).exists() {
        return err(&format!("refused: a crate-update or hard-reset run is already in progress (runner pid {})", pid));
      }
    }
  }
}
if let Err(e) = fs::create_dir_all(&rundir) {
  return err(&format!("cannot create {}: {}", rundir.display(), e));
}

// Gate hot-reload for the duration - the canon clone may carry new crate pins,
// and step 5's dylibs must not load into this host. Same lifecycle as
// update_crates: in-memory, cleared by restart or by a no-restart finish.
let mut g = DataStore::globals();
if g.has("system") {
  g.get_object("system").put_boolean("hotswap_paused", true);
}

let profile = if cfg!(debug_assertions) { "debug" } else { "release" };
let mut cargo_cmd = String::new();
for a in build_compile_command().objects() {
  if !cargo_cmd.is_empty() { cargo_cmd.push(' '); }
  cargo_cmd.push_str(&a.string());
}
// hardreset.sh made mechanical, with its hazards closed: clone is guarded
// (stale CHUCKTHIS removed first, nothing destructive before clone succeeds),
// recompile is added so FFI dylibs match the new host, and the foreground
// `cargo run` becomes a final build + restart verdict.
let script = format!(r#"#!/bin/sh
cd '{base}'
D=runtime/dev/update_crates
LOG="$D/run.log"
BIN='target/{profile}/newbound'
CB='CHUCKTHIS/target/{profile}/newbound'
st() {{ printf '{{"state":"%s","step":%s,"steps":6,"kind":"hardreset","label":"%s","verdict":"%s","pid":%s,"time":%s}}' "$1" "$2" "$3" "$4" $$ "$(date +%s)" > "$D/status.json.tmp"; mv "$D/status.json.tmp" "$D/status.json"; }}
h() {{ if [ -f "$BIN" ]; then sha256sum "$BIN" | cut -d' ' -f1; else echo none; fi; }}
H0=$(h)
st running 1 'clone canon' ''
rm -rf CHUCKTHIS
echo "== STEP 1: git clone {url}" >> "$LOG"
git clone '{url}' CHUCKTHIS >> "$LOG" 2>&1 || {{ st failed 1 'clone failed' ''; exit 1; }}
st running 2 'overlay canon sources and store' ''
echo "== STEP 2: overlay canon over instance" >> "$LOG"
cp -r CHUCKTHIS/src/* src/ >> "$LOG" 2>&1 && cp -r CHUCKTHIS/data/* data/ >> "$LOG" 2>&1 && mkdir -p newbound_core && cp -r CHUCKTHIS/newbound_core/* newbound_core/ >> "$LOG" 2>&1 && cp CHUCKTHIS/Cargo.toml Cargo.toml >> "$LOG" 2>&1 || {{ st failed 2 'copy failed' ''; exit 1; }}
rm -f CHUCKTHIS/Cargo.lock Cargo.lock src/lib.rs
rm -rf src/app src/dev src/peer src/security cmd
rustup update >> "$LOG" 2>&1 || echo "rustup update failed (continuing)" >> "$LOG"
st running 3 'build canon binary' ''
echo "== STEP 3: (cd CHUCKTHIS && {cargo})" >> "$LOG"
( cd CHUCKTHIS && {cargo} ) >> "$LOG" 2>&1 || {{ st failed 3 'canon build failed' ''; exit 1; }}
st running 4 'newbound rebuild via canon binary' ''
echo "== STEP 4: $CB rebuild" >> "$LOG"
"$CB" rebuild >> "$LOG" 2>&1 || {{ st failed 4 'rebuild failed' ''; exit 1; }}
st running 5 'newbound recompile via canon binary' ''
echo "== STEP 5: $CB recompile" >> "$LOG"
"$CB" recompile >> "$LOG" 2>&1 || {{ st failed 5 'recompile failed' ''; exit 1; }}
rm -rf CHUCKTHIS
st running 6 'final host build' ''
echo "== STEP 6: {cargo}" >> "$LOG"
{cargo} >> "$LOG" 2>&1 || {{ st failed 6 'final host build failed' ''; exit 1; }}
H1=$(h)
if [ "$H0" = "$H1" ]; then V=no-restart; else V=restart; fi
st done 6 'complete' "$V"
echo "== DONE: verdict=$V" >> "$LOG"
"#, base = base.display(), profile = profile, url = url, cargo = cargo_cmd);

let script_path = rundir.join("run.sh");
if let Err(e) = fs::write(&script_path, &script) {
  return err(&format!("cannot write runner script: {}", e));
}
let _ = fs::write(rundir.join("run.log"), "");
let init_status = format!("{{\"state\":\"running\",\"step\":0,\"steps\":6,\"kind\":\"hardreset\",\"label\":\"launching hard-reset runner\",\"verdict\":\"\",\"pid\":0,\"time\":{}}}", now_secs());
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
  let _ = fs::write(&status_path, format!("{{\"state\":\"failed\",\"step\":0,\"steps\":6,\"kind\":\"hardreset\",\"label\":\"could not launch runner: {}\",\"verdict\":\"\",\"pid\":0,\"time\":{}}}", e, now_secs()));
  return err(&format!("hard-reset runner failed to launch: {}", e));
}

let mut out = DataObject::new();
out.put_string("status", "ok");
out.put_string("msg", &format!("hard reset from {} launched. Poll dev.dev.update_crates_status.", url));
out.put_string("url", &url);
out.put_string("log", &rundir.join("run.log").display().to_string());
out