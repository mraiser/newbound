let lib = "scratch".to_string();
let ctl = "scratch".to_string();
let cmd_name = format!("eval_{}", unique_session_id());

// Best-effort removal of the temp command: datastore docs via delete_command,
// plus the generated source file and its mod.rs references (delete_command leaves
// those behind, and stale broken files poison every subsequent build of this crate).
fn cleanup_temp(lib: &str, ctl: &str, cmd_name: &str) {
    let _ = delete_command(lib.to_string(), ctl.to_string(), cmd_name.to_string(), "admin".to_string(), "".to_string());

    // Scrub generated artifacts
    let root = flowlang::datastore::DataStore::new().get_lib_root(lib);
    let dir = root.join("src").join(lib).join(ctl);
    let _ = std::fs::remove_file(dir.join(format!("{}.rs", cmd_name)));
    let modrs = dir.join("mod.rs");
    if let Ok(content) = std::fs::read_to_string(&modrs) {
        // Both generated lines reference the module name:
        //   pub mod eval_x;
        //   cmds.push(("<implid>".to_string(), eval_x::execute, "".to_string()));
        let filtered: Vec<&str> = content.lines().filter(|l| !l.contains(cmd_name)).collect();
        let new_content = filtered.join("\n");
        if new_content != content {
            let _ = std::fs::write(&modrs, new_content);
        }
    }
}

// 1. Create the temporary command - a direct call into
// dev.code.upsert_command (same crate). It returns its result unwrapped;
// catch_unwind so a panic can't skip cleanup.
let ax = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| upsert_command(
    lib.clone(), ctl.clone(), cmd_name.clone(), "rust".to_string(),
    "FLAT".to_string(), DataArray::new(), imports.clone(), code.clone())));
let upsert_res = match ax {
    Ok(res) => res,
    Err(e) => {
        cleanup_temp(&lib, &ctl, &cmd_name);
        let msg = if let Some(s) = e.downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = e.downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic occurred".to_string()
        };
        let mut err_obj = DataObject::new();
        err_obj.put_string("status", "err");
        err_obj.put_string("msg", &format!("Failed to execute upsert_command: {}", msg));
        return err_obj;
    }
};

// Return immediately if compilation fails — but clean up FIRST, so the broken
// source can't sabotage the next eval's build.
if upsert_res.has("status") && upsert_res.get_string("status") == "err" {
    cleanup_temp(&lib, &ctl, &cmd_name);
    return upsert_res; 
}

// 2. Resolve the impl id — the runtime registry is keyed by impl id, not command name
let store = flowlang::datastore::DataStore::new();
let cmd_id = store.lookup_cmd_id(&lib, &ctl, &cmd_name);
let mut impl_id = String::new();
if !cmd_id.is_empty() && store.exists(&lib, &cmd_id) {
    let d = store.get_data(&lib, &cmd_id).get_object("data");
    if d.has("rust") { impl_id = d.get_string("rust"); }
}
if impl_id.is_empty() {
    cleanup_temp(&lib, &ctl, &cmd_name);
    let mut err_obj = DataObject::new();
    err_obj.put_string("status", "err");
    err_obj.put_string("msg", &format!("Command {}:{}:{} has no impl record in the datastore after upsert", lib, ctl, cmd_name));
    return err_obj;
}

// 3. Poll the runtime registry until the hot-reloaded command actually exists.
let waits_ms = [500u64, 1000, 1500, 2000, 2000, 2000, 2000, 2000];
let mut registered = false;
for w in waits_ms.iter() {
    std::thread::sleep(std::time::Duration::from_millis(*w));
    let probe_id = impl_id.clone();
    let probe = std::panic::catch_unwind(std::panic::AssertUnwindSafe(move || {
        let _ = RustCmd::new(&probe_id);
    }));
    if probe.is_ok() { registered = true; break; }
}

if !registered {
    cleanup_temp(&lib, &ctl, &cmd_name);
    let mut err_obj = DataObject::new();
    err_obj.put_string("status", "err");
    err_obj.put_string("msg", &format!("Command {}:{}:{} compiled but was not registered in the running process within the wait window. Hot reload may have failed or the build produced no new artifact. Do not retry the same code unchanged; report this condition.", lib, ctl, cmd_name));
    return err_obj;
}

// 4. Invoke the temporary command - a direct call into
// dev.code.invoke_command (same crate); it guards the target's execution
// itself, catch_unwind covers the rest. The result comes back unwrapped:
// {status, result|msg}.
let ax = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| invoke_command(
    lib.clone(), ctl.clone(), cmd_name.clone(), DataObject::new())));
let exec_res = match ax {
    Ok(res) => res,
    Err(e) => {
        let msg = if let Some(s) = e.downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = e.downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic occurred".to_string()
        };
        let mut err_obj = DataObject::new();
        err_obj.put_string("status", "err");
        err_obj.put_string("msg", &format!("Panic during execution: {}", msg));
        err_obj
    }
};

// 5. Clean up the temporary command (datastore + generated artifacts)
cleanup_temp(&lib, &ctl, &cmd_name);

// Return the result of the invocation
exec_res