// ---- PRONG 3 setup: result cache key ----
let key = format!("{}:{}:{}", &lib, &ctl, &cmd);
let store = DataStore::new();
let root = store.get_lib_root(&lib);

let changed = build(&lib, &ctl, &cmd, &root);

if !changed {
    // PRONG 3: unchanged code returns the last REAL result, not assumed success.
    // Fixes the known save-twice-reports-success bug (within a service session).
    // But never trust it while the crate's ARTIFACT is missing: a derived
    // instance ships no target/, so the first upsert of store-identical code
    // answered OK with no dylib ever built. Fall through and build for real.
    if newest_artifact_mtime(&root).is_some() {
        let c = result_cache();
        if c.has(&key) {
            let last = c.get_string(&key);
            return package(&last);
        }
        // No record yet (first call since restart): legacy behavior
        return package("OK");
    }
}

let before = newest_artifact_mtime(&root);
let ja = build_compile_command();
let (failed, text) = execute_compile_command(ja, root.display().to_string());

let outcome: String;
if failed {
    // PRONG 1: exit status was the verdict; `text` is the extracted error report (never empty)
    outcome = text;
} else {
    // PRONG 2: a successful build of changed sources must advance an artifact
    let after = newest_artifact_mtime(&root);
    let advanced = match (before, after) {
        (Some(b0), Some(a)) => a > b0,
        (None, Some(_)) => true,
        _ => false,
    };
    if advanced {
        outcome = "OK".to_string();
    } else {
        outcome = "error: cargo reported success but produced no new build artifact. Likely stale fingerprints or clock skew (no RTC on this machine). Run `rebuild_lib` to reset build state.".to_string();
    }
}

let mut c = result_cache();
c.put_string(&key, &outcome);
package(&outcome)
}

// ---- module-level helpers ----

fn package(outcome: &str) -> DataObject {
    let mut r = DataObject::new();
    if outcome == "OK" {
        r.put_string("status", "ok");
    } else {
        r.put_string("status", "err");
    }
    r.put_string("msg", outcome);
    r
}

fn result_cache() -> DataObject {
    let mut g = DataStore::globals();
    if !g.has("COMPILE_CACHE") {
        g.put_object("COMPILE_CACHE", DataObject::new());
    }
    g.get_object("COMPILE_CACHE")
}

// Where cargo ACTUALLY writes this crate's artifacts. A crate EXCLUDED from
// the workspace (any FFI-rooted library) gets its own target/;
// a workspace MEMBER (newbound_core, which hosts app/dev/peer/security) gets
// the WORKSPACE's target/ and its own never exists - so looking only under
// <root>/target found nothing, and every SUCCESSFUL non-FFI compile reported
// "cargo reported success but produced no new build artifact".
fn effective_target_dir(root: &std::path::Path) -> std::path::PathBuf {
    let profile = if cfg!(debug_assertions) { "debug" } else { "release" };
    let own = root.join("target").join(profile);
    // Decide STRUCTURALLY, not by which directories happen to exist: a
    // workspace member's own target/ is never written even if something else
    // created it, and an excluded crate's own target/ is simply absent until
    // its first build (the caller's None-then-Some comparison covers that).
    let name = root.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
    let mut cur = root.parent();
    while let Some(dir) = cur {
        let manifest = dir.join("Cargo.toml");
        if manifest.is_file() {
            if let Ok(s) = std::fs::read_to_string(&manifest) {
                if s.contains("[workspace]") {
                    // Textual read of the workspace manifest's exclude list.
                    // An excluded crate keeps its own target - absent on a
                    // fresh checkout, which the None-then-Some comparison in
                    // the caller already handles correctly.
                    let excluded = match s.find("exclude") {
                        Some(i) => match s[i..].find('[') {
                            Some(o) => match s[i + o..].find(']') {
                                Some(c) => s[i + o..i + o + c].contains(&format!("\"{}\"", name)),
                                None => false,
                            },
                            None => false,
                        },
                        None => false,
                    };
                    if excluded { return own; }
                    return dir.join("target").join(profile);
                }
            }
        }
        cur = dir.parent();
    }
    own
}

