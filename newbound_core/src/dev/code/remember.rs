use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use ndata::data::Data;
use ndata::dataarray::DataArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "domain", "entry", "author"] {
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
        let arg_0: String = o.get_string("lib");
        let arg_1: String = o.get_string("domain");
        let arg_2: DataObject = o.get_object("entry");
        let arg_3: String = o.get_string("author");
        remember(arg_0, arg_1, arg_2, arg_3)
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

pub fn remember(lib: String, domain: String, entry: DataObject, author: String) -> DataObject {
// remember - append ONE validated entry to a memory domain (docs/memory.md).
// The agent's write path: the semantic operation is "append this object",
// so the text surgery lives HERE, not in the model. Validates shape (claim
// required and atomic; known fields typed; the confidence vocabulary),
// stamps `time` when absent, and AUTO-STAMPS a facet-pointer source's hash
// by reading the referent at write time - the staleness mechanism needs no
// discipline from the caller. Parses the whole facet and refuses to touch
// a malformed one, so a fumbled prior write can never be compounded here.
// Journaled like every facet write, label "memory: <claim>". The
// serializer is canonical (2-space, fixed field order, extras sorted) -
// the FIRST remember on a hand- or script-seeded domain may reorder old
// entries' fields once; byte-stable after that.
fn esc(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}
fn val(d: Data, ind: usize) -> String {
    match d {
        Data::DString(s) => format!("\"{}\"", esc(&s)),
        Data::DInt(i) => format!("{}", i),
        Data::DFloat(f) => format!("{}", f),
        Data::DBoolean(b) => format!("{}", b),
        Data::DNull => "null".to_string(),
        Data::DObject(r) => obj(DataObject::get(r), ind),
        Data::DArray(r) => {
            let a = DataArray::get(r);
            if a.len() == 0 { return "[]".to_string(); }
            let pad = "  ".repeat(ind + 1);
            let mut out = String::from("[");
            for i in 0..a.len() {
                if i > 0 { out.push(','); }
                out.push_str(&format!("\n{}{}", pad, val(a.get_property(i), ind + 1)));
            }
            out.push_str(&format!("\n{}]", "  ".repeat(ind)));
            out
        }
        _ => "null".to_string(),
    }
}
fn obj(o: DataObject, ind: usize) -> String {
    // Canonical field order: the entry shape first, then pointer fields,
    // then anything else sorted - hash-backed ndata loses file order, so
    // a fixed order is what makes rewrites diff cleanly.
    let canon = ["claim", "detail", "tags", "source", "confidence", "time",
                 "lib", "ctl", "facet", "hash", "doc"];
    let mut keys: Vec<String> = canon.iter().filter(|k| o.has(k)).map(|s| s.to_string()).collect();
    let mut extra: Vec<String> = o.get_keys().into_iter()
        .filter(|k| !canon.contains(&k.as_str())).collect();
    extra.sort();
    keys.extend(extra);
    if keys.is_empty() { return "{}".to_string(); }
    let pad = "  ".repeat(ind + 1);
    let mut out = String::from("{");
    let mut first = true;
    for k in &keys {
        if !first { out.push(','); }
        first = false;
        out.push_str(&format!("\n{}\"{}\": {}", pad, esc(k), val(o.get_property(k), ind + 1)));
    }
    out.push_str(&format!("\n{}}}", "  ".repeat(ind)));
    out
}
fn content_hash(s: &str) -> String {
    // FNV-1a over the \r-normalized source - MUST stay in sync with
    // read_control_facet/patch_control_facet.
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}
fn err(msg: String) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &msg);
    o
}

let mut entry = entry;

// ── validate the entry shape ────────────────────────────────────────────
if !entry.has("claim") {
    return err("entry.claim is required - one atomic, recallable sentence".to_string());
}
let claim = match entry.try_get_string("claim") {
    Ok(c) => c.trim().to_string(),
    Err(_) => return err("entry.claim must be a string".to_string()),
};
if claim.is_empty() {
    return err("entry.claim must not be empty".to_string());
}
entry.put_string("claim", &claim);
for k in ["detail", "tags", "confidence"] {
    if entry.has(k) && entry.try_get_string(k).is_err() {
        return err(format!("entry.{} must be a string", k));
    }
}
if entry.has("confidence") {
    let c = entry.get_string("confidence");
    if !["high", "medium", "low"].contains(&c.as_str()) {
        return err(format!("entry.confidence must be high, medium, or low (got '{}')", c));
    }
}
if entry.has("time") {
    if entry.try_get_int("time").is_err() {
        return err("entry.time must be an integer (epoch ms) - omit it to have it stamped".to_string());
    }
} else {
    entry.put_int("time", time());
}

