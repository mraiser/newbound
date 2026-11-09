fn lock() -> MutexGuard<'static, ()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(())).lock().unwrap_or_else(|e| e.into_inner())
}
fn err(msg: &str) -> DataObject {
    let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", msg); o
}
fn ok() -> DataObject {
    let mut o = DataObject::new(); o.put_string("status", "ok"); o
}
fn empty_entry() -> DataObject { DataObject::new() }
fn make_record(id: &str, data: DataObject, readers: DataArray, writers: DataArray) -> DataObject {
    let mut r = DataObject::new();
    r.put_string("id", id); r.put_string("username", "system");
    r.put_array("readers", readers); r.put_array("writers", writers);
    r.put_int("time", time()); r.put_object("data", data); r
}
fn resolve_ctl(store: &DataStore, lib: &str, ctl: &str) -> String {
    let looked = crate::api::new().dev.editcontrol.lookup_id(lib.to_string(), ctl.to_string());
    if store.exists(lib, &looked) { return looked; }
    if store.exists(lib, ctl) { return ctl.to_string(); }
    String::new()
}
fn legacy_id(ctlid: &str) -> String { format!("{}_patches", ctlid) }
fn pointer(store: &DataStore, lib: &str, ctlid: &str) -> String {
    if !store.exists(lib, ctlid) { return String::new(); }
    store.get_data(lib, ctlid).get_object("data").try_get_string("runtime_patches").unwrap_or_default()
}
fn set_pointer(store: &DataStore, lib: &str, ctlid: &str, jid: &str) -> Result<(), String> {
    if !store.exists(lib, ctlid) { return Err(format!("source control {}:{} disappeared", lib, ctlid)); }
    let mut rec = store.get_data(lib, ctlid);
    let mut d = rec.get_object("data"); d.put_string("runtime_patches", jid);
    rec.put_object("data", d); rec.put_int("time", time()); store.set_data(lib, ctlid, rec); Ok(())
}
fn clear_pointer(store: &DataStore, lib: &str, ctlid: &str) {
    if !store.exists(lib, ctlid) { return; }
    let mut rec = store.get_data(lib, ctlid); let mut d = rec.get_object("data");
    d.remove_property("runtime_patches"); rec.put_object("data", d); rec.put_int("time", time());
    store.set_data(lib, ctlid, rec);
}
fn delete_record(store: &DataStore, lib: &str, id: &str, session: &str) -> Result<(), String> {
    if !store.exists(lib, id) { return Ok(()); }
    if !crate::security::security::init::check_auth(lib, id, session, true) {
        return Err(format!("not authorized to delete {}:{}", lib, id));
    }
    let answer = crate::app::app::delete::delete(lib.to_string(), id.to_string(), session.to_string());
    if answer != "OK" || store.exists(lib, id) { return Err(format!("could not delete {}:{}", lib, id)); }
    Ok(())
}
fn read_index(store: &DataStore, lib: &str, ctlid: &str, jid: &str, limit: i64) -> Result<DataObject, String> {
    if !store.exists("runtime", jid) { return Err(format!("runtime patch journal {} is missing", jid)); }
    let rec = store.get_data("runtime", jid); let d = rec.get_object("data");
    if d.try_get_int("version").unwrap_or(0) != 2 { return Err(format!("runtime patch journal {} has an unsupported format", jid)); }
    if d.try_get_string("source_lib").unwrap_or_default() != lib || d.try_get_string("control_id").unwrap_or_default() != ctlid {
        return Err(format!("runtime patch journal {} belongs to another control", jid));
    }
    let ids = d.try_get_array("list").map_err(|_| format!("runtime patch journal {} has no ID list", jid))?;
    let total = ids.len(); let n = if limit <= 0 { total } else { (limit as usize).min(total) };
    let mut patches = DataArray::new(); let mut i = total;
    while i > total - n {
        i -= 1; let pid = ids.get_string(i);
        if !store.exists("runtime", &pid) { return Err(format!("patch record {} is missing", pid)); }
        let pd = store.get_data("runtime", &pid).get_object("data");
        if pd.try_get_string("journal_id").unwrap_or_default() != jid { return Err(format!("patch record {} belongs to another journal", pid)); }
        if !pd.has("entry") { return Err(format!("patch record {} has no entry", pid)); }
        patches.push_object(pd.get_object("entry"));
    }
    let mut o = ok(); o.put_array("patches", patches); o.put_string("storage", "runtime");
    o.put_string("journal_id", jid); o.put_int("total", total as i64); Ok(o)
}
fn read_legacy(store: &DataStore, lib: &str, ctlid: &str, limit: i64) -> Result<DataObject, String> {
    let lid = legacy_id(ctlid); let mut patches = DataArray::new(); let mut total = 0usize;
    if store.exists(lib, &lid) {
        let d = store.get_data(lib, &lid).get_object("data");
        if d.has("list") {
            let a = d.get_array("list"); total = a.len();
            let n = if limit <= 0 { total } else { (limit as usize).min(total) };
            let mut i = total;
            while i > total - n { i -= 1; patches.push_object(a.get_object(i)); }
        }
    }
    let mut o = ok(); o.put_array("patches", patches);
    o.put_string("storage", if store.exists(lib, &lid) { "legacy" } else { "none" });
    o.put_string("journal_id", &lid); o.put_int("total", total as i64); Ok(o)
}
fn append_index(store: &DataStore, jid: &str, mut entry: DataObject) -> Result<DataObject, String> {
    let mut rec = store.get_data("runtime", jid); let mut d = rec.get_object("data");
    let mut ids = d.get_array("list"); let patch_id = format!("p{}", ids.len() + 1);
    entry.put_string("patch_id", &patch_id);
    if !entry.has("time") { entry.put_int("time", time()); }
    let pid = format!("dev_patch_{}", unique_session_id());
    let mut pd = DataObject::new(); pd.put_string("journal_id", jid); pd.put_object("entry", entry);
    let readers = rec.try_get_array("readers").unwrap_or_else(|_| DataArray::new());
    let writers = rec.try_get_array("writers").unwrap_or_else(|_| DataArray::new());
    store.set_data("runtime", &pid, make_record(&pid, pd, readers, writers));
    if !store.exists("runtime", &pid) { return Err("patch payload was not persisted".to_string()); }
    ids.push_string(&pid); d.put_array("list", ids); rec.put_object("data", d); rec.put_int("time", time());
    store.set_data("runtime", jid, rec);
    let mut o = ok(); o.put_string("patch_id", &patch_id); o.put_string("record_id", &pid); o.put_string("journal_id", jid); Ok(o)
}
fn migrate_inner(store: &DataStore, lib: &str, ctlid: &str, create: bool, dry: bool, session: &str) -> DataObject {
    let existing = pointer(store, lib, ctlid);
    if !existing.is_empty() {
        match read_index(store, lib, ctlid, &existing, 0) {
            Err(e) => return err(&e),
            Ok(r) => {
                let lid = legacy_id(ctlid); let mut legacy_deleted = !store.exists(lib, &lid);
                let mut warning = String::new();
                if !legacy_deleted && !dry {
                    match delete_record(store, lib, &lid, session) { Ok(_) => legacy_deleted = true, Err(e) => warning = e }
                }
                let mut o = ok(); o.put_boolean("already_migrated", true); o.put_boolean("migrated", false);
                o.put_int("entries", r.get_int("total")); o.put_string("journal_id", &existing);
                o.put_boolean("legacy_deleted", legacy_deleted); o.put_string("warning", &warning); return o;
            }
        }
    }
    let lid = legacy_id(ctlid);
    if !store.exists(lib, &lid) {
        if !create { let mut o = ok(); o.put_boolean("skipped", true); o.put_string("reason", "no legacy journal"); return o; }
        if dry { let mut o = ok(); o.put_boolean("dry_run", true); o.put_int("entries", 0); return o; }
        let jid = format!("dev_journal_{}", unique_session_id()); let mut d = DataObject::new();
        d.put_int("version", 2); d.put_string("source_lib", lib); d.put_string("control_id", ctlid);
        d.put_string("legacy_id", &lid); d.put_array("list", DataArray::new());
        store.set_data("runtime", &jid, make_record(&jid, d, DataArray::new(), DataArray::new()));
        if let Err(e) = set_pointer(store, lib, ctlid, &jid) { return err(&e); }
        let mut o = ok(); o.put_boolean("migrated", true); o.put_int("entries", 0); o.put_string("journal_id", &jid); o.put_boolean("legacy_deleted", true); return o;
    }
    let oldrec = store.get_data(lib, &lid); let olddata = oldrec.get_object("data");
    let oldlist = if olddata.has("list") { olddata.get_array("list") } else { DataArray::new() };
    if dry {
        let mut o = ok(); o.put_boolean("dry_run", true); o.put_int("entries", oldlist.len() as i64);
        o.put_int("legacy_bytes", olddata.to_string().len() as i64); o.put_string("legacy_id", &lid); return o;
    }
    let readers = oldrec.try_get_array("readers").unwrap_or_else(|_| DataArray::new());
    let writers = oldrec.try_get_array("writers").unwrap_or_else(|_| DataArray::new());
    let jid = format!("dev_journal_{}", unique_session_id()); let mut ids = DataArray::new();
    for item in oldlist.objects() {
        if !item.is_object() { return err(&format!("legacy journal {} contains a non-object patch", lid)); }
        let pid = format!("dev_patch_{}", unique_session_id()); let mut pd = DataObject::new();
        pd.put_string("journal_id", &jid); pd.put_object("entry", item.object());
        store.set_data("runtime", &pid, make_record(&pid, pd, readers.clone(), writers.clone()));
        ids.push_string(&pid);
    }
    let mut d = DataObject::new(); d.put_int("version", 2); d.put_string("source_lib", lib);
    d.put_string("control_id", ctlid); d.put_string("legacy_id", &lid); d.put_array("list", ids);
    store.set_data("runtime", &jid, make_record(&jid, d, readers, writers));
    let probe = match read_index(store, lib, ctlid, &jid, 0) { Ok(v) => v, Err(e) => return err(&format!("runtime journal was not installed: {}", e)) };
    let got = probe.get_array("patches");
    if got.len() != oldlist.len() { return err("runtime journal length differs from legacy history; legacy retained"); }
    for i in 0..oldlist.len() {
        let before = oldlist.get_object(i); let after = got.get_object(got.len() - 1 - i);
        if before.to_string() != after.to_string() { return err(&format!("runtime patch {} differs from legacy history; legacy retained", i)); }
    }
    if let Err(e) = set_pointer(store, lib, ctlid, &jid) { return err(&e); }
    let mut warning = String::new(); let mut legacy_deleted = true;
    if let Err(e) = delete_record(store, lib, &lid, session) { legacy_deleted = false; warning = e; }
    let mut o = ok(); o.put_boolean("migrated", true); o.put_int("entries", oldlist.len() as i64);
    o.put_string("journal_id", &jid); o.put_boolean("legacy_deleted", legacy_deleted); o.put_string("warning", &warning); o
}
let store = DataStore::new();
let ctlid = resolve_ctl(&store, &lib, &ctl);
if ctlid.is_empty() { return err(&format!("Control '{}' not found in library '{}'", ctl, lib)); }
match op.as_str() {
    "read" => {
        let jid = pointer(&store, &lib, &ctlid);
        if jid.is_empty() { match read_legacy(&store, &lib, &ctlid, limit) { Ok(o) => o, Err(e) => err(&e) } }
        else { match read_index(&store, &lib, &ctlid, &jid, limit) { Ok(o) => o, Err(e) => err(&e) } }
    },
    "status" => {
        let jid = pointer(&store, &lib, &ctlid);
        if jid.is_empty() { match read_legacy(&store, &lib, &ctlid, 0) { Ok(mut o) => { o.put_string("control_id", &ctlid); o }, Err(e) => err(&e) } }
        else { match read_index(&store, &lib, &ctlid, &jid, 0) { Ok(mut o) => { o.put_string("control_id", &ctlid); o }, Err(e) => err(&e) } }
    },
    "migrate" => { let _guard = lock(); migrate_inner(&store, &lib, &ctlid, false, dry_run, &nn_sessionid) },
    "append" => {
        let _guard = lock(); let migrated = migrate_inner(&store, &lib, &ctlid, true, false, &nn_sessionid);
        if migrated.get_string("status") != "ok" { return migrated; }
        let jid = pointer(&store, &lib, &ctlid);
        match append_index(&store, &jid, entry) { Ok(mut o) => { o.put_boolean("migrated", migrated.try_get_boolean("migrated").unwrap_or(false)); o.put_boolean("legacy_deleted", migrated.try_get_boolean("legacy_deleted").unwrap_or(true)); o.put_string("warning", &migrated.try_get_string("warning").unwrap_or_default()); o }, Err(e) => err(&e) }
    },
    "move" => {
        if to_lib.trim().is_empty() { return err("move requires to_lib"); }
        let _guard = lock(); let migrated = migrate_inner(&store, &lib, &ctlid, true, false, &nn_sessionid);
        if migrated.get_string("status") != "ok" { return migrated; }
        let jid = pointer(&store, &lib, &ctlid); let mut rec = store.get_data("runtime", &jid); let mut d = rec.get_object("data");
        d.put_string("source_lib", &to_lib); rec.put_object("data", d); rec.put_int("time", time()); store.set_data("runtime", &jid, rec);
        match append_index(&store, &jid, entry) { Ok(mut o) => { o.put_string("from_lib", &lib); o.put_string("to_lib", &to_lib); o }, Err(e) => err(&e) }
    },
    "delete" => {
        let _guard = lock(); let jid = pointer(&store, &lib, &ctlid); let mut deleted = 0i64;
        if !jid.is_empty() {
            let ids = store.get_data("runtime", &jid).get_object("data").get_array("list");
            for i in 0..ids.len() { let id = ids.get_string(i); if let Err(e) = delete_record(&store, "runtime", &id, &nn_sessionid) { return err(&e); } deleted += 1; }
            if let Err(e) = delete_record(&store, "runtime", &jid, &nn_sessionid) { return err(&e); }
            clear_pointer(&store, &lib, &ctlid);
        }
        let lid = legacy_id(&ctlid); if let Err(e) = delete_record(&store, &lib, &lid, &nn_sessionid) { return err(&e); }
        let mut o = ok(); o.put_int("deleted_patches", deleted); o
    },
    _ => err("op must be read, status, append, migrate, move, or delete")
}