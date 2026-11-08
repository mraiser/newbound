// Journaled facet storage, shared by patch_control_facet/list_control_patches.
// The module exposes ordinary Rust helpers; the command body is a status probe.
pub fn lock() -> MutexGuard<'static, ()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(())).lock().unwrap_or_else(|e| e.into_inner())
}
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let tmp = parent.join(format!(".{}.tmp-{}-{}", path.file_name().unwrap().to_string_lossy(), std::process::id(), flowlang::flowlang::system::unique_session_id::unique_session_id()));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("create {}: {}", tmp.display(), e))?;
        f.write_all(bytes).map_err(|e| format!("write {}: {}", tmp.display(), e))?;
        f.sync_all().map_err(|e| format!("sync {}: {}", tmp.display(), e))?;
    }
    fs::rename(&tmp, path).map_err(|e| format!("rename {} -> {}: {}", tmp.display(), path.display(), e))?;
    if let Ok(dir) = fs::File::open(parent) { let _ = dir.sync_all(); }
    Ok(())
}
pub fn write_record(store: &DataStore, lib: &str, id: &str, record: &DataObject) -> Result<(), String> {
    let mut rec = record.deep_copy();
    let mut data = rec.get_object("data");
    if data.has("attachmentkeynames") {
        let keys = data.get_array("attachmentkeynames");
        for kk in keys.objects() {
            let key = kk.string();
            if !data.has(&key) { continue; }
            let text = ndata::data::Data::as_string(data.get_property(&key));
            let aid = format!("{}.{}", id, key);
            let path = store.get_data_file(lib, &aid);
            atomic_write(&path, text.as_bytes())?;
            data.remove_property(&key);
        }
    }
    let path = store.get_data_file(lib, id);
    atomic_write(&path, rec.to_string().as_bytes())
}
pub fn archive_corrupt(store: &DataStore, lib: &str, id: &str) -> Result<String, String> {
    let path = store.get_data_file(lib, id);
    let dir = store.root.parent().unwrap_or_else(|| Path::new(".")).join("runtime").join("dev").join("corrupt-records").join(format!("{}", flowlang::flowlang::system::time::time()));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dest = dir.join(format!("{}-{}.bin", lib, id));
    fs::copy(&path, &dest).map_err(|e| format!("preserve {}: {}", path.display(), e))?;
    Ok(dest.to_string_lossy().to_string())
}
pub fn is_plan(lib: &str, id: &str) -> bool {
    lib == "kb" && crate::api::new().dev.editcontrol.lookup_id("kb".to_string(), "plan".to_string()) == id
}
fn plan_journal_id(id: &str, n: i64) -> String { format!("{}_pj_{:08}", id, n) }
fn plan_index_id(id: &str) -> String { format!("{}_pj_index", id) }
fn plan_index_record(id: &str, n: i64) -> DataObject {
    let mut rec = DataObject::new(); rec.put_string("id", &plan_index_id(id)); rec.put_string("username", "system");
    rec.put_array("readers", ndata::dataarray::DataArray::new()); rec.put_array("writers", ndata::dataarray::DataArray::new());
    rec.put_int("time", flowlang::flowlang::system::time::time());
    let mut d = DataObject::new(); d.put_int("next", n + 1); d.put_int("count", n); rec.put_object("data", d); rec
}
fn read_plan_index(store: &DataStore, id: &str) -> Result<i64, String> {
    let iid = plan_index_id(id);
    if store.exists("kb", &iid) {
        let d = store.get_data("kb", &iid).get_object("data");
        return Ok(d.try_get_int("next").unwrap_or(1).max(1));
    }
    // One-time migration: copy the valid monolithic prefix, then install the
    // index. Existing history remains intact, including non-memory facets.
    let jid = format!("{}_patches", id);
    let mut next = 1i64;
    if store.exists("kb", &jid) {
        let list = store.get_data("kb", &jid).get_object("data").get_array("list");
        for i in 0..list.len() {
            let mut rec = DataObject::new(); rec.put_string("id", &plan_journal_id(id, next)); rec.put_string("username", "system");
            rec.put_array("readers", ndata::dataarray::DataArray::new()); rec.put_array("writers", ndata::dataarray::DataArray::new());
            let mut d = DataObject::new(); d.put_object("patch", list.get_object(i)); rec.put_object("data", d);
            write_record(store, "kb", &plan_journal_id(id, next), &rec)?; next += 1;
        }
    }
    write_record(store, "kb", &plan_index_id(id), &plan_index_record(id, next - 1))?;
    Ok(next)
}
pub fn list(store: &DataStore, lib: &str, id: &str, limit: i64) -> Result<ndata::dataarray::DataArray, String> {
    let mut out = ndata::dataarray::DataArray::new();
    if is_plan(lib, id) {
        let next = read_plan_index(store, id)?;
        let total = next - 1;
        let n = if limit <= 0 { total } else { total.min(limit) };
        for k in 0..n {
            let pid = plan_journal_id(id, next - 1 - k);
            if !store.exists("kb", &pid) { return Err(format!("missing Plan journal entry {}", pid)); }
            out.push_object(store.get_data("kb", &pid).get_object("data").get_object("patch"));
        }
        return Ok(out);
    }
    let jid = format!("{}_patches", id);
    if !store.exists(lib, &jid) { return Ok(out); }
    let data = store.get_data(lib, &jid).get_object("data");
    if !data.has("list") { return Ok(out); }
    let source = data.get_array("list"); let total = source.len() as i64;
    let n = if limit <= 0 { total } else { total.min(limit) };
    for k in 0..n { out.push_object(source.get_object((total - 1 - k) as usize)); }
    Ok(out)
}
pub fn append(store: &DataStore, lib: &str, id: &str, facet: &str, old: String, new: String, label: String, author: String) -> Result<String, String> {
    if is_plan(lib, id) {
        let next = read_plan_index(store, id)?;
        let patch_id = format!("p{}", next);
        let mut patch = DataObject::new(); patch.put_string("patch_id", &patch_id); patch.put_string("author", &author);
        patch.put_string("facet", facet); patch.put_string("old", &old); patch.put_string("new", &new);
        patch.put_int("time", flowlang::flowlang::system::time::time()); patch.put_string("label", &label);
        let pid = plan_journal_id(id, next);
        let mut rec = DataObject::new(); rec.put_string("id", &pid); rec.put_string("username", "system");
        rec.put_array("readers", ndata::dataarray::DataArray::new()); rec.put_array("writers", ndata::dataarray::DataArray::new());
        let mut d = DataObject::new(); d.put_object("patch", patch); rec.put_object("data", d);
        write_record(store, "kb", &pid, &rec)?;
        write_record(store, "kb", &plan_index_id(id), &plan_index_record(id, next))?;
        return Ok(patch_id);
    }
    let jid = format!("{}_patches", id);
    let mut rec = if store.exists(lib, &jid) {
        match std::panic::catch_unwind(|| store.get_data(lib, &jid)) {
            Ok(v) => v,
            Err(_) => {
                let archive = archive_corrupt(store, lib, &jid)?;
                let mut r = DataObject::new(); r.put_string("id", &jid); r.put_string("username", "system");
                r.put_array("readers", ndata::dataarray::DataArray::new()); r.put_array("writers", ndata::dataarray::DataArray::new());
                let mut d = DataObject::new(); d.put_array("list", ndata::dataarray::DataArray::new()); r.put_object("data", d);
                r.put_string("recovery_archive", &archive); r
            }
        }
    } else {
        let mut r = DataObject::new(); r.put_string("id", &jid); r.put_string("username", "system");
        r.put_array("readers", ndata::dataarray::DataArray::new()); r.put_array("writers", ndata::dataarray::DataArray::new());
        let mut d = DataObject::new(); d.put_array("list", ndata::dataarray::DataArray::new()); r.put_object("data", d); r
    };
    let mut data = rec.get_object("data");
    let mut list = if data.has("list") { data.get_array("list") } else { ndata::dataarray::DataArray::new() };
    let n = list.len() as i64 + 1;
    let patch_id = format!("p{}", n);
    let mut patch = DataObject::new(); patch.put_string("patch_id", &patch_id); patch.put_string("author", &author);
    patch.put_string("facet", facet); patch.put_int("time", flowlang::flowlang::system::time::time()); patch.put_string("label", &label);
    // Whole-facet replacements carry both copies for exact revert. Snippet
    // patches retain the snippets themselves. A periodic full checkpoint bounds
    // recovery work; no unbounded inherited state is added by this journal.
    patch.put_string("old", &old); patch.put_string("new", &new);
    list.push_object(patch); data.put_array("list", list); rec.put_object("data", data);
    rec.put_int("time", flowlang::flowlang::system::time::time());
    write_record(store, lib, &jid, &rec)?;
    Ok(patch_id)
}
let mut out = DataObject::new(); out.put_string("status", "ok");
out.put_string("scope", "shared journaled facet storage"); out.put_string("lib", &lib); out.put_string("id", &id);
out.put_boolean("plan_sharded", is_plan(&lib, &id)); out