// ── the source pointer: validate, and auto-stamp a facet pointer ────────
let mut stamped = false;
if entry.has("source") {
    let mut src = match entry.try_get_object("source") {
        Ok(s) => s,
        Err(_) => return err("entry.source must be an object ({lib, ctl, facet} or {doc})".to_string()),
    };
    let is_ptr = src.has("lib") && src.has("ctl") && src.has("facet");
    if !is_ptr && !src.has("doc") {
        return err("entry.source must carry lib+ctl+facet (a store pointer) or doc".to_string());
    }
    if is_ptr {
        let slib = src.get_string("lib");
        let sctl = src.get_string("ctl");
        let sfacet = src.get_string("facet");
        let api = crate::api::new();
        let sid = api.dev.editcontrol.lookup_id(slib.clone(), sctl.clone());
        let sstore = DataStore::new();
        if !sstore.exists(&slib, &sid) {
            return err(format!("source points at {}.{}, which does not exist", slib, sctl));
        }
        let sdata = sstore.get_data(&slib, &sid).get_object("data");
        if !sdata.has(&sfacet) {
            return err(format!("source points at {}.{} facet '{}', which does not exist", slib, sctl, sfacet));
        }
        if !src.has("hash") || src.get_string("hash").trim().is_empty() {
            let content = sdata.get_string(&sfacet).replace("\r", "");
            src.put_string("hash", &content_hash(&content));
            stamped = true;
        }
        entry.put_object("source", src);
    }
}

// ── the target domain ───────────────────────────────────────────────────
let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), domain.clone());
let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    return err(format!("Domain control '{}' not found in library '{}'", domain, lib));
}
let mut record = store.get_data(&lib, &ctlid);
let mut data_obj = record.get_object("data");
let old_source = if data_obj.has("memory") {
    data_obj.get_string("memory").replace("\r", "")
} else {
    String::new()
};
let arr = if old_source.trim().is_empty() {
    DataArray::new()
} else {
    // No DataArray::try_from_string exists - wrap in an object for a clean
    // Result instead of a panic on a malformed facet.
    match DataObject::try_from_string(&format!("{{\"a\":{}}}", old_source)) {
        Ok(w) => match w.try_get_array("a") {
            Ok(a) => a,
            Err(_) => return err(format!("{}.{}'s memory facet is not a JSON ARRAY - fix it before appending", lib, domain)),
        },
        Err(_) => return err(format!("{}.{}'s memory facet is not valid JSON - fix it before appending; it is refused, never clobbered", lib, domain)),
    }
};
let mut arr = arr;
// Exact-claim dedupe (the archivist writes autonomously - a cheap guard
// against the most common duplication; semantic dedupe stays prompt-level).
for i in 0..arr.len() {
    if let Ok(e) = arr.try_get_object(i) {
        if e.has("claim") && e.get_string("claim").trim() == claim {
            return err(format!("an entry with this exact claim already exists in {}.{}", lib, domain));
        }
    }
}
arr.push_object(entry);
let new_source = val(Data::DArray(arr.data_ref), 0) + "\n";

// ── write the facet (attachment key ensured, the patch commands' way) ───
data_obj.put_string("memory", &new_source);
let mut keys = if data_obj.has("attachmentkeynames") {
    data_obj.get_array("attachmentkeynames")
} else {
    DataArray::new()
};
let mut hasit = false;
for i in 0..keys.len() {
    if let Data::DString(s) = keys.get_property(i) {
        if s == "memory" { hasit = true; break; }
    }
}
if !hasit { keys.push_string("memory"); }
data_obj.put_array("attachmentkeynames", keys);
record.put_object("data", data_obj);
record.put_int("time", time());
store.set_data(&lib, &ctlid, record);

// ── journal, the shared _patches shape ──────────────────────────────────
let mut label = format!("memory: {}", claim);
if label.chars().count() > 72 {
    label = label.chars().take(69).collect::<String>() + "...";
}
let jid = format!("{}_patches", ctlid);
let mut jrec;
let mut jdata;
let mut jlist;
if store.exists(&lib, &jid) {
    jrec = store.get_data(&lib, &jid);
    jdata = jrec.get_object("data");
    jlist = if jdata.has("list") { jdata.get_array("list") } else { DataArray::new() };
} else {
    jrec = DataObject::new();
    jrec.put_string("id", &jid);
    jrec.put_string("username", "system");
    jrec.put_array("readers", DataArray::new());
    jrec.put_array("writers", DataArray::new());
    jdata = DataObject::new();
    jlist = DataArray::new();
}
let patch_id = format!("p{}", jlist.len() + 1);
let mut jentry = DataObject::new();
jentry.put_string("patch_id", &patch_id);
jentry.put_string("author", &author);
jentry.put_string("facet", "memory");
jentry.put_string("cmd", "");
jentry.put_string("old", &old_source);
jentry.put_string("new", &new_source);
jentry.put_int("time", time());
jentry.put_string("label", &label);
jlist.push_object(jentry);
jdata.put_array("list", jlist);
jrec.put_object("data", jdata);
jrec.put_int("time", time());
store.set_data(&lib, &jid, jrec);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("domain", &domain);
o.put_string("claim", &claim);
o.put_boolean("stamped", stamped);
o.put_int("entries", arr.len() as i64);
o.put_string("patch_id", &patch_id);
o

}
