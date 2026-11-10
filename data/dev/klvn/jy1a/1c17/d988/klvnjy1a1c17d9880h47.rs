// Patch history is INSTANCE-LOCAL: it lives in the gitignored runtime library
// and nothing about it is ever written to a tracked record. The index id is
// DERIVED from (lib, control id), so every instance finds its own journal
// without a pointer. A control with no runtime journal reads its legacy
// <ctlid>_patches record; the first write imports it.
const FNV0: u64 = 0xcbf29ce484222325;
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
fn journal_id(lib: &str, ctlid: &str) -> String { format!("dev_journal_{}_{}", lib, ctlid) }
fn fnv(mut h: u64, s: &str) -> u64 {
    for b in s.as_bytes() { h ^= *b as u64; h = h.wrapping_mul(0x100000001b3); } h
}
fn all_objects(a: &DataArray) -> bool { a.objects().iter().all(|d| d.is_object()) }
// Sequential over entries, so the hash of a prefix is computable.
fn hash_list(a: &DataArray, upto: usize) -> String {
    let mut h = FNV0;
    for i in 0..upto { h = fnv(h, &a.get_object(i).to_string()); h = fnv(h, "\n"); }
    format!("{:016x}", h)
}
fn legacy_list(store: &DataStore, lib: &str, ctlid: &str) -> Option<DataArray> {
    let lid = legacy_id(ctlid);
    if !store.exists(lib, &lid) { return None; }
    let d = store.get_data(lib, &lid).get_object("data");
    Some(if d.has("list") { d.get_array("list") } else { DataArray::new() })
}
// Ok(None) = no runtime journal; Err = one exists but is not usable.
fn index(store: &DataStore, lib: &str, ctlid: &str) -> Result<Option<DataObject>, String> {
    let jid = journal_id(lib, ctlid);
    if !store.exists("runtime", &jid) { return Ok(None); }
    let rec = store.get_data("runtime", &jid);
    let d = match rec.try_get_object("data") { Ok(d) => d, Err(_) => return Err(format!("runtime patch journal {} has no data", jid)) };
    if d.try_get_int("version").unwrap_or(0) != 2 { return Err(format!("runtime patch journal {} has an unsupported format", jid)); }
    if d.try_get_string("source_lib").unwrap_or_default() != lib || d.try_get_string("control_id").unwrap_or_default() != ctlid {
        return Err(format!("runtime patch journal {} belongs to another control", jid));
    }
    if d.try_get_array("list").is_err() { return Err(format!("runtime patch journal {} has no ID list", jid)); }
    Ok(Some(rec))
}
fn write_index(store: &DataStore, lib: &str, ctlid: &str, ids: DataArray, imported: usize, imported_hash: &str, readers: DataArray, writers: DataArray) {
    let jid = journal_id(lib, ctlid); let mut d = DataObject::new();
    d.put_int("version", 2); d.put_string("source_lib", lib); d.put_string("control_id", ctlid);
    d.put_array("list", ids); d.put_int("imported", imported as i64); d.put_string("imported_hash", imported_hash);
    store.set_data("runtime", &jid, make_record(&jid, d, readers, writers));
}
// An unusable index is never destroyed: it is copied aside before a fresh one replaces it.
fn quarantine(store: &DataStore, jid: &str) {
    let mut rec = store.get_data("runtime", jid).deep_copy();
    let qid = format!("{}_broken_{}", jid, time());
    rec.put_string("id", &qid); store.set_data("runtime", &qid, rec);
}
fn delete_record(store: &DataStore, lib: &str, id: &str, session: &str) -> Result<(), String> {
    if !store.exists(lib, id) { return Ok(()); }
    // Headless exec has not booted the HTTP service's global snapshot;
    // initialize it normally, then use the same secured record command in
    // both execution modes. Never bypass the store with a file shortcut.
    if !DataStore::globals().has("system") { flowlang::appserver::init_globals(); }
    if !crate::security::security::init::check_auth(lib, id, session, true) {
        return Err(format!("not authorized to delete {}:{}", lib, id));
    }
    let answer = crate::app::app::delete::delete(lib.to_string(), id.to_string(), session.to_string());
    if answer != "OK" || store.exists(lib, id) { return Err(format!("could not delete {}:{}", lib, id)); }
    Ok(())
}
fn view(store: &DataStore, lib: &str, ctlid: &str, limit: i64, full: bool) -> DataObject {
    let rec = match index(store, lib, ctlid) { Ok(r) => r, Err(e) => return err(&e) };
    let mut o = ok(); let mut patches = DataArray::new(); let mut missing = 0i64;
    match rec {
        Some(rec) => {
            let ids = rec.get_object("data").get_array("list"); let total = ids.len();
            if full {
                let n = if limit <= 0 { total } else { (limit as usize).min(total) }; let mut i = total;
                while i > total - n {
                    i -= 1; let pid = ids.get_string(i);
                    if !store.exists("runtime", &pid) { missing += 1; continue; }
                    let pd = store.get_data("runtime", &pid).get_object("data");
                    if pd.has("entry") { patches.push_object(pd.get_object("entry")); } else { missing += 1; }
                }
            }
            o.put_string("storage", "runtime"); o.put_string("journal_id", &journal_id(lib, ctlid)); o.put_int("total", total as i64);
        },
        None => {
            let l = legacy_list(store, lib, ctlid);
            o.put_string("storage", if l.is_some() { "legacy" } else { "none" });
            let l = l.unwrap_or_else(DataArray::new); let total = l.len();
            if full {
                let n = if limit <= 0 { total } else { (limit as usize).min(total) };
                let items = l.objects(); let mut i = total;
                while i > total - n { i -= 1; if items[i].is_object() { patches.push_object(items[i].object()); } else { missing += 1; } }
            }
            o.put_string("journal_id", &legacy_id(ctlid)); o.put_int("total", total as i64);
        }
    }
    o.put_array("patches", patches); o.put_int("missing", missing);
    o.put_boolean("legacy_present", store.exists(lib, &legacy_id(ctlid))); o.put_string("control_id", ctlid); o
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
// Copy every legacy entry into its own runtime record. Import ids are derived
// from the legacy content, so an interrupted import resumes without duplicates.
fn import(store: &DataStore, lib: &str, ctlid: &str, l: &DataArray, readers: &DataArray, writers: &DataArray) -> Result<DataArray, String> {
    let jid = journal_id(lib, ctlid);
    let seed = fnv(FNV0, &format!("{}:{}:{}", lib, legacy_id(ctlid), l.to_string()));
    let mut ids = DataArray::new();
    for i in 0..l.len() {
        let want = l.get_object(i).to_string();
        let pid = format!("dev_import_{:016x}_{}", seed, i);
        if !store.exists("runtime", &pid) {
            let mut pd = DataObject::new(); pd.put_string("journal_id", &jid); pd.put_object("entry", l.get_object(i).deep_copy());
            store.set_data("runtime", &pid, make_record(&pid, pd, readers.clone(), writers.clone()));
        }
        if !store.exists("runtime", &pid) { return Err(format!("import record {} was not persisted", pid)); }
        let pd = store.get_data("runtime", &pid).get_object("data");
        if !pd.has("entry") || pd.get_object("entry").to_string() != want { return Err(format!("import record {} does not match legacy entry {}", pid, i)); }
        ids.push_string(&pid);
    }
    Ok(ids)
}
// Make sure a usable runtime journal exists (create) and/or fold the legacy
// journal into it. The index record is the commit point: it is written only
// after every imported entry has been read back and compared.
// create       - a write is about to append: this must not fail on journal
//                state, so problems degrade to a fresh journal plus a warning.
// delete_legacy- explicit migration (or a move): remove the legacy record once
//                its history is verifiably in the runtime journal. Ordinary
//                writes never delete a legacy record.
fn ensure(store: &DataStore, lib: &str, ctlid: &str, create: bool, delete_legacy: bool, dry: bool, session: &str) -> DataObject {
    let jid = journal_id(lib, ctlid); let lid = legacy_id(ctlid); let mut warning = String::new();
    let legacy = match legacy_list(store, lib, ctlid) {
        Some(l) if !all_objects(&l) => {
            if !create { return err(&format!("legacy journal {} contains a non-object patch; retained", lid)); }
            warning = format!("legacy journal {} contains a non-object patch; ignored", lid); None
        },
        x => x
    };
    let existing = match index(store, lib, ctlid) {
        Ok(x) => x,
        Err(e) => {
            if !create || dry { return err(&e); }
            quarantine(store, &jid); warning = format!("{}; set aside and restarted", e); None
        }
    };
    if let Some(rec) = existing {
        let d = rec.get_object("data"); let mut total = d.get_array("list").len() as i64;
        let mut legacy_deleted = !store.exists(lib, &lid); let mut merged = 0i64;
        if let Some(l) = legacy {
            let n0 = d.try_get_int("imported").unwrap_or(0) as usize;
            let h0 = d.try_get_string("imported_hash").unwrap_or_else(|_| hash_list(&l, 0));
            let prefix = l.len() >= n0 && hash_list(&l, n0) == h0;
            let same = prefix && l.len() == n0;
            if delete_legacy && !dry {
                if !prefix { return err(&format!("legacy journal {} diverged from the history already imported; retained", lid)); }
                // Entries an older binary appended after the import: carry them over.
                for i in n0..l.len() {
                    if let Err(e) = append_index(store, &jid, l.get_object(i).deep_copy()) { return err(&e); }
                    merged += 1;
                }
                if merged > 0 {
                    let mut r2 = store.get_data("runtime", &jid); let mut d2 = r2.get_object("data");
                    d2.put_int("imported", l.len() as i64); d2.put_string("imported_hash", &hash_list(&l, l.len()));
                    r2.put_object("data", d2); store.set_data("runtime", &jid, r2); total += merged;
                }
                match delete_record(store, lib, &lid, session) { Ok(_) => legacy_deleted = true, Err(e) => warning = e }
            } else if !same {
                warning = format!("legacy journal {} holds entries that are not in the runtime journal; run convert_patch_journals", lid);
            }
        }
        let mut o = ok(); o.put_boolean("already_migrated", true); o.put_boolean("migrated", merged > 0);
        o.put_int("entries", total); o.put_int("merged", merged); o.put_string("journal_id", &jid);
        o.put_boolean("legacy_deleted", legacy_deleted); o.put_string("warning", &warning); return o;
    }
    let l = match legacy {
        Some(l) => l,
        None => {
            if !create { let mut o = ok(); o.put_boolean("skipped", true); o.put_string("reason", "no legacy journal"); return o; }
            write_index(store, lib, ctlid, DataArray::new(), 0, &hash_list(&DataArray::new(), 0), DataArray::new(), DataArray::new());
            let mut o = ok(); o.put_boolean("migrated", false); o.put_boolean("created", true); o.put_int("entries", 0);
            o.put_string("journal_id", &jid); o.put_boolean("legacy_deleted", !store.exists(lib, &lid)); o.put_string("warning", &warning); return o;
        }
    };
    if dry {
        let mut o = ok(); o.put_boolean("dry_run", true); o.put_int("entries", l.len() as i64);
        o.put_int("legacy_bytes", l.to_string().len() as i64); o.put_string("legacy_id", &lid); return o;
    }
    let oldrec = store.get_data(lib, &lid);
    let readers = oldrec.try_get_array("readers").unwrap_or_else(|_| DataArray::new());
    let writers = oldrec.try_get_array("writers").unwrap_or_else(|_| DataArray::new());
    let mut migrated = true;
    match import(store, lib, ctlid, &l, &readers, &writers) {
        Ok(ids) => write_index(store, lib, ctlid, ids, l.len(), &hash_list(&l, l.len()), readers, writers),
        Err(e) => {
            if !create { return err(&format!("{}; legacy retained", e)); }
            // The write must still be journaled: start empty, keep the legacy
            // record, and let an explicit migrate merge it later.
            migrated = false; warning = format!("{}; legacy retained, journal started empty", e);
            write_index(store, lib, ctlid, DataArray::new(), 0, &hash_list(&l, 0), readers, writers);
        }
    }
    if index(store, lib, ctlid).ok().flatten().is_none() { return err("runtime journal index was not persisted; legacy retained"); }
    let mut legacy_deleted = false;
    if migrated && delete_legacy {
        match delete_record(store, lib, &lid, session) { Ok(_) => legacy_deleted = true, Err(e) => warning = e }
    }
    let mut o = ok(); o.put_boolean("migrated", migrated); o.put_int("entries", if migrated { l.len() as i64 } else { 0 });
    o.put_string("journal_id", &jid); o.put_boolean("legacy_deleted", legacy_deleted); o.put_string("warning", &warning); o
}
let store = DataStore::new();
let mut ctlid = resolve_ctl(&store, &lib, &ctl);
// move is called once the control already lives in to_lib.
if ctlid.is_empty() && op == "move" && !to_lib.trim().is_empty() { ctlid = resolve_ctl(&store, &to_lib, &ctl); }
if ctlid.is_empty() { return err(&format!("Control '{}' not found in library '{}'", ctl, lib)); }
match op.as_str() {
    "read" => view(&store, &lib, &ctlid, limit, true),
    "status" => view(&store, &lib, &ctlid, 0, false),
    "migrate" => { let _guard = lock(); ensure(&store, &lib, &ctlid, false, true, dry_run, &nn_sessionid) },
    "append" => {
        let _guard = lock(); let e = ensure(&store, &lib, &ctlid, true, false, false, &nn_sessionid);
        if e.get_string("status") != "ok" { return e; }
        match append_index(&store, &journal_id(&lib, &ctlid), entry) {
            Ok(mut o) => {
                o.put_boolean("migrated", e.try_get_boolean("migrated").unwrap_or(false));
                o.put_boolean("legacy_deleted", e.try_get_boolean("legacy_deleted").unwrap_or(false));
                o.put_string("warning", &e.try_get_string("warning").unwrap_or_default()); o
            },
            // Writers journal AFTER their change has landed; say so.
            Err(m) => err(&format!("the change was applied but could not be journaled: {}", m))
        }
    },
    "move" => {
        if to_lib.trim().is_empty() || to_lib == lib { return err("move requires a different to_lib"); }
        let _guard = lock();
        // The control is leaving lib: its legacy record must not be stranded there.
        let e = ensure(&store, &lib, &ctlid, true, true, false, &nn_sessionid);
        if e.get_string("status") != "ok" { return e; }
        let src = journal_id(&lib, &ctlid); let dst = journal_id(&to_lib, &ctlid);
        let rec = store.get_data("runtime", &src); let d = rec.get_object("data");
        if store.exists("runtime", &dst) { quarantine(&store, &dst); }
        write_index(&store, &to_lib, &ctlid, d.get_array("list"), d.try_get_int("imported").unwrap_or(0) as usize,
            &d.try_get_string("imported_hash").unwrap_or_default(),
            rec.try_get_array("readers").unwrap_or_else(|_| DataArray::new()), rec.try_get_array("writers").unwrap_or_else(|_| DataArray::new()));
        if index(&store, &to_lib, &ctlid).ok().flatten().is_none() { return err("moved journal index was not persisted; source journal retained"); }
        let mut warning = e.try_get_string("warning").unwrap_or_default();
        if let Err(m) = delete_record(&store, "runtime", &src, &nn_sessionid) { warning = m; }
        match append_index(&store, &dst, entry) {
            Ok(mut o) => { o.put_string("from_lib", &lib); o.put_string("to_lib", &to_lib); o.put_string("warning", &warning); o },
            Err(m) => err(&m)
        }
    },
    "delete" => {
        let _guard = lock(); let jid = journal_id(&lib, &ctlid); let mut deleted = 0i64;
        if store.exists("runtime", &jid) {
            if let Ok(Some(rec)) = index(&store, &lib, &ctlid) {
                let ids = rec.get_object("data").get_array("list");
                for i in 0..ids.len() { let id = ids.get_string(i); if let Err(e) = delete_record(&store, "runtime", &id, &nn_sessionid) { return err(&e); } deleted += 1; }
            }
            if let Err(e) = delete_record(&store, "runtime", &jid, &nn_sessionid) { return err(&e); }
        }
        if let Err(e) = delete_record(&store, &lib, &legacy_id(&ctlid), &nn_sessionid) { return err(&e); }
        let mut o = ok(); o.put_int("deleted_patches", deleted); o
    },
    _ => err("op must be read, status, append, migrate, move, or delete")
}