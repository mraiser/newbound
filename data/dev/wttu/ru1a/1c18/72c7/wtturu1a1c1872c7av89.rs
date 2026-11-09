// app.libs reads the loaded library snapshot. Headless exec does not boot
// the HTTP service, so initialize it explicitly (idempotent).
if !DataStore::globals().has("system") { flowlang::appserver::init_globals(); }
let store = DataStore::new();
let mut out = DataObject::new(); out.put_string("status", "ok");
let mut results = DataArray::new();
let mut converted = 0i64; let mut candidates = 0i64; let mut skipped = 0i64; let mut failed = 0i64; let mut entries = 0i64;
for lm in crate::api::new().app.app.libs().objects() {
    let slib = lm.object().get_string("id");
    if slib == "runtime" || (!lib.trim().is_empty() && lib != "*" && slib != lib) { continue; }
    if !store.exists(&slib, "controls") { continue; }
    let cd = store.get_data(&slib, "controls").get_object("data");
    let list = if cd.has("list") { cd.get_array("list") } else { continue; };
    for c in list.objects() {
        if limit > 0 && converted >= limit { break; }
        let co = c.object(); let name = co.try_get_string("name").unwrap_or_else(|_| co.get_string("id"));
        if !ctl.trim().is_empty() && ctl != "*" && ctl != name && ctl != co.get_string("id") { continue; }
        let r = crate::dev::code::patch_journal::patch_journal("migrate".to_string(), slib.clone(), name.clone(), String::new(), DataObject::new(), 0, dry_run, nn_sessionid.clone());
        let mut item = DataObject::new(); item.put_string("lib", &slib); item.put_string("ctl", &name);
        item.put_string("status", &r.get_string("status"));
        for k in ["msg","journal_id","reason","warning"] { if let Ok(s) = r.try_get_string(k) { if !s.is_empty() { item.put_string(k, &s); } } }
        for k in ["entries","legacy_bytes"] { if let Ok(n) = r.try_get_int(k) { item.put_int(k,n); } }
        for k in ["migrated","already_migrated","legacy_deleted"] { if let Ok(b) = r.try_get_boolean(k) { item.put_boolean(k,b); } }
        if r.get_string("status") != "ok" { failed += 1; }
        else if r.try_get_boolean("skipped").unwrap_or(false) { skipped += 1; }
        else { candidates += 1; entries += r.try_get_int("entries").unwrap_or(0); if r.try_get_boolean("migrated").unwrap_or(false) { converted += 1; } }
        results.push_object(item);
    }
    if limit > 0 && converted >= limit { break; }
}
out.put_array("results", results); out.put_int("candidates", candidates); out.put_int("converted", converted);
out.put_int("entries", entries); out.put_int("skipped", skipped); out.put_int("failed", failed);
out.put_boolean("dry_run", dry_run);
if failed > 0 { out.put_string("msg", "one or more journals failed; inspect results, no failed legacy journal was intentionally removed"); }
out