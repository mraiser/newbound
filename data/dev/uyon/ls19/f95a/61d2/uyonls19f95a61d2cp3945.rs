// An empty author defaults to the calling session's user — the platform
// injects nn_sessionid into params on every web call (HTTP and websocket
// alike); CLI/MCP callers that want a specific provenance name pass author.
let author = {
    let a = author.trim().to_string();
    if !a.is_empty() { a } else {
        let mut who = String::new();
        if !nn_sessionid.is_empty() {
            let system = flowlang::datastore::DataStore::globals().get_object("system");
            if system.has("sessions") {
                let sessions = system.get_object("sessions");
                if sessions.has(&nn_sessionid) {
                    let session = sessions.get_object(&nn_sessionid);
                    if session.has("user") {
                        who = session.get_object("user").try_get_string("displayname").unwrap_or_default();
                    }
                    if who.trim().is_empty() {
                        who = session.try_get_string("username").unwrap_or_default();
                    }
                }
            }
        }
        if who.trim().is_empty() { "anonymous".to_string() } else { who }
    }
};

// Facet-agnostic (the owner's rule, 2026-08-10): a facet is any named
// text on a control record. Only the record's STRUCTURAL keys are
// refused - the platform enforces no vocabulary of facet names and no
// facet schema; what a facet means is its author's business.
let reserved = ["data", "three", "cmd", "timer", "event", "name", "desc",
    "groups", "tags", "module", "readers", "writers", "id", "ctl", "db",
    "lib", "attachmentkeynames"];
if facet.trim().is_empty() || reserved.contains(&facet.as_str()) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("'{}' is a structural key on control records, not a facet.", facet));
    return o;
}

let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
// One process-wide journal transaction. Validate the current record and base
// under the same lock used for the facet and journal writes.
let _journal_guard = crate::dev::code::journal_storage::lock();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

// FNV-1a over the \r-normalized source; must stay in sync with read_control_facet.
fn content_hash(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

let mut record = match std::panic::catch_unwind(|| store.get_data(&lib, &ctlid)) {
    Ok(r) => r,
    Err(_) => {
        let mut o = DataObject::new(); o.put_string("status", "err");
        o.put_string("kind", "corrupt_record");
        o.put_string("msg", &format!("control record {}:{} is unreadable; no facet or journal was written", lib, ctlid));
        return o;
    }
};
let mut data_obj = record.get_object("data");

// Normalize line endings to avoid strict matching failures caused by \r\n vs \n
let current = if data_obj.has(&facet) { data_obj.get_string(&facet).replace("\r", "") } else { String::new() };
let current_hash = content_hash(&current);

// Optional concurrency token: reject when the caller's base no longer matches.
if !base.is_empty() && base != current_hash {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "stale_base");
    o.put_string("current_hash", &current_hash);
    return o;
}

let old_n = old_snippet.replace("\r", "");
let new_n = new_snippet.replace("\r", "");

let journal_old;
let new_code;
if old_n.is_empty() {
    if new_n.is_empty() {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", "Nothing to do: old_snippet and new_snippet are both empty.");
        return o;
    }
    // Empty old_snippet: create or replace the whole facet (covers the
    // facet-absent case and initial authoring). The journal keeps the prior
    // source so the patch stays invertible.
    journal_old = current.clone();
    new_code = new_n.clone();
} else {
    let count = current.matches(&old_n).count();
    if count == 0 {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", "Snippet not found. Call `read_control_facet` to view the exact current source and try again. The snippet must match exactly, including whitespace and indentation.");
        return o;
    }
    if count > 1 {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Snippet is ambiguous: it matches {} times. Provide a longer snippet that matches exactly once. No change was made.", count));
        return o;
    }
    journal_old = old_n.clone();
    new_code = current.replacen(&old_n, &new_n, 1);
}

// Facets are attachment fields (attachmentkeynames); create the key rather
// than failing when the facet doesn't exist on the record yet.
let mut keys = if data_obj.has("attachmentkeynames") {
    data_obj.get_array("attachmentkeynames")
} else {
    DataArray::new()
};
let mut listed = false;
for k in keys.objects() {
    if k.string() == facet { listed = true; }
}
if !listed { keys.push_string(&facet); }
data_obj.put_array("attachmentkeynames", keys);

data_obj.put_string(&facet, &new_code);
record.put_object("data", data_obj);
record.put_int("time", time());
if let Err(e) = crate::dev::code::journal_storage::write_record(&store, &lib, &ctlid, &record) {
    let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("kind", "write_failed");
    o.put_string("msg", &format!("facet write failed before journal append: {}", e)); return o;
}

// Plan patches are independent records: one board change never rewrites the
// entire prior journal. Generic controls retain their legacy journal shape.
let patch_id = match crate::dev::code::journal_storage::append(&store, &lib, &ctlid, &facet, journal_old, new_n, label, author) {
    Ok(id) => id,
    Err(e) => {
        let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("kind", "journal_write_failed");
        o.put_string("msg", &format!("facet was written but journal append failed: {}", e));
        o.put_boolean("facet_written", true); return o;
    }
};

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("ok", true);
o.put_string("patch_id", &patch_id);
o.put_string("hash", &content_hash(&new_code));
o