fn newest_artifact_mtime(root: &std::path::Path) -> Option<std::time::SystemTime> {
    let dir = effective_target_dir(root);
    let mut newest: Option<std::time::SystemTime> = None;
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for e in entries.flatten() {
            let p = e.path();
            let is_artifact = p.extension().and_then(|x| x.to_str())
                .map(|ext| ext == "so" || ext == "rlib" || ext == "dylib" || ext == "dll" || ext == "a")
                .unwrap_or(false);
            if is_artifact {
                if let Ok(md) = e.metadata() {
                    if let Ok(t) = md.modified() {
                        if newest.map_or(true, |n| t > n) { newest = Some(t); }
                    }
                }
            }
        }
    }
    newest
}

fn extract_error_text(stderr: &str) -> String {
    // Pull the rustc error blocks (header line + continuation until blank).
    // If nothing matches (killed build, decorated output), fall back to the raw tail —
    // NEVER return an empty error for a failed build.
    let mut s = String::new();
    let mut in_block = false;
    for line in stderr.lines() {
        if in_block {
            s += line; s += "\n";
            in_block = !line.trim().is_empty();
        } else if line.starts_with("error") {
            s += line; s += "\n";
            in_block = true;
        }
    }
    if s.trim().is_empty() {
        let chars: Vec<char> = stderr.chars().collect();
        let start = chars.len().saturating_sub(4000);
        s = format!("error: cargo failed without recognizable rustc output. Raw stderr tail:\n{}",
                    chars[start..].iter().collect::<String>());
    }
    s
}

pub fn system_call_in_dir(command: DataArray, dir: String) -> DataObject {
  let mut out = DataObject::new();

  let mut command = command.clone();
  let a = command.get_string(0);
  command.remove_property(0);

  let mut args = Vec::<String>::new();
  for arg in command.objects() {
    args.push(arg.string());
  }

  println!("executing command in directory {}", &dir);
  let cmd = Command::new(&a)
  .args(args)
  .current_dir(&dir)
  .env("CARGO_TERM_COLOR", "never") // never let decorated output defeat error parsing
  .stderr(Stdio::piped())
  .stdout(Stdio::piped())
  .spawn();

  if cmd.is_err() {
    let msg = "Unable to execute system call ".to_string()+&a+" "+&command.to_string();
    println!("{}", msg);
    out.put_string("err", &msg);
    out.put_string("status", "err");
    out.put_int("code", -1);
  }
  else {
    let cmd = cmd.unwrap();
    let output = cmd.wait_with_output().unwrap();
    let result = std::str::from_utf8(&output.stdout).unwrap_or("");
    let error = std::str::from_utf8(&output.stderr).unwrap_or("");

    // Exit code is the verdict: 0 = success, None = killed by signal (-9)
    let code_val = output.status.code().map(|c| c as i64).unwrap_or(-9);

    out.put_string("status", "ok");
    out.put_string("out", result);
    out.put_string("err", error);
    out.put_int("code", code_val);
  }

  out
}

pub fn execute_compile_command(ja: DataArray, dir: String) -> (bool, String) {
  // Signature preserved for rebuild_lib / compile_rust. Semantics upgraded:
  // `true` now means "the build FAILED" (exit-code verdict), and the String is
  // the extracted error report — instead of "some line started with 'error'".
  let o = system_call_in_dir(ja, dir);
  if o.get_string("status") != "ok" {
    return (true, format!("error: {}", o.get_string("err")));
  }
  let code = o.get_int("code");
  if code == 0 {
    return (false, String::new());
  }
  let stderr = o.get_string("err");
  (true, extract_error_text(&stderr))
}

pub fn build_compile_command() -> DataArray {
  let mut ja = DataArray::new();
  ja.push_string("cargo");
  ja.push_string("build");

  #[cfg(not(debug_assertions))]
  ja.push_string("--release");

  let mut features = "".to_string();

  #[cfg(feature="serde_support")]
  {
    features += ",serde_support";
  }

  #[cfg(feature="reload")]
  {
    features += ",reload";
  }

  #[cfg(feature="python_runtime")]
  {
    features += ",python_runtime";
  }

  #[cfg(feature="javascript_runtime")]
  {
    features += ",javascript_runtime";
  }

  #[cfg(feature="java_runtime")]
  {
    features += ",java_runtime";
  }

  #[cfg(feature="webview")]
  {
    features += ",webview";
  }

  if features != "".to_string() {
    features = features[1..].to_string();
    features = "--features=".to_string() + &features;
    ja.push_string(&features);
  }
  ja