use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::Instant;
use crate::security::security::init::check_auth;

// ---------------------------------------------------------------------------
// dev.search kernel. One trigram mask per DOCUMENT (a control's name+desc, each
// text facet, each command's searchable text, each text asset), stored in ONE
// flat file per library: runtime/dev/search/<lib>.idx (instance-local).
// A search prunes by mask and then VERIFIES against the live record, so a
// mask can only ever cause a wasted read, never a wrong hit.
//
// File: MAGIC | built_ms u64 | library mask (LIB_WORDS u64) | ndocs u32 | docs
// Doc : kind u8 | ctl, ctl_id, name, id (u16 len + utf8) | hash u64 |
//       words u32 | mask (words u64)          - all little endian.
// Doc masks are a power of two in size (16 bits per distinct trigram, capped),
// so a small record costs tens of bytes instead of a fixed 8 KB.
// ---------------------------------------------------------------------------

pub const MAGIC: &[u8; 8] = b"NBSRCH02";
pub const LIB_WORDS: usize = 16384; // 2^20 bits
pub const MAX_DOC_WORDS: usize = 2048; // 2^17 bits
pub const MAX_ASSET_BYTES: u64 = 2 * 1024 * 1024;
pub const KINDS: [&str; 4] = ["control", "facet", "command", "asset"];

// Structural keys of a control record: never facets (dev.code.read_control_facet's list).
const RESERVED: [&str; 17] = ["data", "three", "cmd", "timer", "event", "name", "desc",
    "groups", "tags", "module", "readers", "writers", "id", "ctl", "db", "lib",
    "attachmentkeynames"];

pub struct Doc {
    pub kind: u8,
    pub ctl: String,
    pub ctl_id: String,
    pub name: String,
    pub id: String,
    pub hash: u64,
    pub mask: Vec<u64>,
}

pub fn fnv(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

// Distinct BYTE trigrams of already-lowercased text, each hashed to 64 bits.
// Bytes, not chars: no slicing inside a UTF-8 sequence is ever needed.
pub fn trigram_hashes(lower: &str) -> Vec<u64> {
    let b = lower.as_bytes();
    let mut codes: Vec<u32> = Vec::new();
    if b.len() >= 3 {
        codes.reserve(b.len() - 2);
        for i in 0..b.len() - 2 {
            codes.push(((b[i] as u32) << 16) | ((b[i + 1] as u32) << 8) | (b[i + 2] as u32));
        }
    }
    codes.sort_unstable();
    codes.dedup();
    codes.into_iter().map(|c| {
        let mut h = (c as u64 + 1).wrapping_mul(0x9E3779B97F4A7C15);
        h ^= h >> 29;
        h = h.wrapping_mul(0xBF58476D1CE4E5B9);
        h ^= h >> 32;
        h
    }).collect()
}

pub fn doc_words(n: usize) -> usize {
    let need = (n * 16 + 63) / 64;
    need.max(4).next_power_of_two().min(MAX_DOC_WORDS)
}

pub fn mask_set(mask: &mut [u64], hashes: &[u64]) {
    let bits = mask.len() * 64;
    for h in hashes {
        let i = (*h as usize) & (bits - 1);
        mask[i >> 6] |= 1u64 << (i & 63);
    }
}

pub fn mask_has_all(mask: &[u64], hashes: &[u64]) -> bool {
    if mask.is_empty() { return hashes.is_empty(); }
    let bits = mask.len() * 64;
    for h in hashes {
        let i = (*h as usize) & (bits - 1);
        if mask[i >> 6] & (1u64 << (i & 63)) == 0 { return false; }
    }
    true
}

pub fn index_dir() -> PathBuf {
    let root = DataStore::new().root;
    let base = match root.parent() { Some(p) => p.to_path_buf(), None => PathBuf::from(".") };
    base.join("runtime").join("dev").join("search")
}

pub fn index_path(lib: &str) -> PathBuf { index_dir().join(format!("{}.idx", lib)) }

// Library ids. A served instance answers from app.app.libs() (the installed
// libraries). A bare process (`newbound exec`) has no system globals, so it
// falls back to the store root's own entries that carry a meta.json - one
// read_dir of the root, never a walk.
pub fn lib_ids() -> Vec<String> {
    let mut v: Vec<String> = Vec::new();
    let got = std::panic::catch_unwind(|| {
        let libs = crate::api::new().app.app.libs();
        let mut ids = Vec::new();
        for i in 0..libs.len() {
            let e = libs.get_property(i);
            let id = if e.is_object() { e.object().get_string("id") } else { e.string() };
            ids.push(id);
        }
        ids
    });
    match got {
        Ok(ids) => v = ids,
        Err(_) => {
            let root = DataStore::new().root;
            if let Ok(entries) = std::fs::read_dir(&root) {
                for entry in entries.flatten() {
                    if entry.path().join("meta.json").exists() {
                        v.push(entry.file_name().to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    v.retain(|id| !id.is_empty() && !id.contains('/') && !id.contains(".."));
    v.sort();
    v.dedup();
    v
}

fn new_doc(kind: u8, ctl: &str, ctl_id: &str, name: &str, id: &str) -> Doc {
    Doc { kind, ctl: ctl.to_string(), ctl_id: ctl_id.to_string(), name: name.to_string(),
          id: id.to_string(), hash: 0, mask: Vec::new() }
}

// A command's searchable text: name, desc, imports, parameter names, source -
// the same haystack dev.code.search_commands has always matched.
pub fn command_text(store: &DataStore, lib: &str, cmd_name: &str, cmd_id: &str) -> Option<String> {
    if !store.exists(lib, cmd_id) { return None; }
    let cmd_data = store.get_data(lib, cmd_id).get_object("data");
    let lang = if cmd_data.has("type") && cmd_data.get_property("type").is_string() {
        cmd_data.get_string("type")
    } else { "rust".to_string() };
    let mut hay = cmd_name.to_string();
    if cmd_data.has(&lang) && cmd_data.get_property(&lang).is_string() {
        let impl_id = cmd_data.get_string(&lang);
        if store.exists(lib, &impl_id) {
            let d = store.get_data(lib, &impl_id).get_object("data");
            if d.has("desc") && d.get_property("desc").is_string() {
                hay.push('\n');
                hay.push_str(&d.get_string("desc"));
            }
            if d.has("import") && d.get_property("import").is_string() {
                hay.push('\n');
                hay.push_str(&d.get_string("import"));
            }
            if d.has("params") && d.get_property("params").is_array() {
                let ps = d.get_array("params");
                for m in 0..ps.len() {
                    let p = ps.get_property(m);
                    if p.is_object() {
                        let p = p.object();
                        if p.has("name") && p.get_property("name").is_string() {
                            hay.push('\n');
                            hay.push_str(&p.get_string("name"));
                        }
                    }
                }
            }
            let ext = if lang == "rust" { "rs".to_string() } else { lang.to_owned() };
            if d.has(&ext) && d.get_property(&ext).is_string() {
                hay.push('\n');
                hay.push_str(&d.get_string(&ext));
            }
        }
    }
    Some(hay)
}

fn impl_id(store: &DataStore, lib: &str, cmd_id: &str) -> Option<String> {
    let d = store.get_data(lib, cmd_id).get_object("data");
    let lang = if d.has("type") && d.get_property("type").is_string() { d.get_string("type") } else { "rust".to_string() };
    if d.has(&lang) && d.get_property(&lang).is_string() { Some(d.get_string(&lang)) } else { None }
}

fn control_docs(lib: &str, cname: &str, cid: &str, ids: &mut Vec<String>) -> Vec<(Doc, String)> {
    let store = DataStore::new();
    let mut out = Vec::new();
    if !store.exists(lib, cid) { return out; }
    ids.push(cid.to_string());
    let d = store.get_data(lib, cid).get_object("data");
    let mut meta = cname.to_string();
    if d.has("desc") && d.get_property("desc").is_string() {
        meta.push('\n');
        meta.push_str(&d.get_string("desc"));
    }
    out.push((new_doc(0, cname, cid, cname, cid), meta));
    let mut facets: Vec<String> = Vec::new();
    for (k, v) in d.objects() {
        if v.is_string() && !RESERVED.contains(&k.as_str()) { facets.push(k); }
    }
    facets.sort();
    for f in facets {
        let t = d.get_string(&f);
        out.push((new_doc(1, cname, cid, &f, cid), t));
    }
    if d.has("cmd") && d.get_property("cmd").is_array() {
        let cmds = d.get_array("cmd");
        for k in 0..cmds.len() {
            let c = cmds.get_property(k);
            if !c.is_object() { continue; }
            let c = c.object();
            if !c.has("name") || !c.has("id") { continue; }
            let n = c.get_string("name");
            let id = c.get_string("id");
            if let Some(t) = command_text(&store, lib, &n, &id) {
                ids.push(id.clone());
                if let Some(i) = impl_id(&store, lib, &id) { ids.push(i); }
                out.push((new_doc(2, cname, cid, &n, &id), t));
            }
        }
    }
    out
}

pub fn asset_names(lib: &str) -> Vec<String> {
    let base = DataStore::new().root.join(lib).join("_ASSETS");
    let mut names = Vec::new();
    if !base.exists() { return names; }
    let mut stack = vec![(base.clone(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if depth < 16 { stack.push((path, depth + 1)); }
                    continue;
                }
                if let Ok(r) = path.strip_prefix(&base) {
                    names.push(r.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }
    names.sort();
    names
}

// Text assets only: bounded size, valid UTF-8, no NUL byte.
pub fn asset_text(lib: &str, name: &str) -> Option<String> {
    if name.starts_with('/') || name.split('/').any(|s| s == "..") { return None; }
    let path = DataStore::new().root.join(lib).join("_ASSETS").join(name);
    let md = std::fs::metadata(&path).ok()?;
    if !md.is_file() || md.len() > MAX_ASSET_BYTES { return None; }
    let bytes = std::fs::read(&path).ok()?;
    if bytes.contains(&0u8) { return None; }
    String::from_utf8(bytes).ok()
}

// Every document of a library with its text, in a stable order.
pub fn collect(lib: &str) -> Vec<(Doc, String)> {
    let mut ids: Vec<String> = Vec::new();
    collect_ids(lib, &mut ids)
}

// collect, also naming every record id the documents were read from (the
// records whose files the freshness fingerprint watches).
pub fn collect_ids(lib: &str, ids: &mut Vec<String>) -> Vec<(Doc, String)> {
    let store = DataStore::new();
    let mut out = Vec::new();
    if store.exists(lib, "controls") {
        ids.push("controls".to_string());
        let got = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let mut pairs: Vec<(String, String)> = Vec::new();
            let ctls = store.get_data(lib, "controls").get_object("data");
            if ctls.has("list") && ctls.get_property("list").is_array() {
                let list = ctls.get_array("list");
                for j in 0..list.len() {
                    let item = list.get_property(j);
                    if !item.is_object() { continue; }
                    let item = item.object();
                    if item.has("name") && item.has("id") {
                        pairs.push((item.get_string("name"), item.get_string("id")));
                    }
                }
            }
            pairs
        }));
        if let Ok(pairs) = got {
            for (cname, cid) in pairs {
                // One unreadable control must not cost the library its index.
                let mut got: Vec<String> = Vec::new();
                let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| control_docs(lib, &cname, &cid, &mut got)));
                if let Ok(mut v) = r { out.append(&mut v); ids.append(&mut got); } else { ids.push(cid.clone()); }
            }
        }
    }
    for name in asset_names(lib) {
        if let Some(t) = asset_text(lib, &name) {
            out.push((new_doc(3, "", "", &name, ""), t));
        }
    }
    out
}

// The CURRENT text of an indexed document (what verification reads).
pub fn doc_text(store: &DataStore, lib: &str, d: &Doc) -> Option<String> {
    match d.kind {
        0 => {
            if !store.exists(lib, &d.ctl_id) { return None; }
            let c = store.get_data(lib, &d.ctl_id).get_object("data");
            let mut meta = d.ctl.clone();
            if c.has("desc") && c.get_property("desc").is_string() {
                meta.push('\n');
                meta.push_str(&c.get_string("desc"));
            }
            Some(meta)
        }
        1 => {
            if !store.exists(lib, &d.ctl_id) { return None; }
            let c = store.get_data(lib, &d.ctl_id).get_object("data");
            if c.has(&d.name) && c.get_property(&d.name).is_string() { Some(c.get_string(&d.name)) } else { None }
        }
        2 => command_text(store, lib, &d.name, &d.id),
        3 => asset_text(lib, &d.name),
        _ => None,
    }
}

fn put_str(buf: &mut Vec<u8>, s: &str) {
    buf.extend_from_slice(&(s.len() as u16).to_le_bytes());
    buf.extend_from_slice(s.as_bytes());
}

// Rebuild one library's index file. Ok((docs, bytes, ms)).
pub fn build(lib: &str) -> Result<(usize, usize, i64), String> {
    let t0 = Instant::now();
    if lib.is_empty() || lib.contains('/') || lib.contains("..") { return Err(format!("bad library name '{}'", lib)); }
    if !DataStore::new().root.join(lib).exists() { return Err(format!("library '{}' not found", lib)); }
    let start_ns = now_ns();
    let mut ids: Vec<String> = Vec::new();
    let pairs = collect_ids(lib, &mut ids);
    let mut libmask = vec![0u64; LIB_WORDS];
    let mut body: Vec<u8> = Vec::new();
    let mut n: u32 = 0;
    for (mut d, text) in pairs {
        if d.ctl.len() > 65535 || d.ctl_id.len() > 65535 || d.name.len() > 65535 || d.id.len() > 65535 { continue; }
        let hs = trigram_hashes(&text.to_lowercase());
        d.hash = fnv(&text);
        d.mask = vec![0u64; doc_words(hs.len())];
        mask_set(&mut d.mask, &hs);
        mask_set(&mut libmask, &hs);
        body.push(d.kind);
        put_str(&mut body, &d.ctl);
        put_str(&mut body, &d.ctl_id);
        put_str(&mut body, &d.name);
        put_str(&mut body, &d.id);
        body.extend_from_slice(&d.hash.to_le_bytes());
        body.extend_from_slice(&(d.mask.len() as u32).to_le_bytes());
        for w in &d.mask { body.extend_from_slice(&w.to_le_bytes()); }
        n += 1;
    }
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .map(|x| x.as_millis() as u64).unwrap_or(0);
    let mut watch = watch_paths(lib, &ids);
    watch.retain(|w| w.len() <= 65535);
    let (mut fp, newest) = fingerprint(lib, &watch);
    // A file written while (or just before) it was read: not trusted, so the
    // next freshness check rebuilds.
    if newest + 50_000_000 >= start_ns { fp = 0; }
    let mut file: Vec<u8> = Vec::with_capacity(32 + LIB_WORDS * 8 + body.len());
    file.extend_from_slice(MAGIC);
    file.extend_from_slice(&now.to_le_bytes());
    file.extend_from_slice(&fp.to_le_bytes());
    file.extend_from_slice(&n.to_le_bytes());
    for w in &libmask { file.extend_from_slice(&w.to_le_bytes()); }
    file.extend_from_slice(&(watch.len() as u32).to_le_bytes());
    for w in &watch { put_str(&mut file, w); }
    file.extend_from_slice(&body);
    let dir = index_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {}", dir.display(), e))?;
    let tmp = dir.join(format!("{}.idx.tmp{}-{}", lib, std::process::id(), now_ns()));
    {
        let mut f = std::fs::File::create(&tmp).map_err(|e| format!("cannot write {}: {}", tmp.display(), e))?;
        f.write_all(&file).map_err(|e| format!("cannot write {}: {}", tmp.display(), e))?;
    }
    std::fs::rename(&tmp, index_path(lib)).map_err(|e| format!("cannot place index for {}: {}", lib, e))?;
    Ok((n as usize, file.len(), t0.elapsed().as_millis() as i64))
}

// Header only: (built_ms, ndocs, file bytes). None = no usable index.
pub fn header(lib: &str) -> Option<(u64, u32, u64)> {
    let p = index_path(lib);
    let len = std::fs::metadata(&p).ok()?.len();
    let mut f = std::fs::File::open(&p).ok()?;
    let mut head = vec![0u8; 28];
    f.read_exact(&mut head).ok()?;
    if &head[0..8] != MAGIC { return None; }
    let built = u64::from_le_bytes(head[8..16].try_into().ok()?);
    let n = u32::from_le_bytes(head[24..28].try_into().ok()?);
    Some((built, n, len))
}

// ---------------------------------------------------------------------------
// Freshness. The index remembers WHICH FILES it was built from (every record
// file and its id-prefixed attachment siblings, relative to data/<lib>) and a
// fingerprint of their (mtime, size) plus every asset's. A query re-stats
// them - no record is read - and rebuilds the library when anything moved.
// This sees every writer alike: dev.code commands (journaled or not), git
// pulls, another process, a hand edit.
// ---------------------------------------------------------------------------

pub const FRESH_MS: u64 = 2000; // a library is re-checked at most this often
static CHECKED: std::sync::Mutex<Vec<(String, u64)>> = std::sync::Mutex::new(Vec::new());

pub fn now_ns() -> u128 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0)
}

fn mtime_len(p: &std::path::Path) -> (u128, u64) {
    match std::fs::metadata(p) {
        Ok(m) => (m.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_nanos()).unwrap_or(0), m.len()),
        Err(_) => (0, 0),
    }
}

pub fn watch_paths(lib: &str, ids: &[String]) -> Vec<String> {
    let store = DataStore::new();
    let base = store.root.join(lib);
    let mut v: Vec<String> = Vec::new();
    for id in ids {
        let f = store.get_data_file(lib, id);
        let dir = match f.parent() { Some(d) => d.to_path_buf(), None => continue };
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for e in entries.flatten() {
                let n = e.file_name().to_string_lossy().to_string();
                if !n.starts_with(id.as_str()) { continue; }
                let p = e.path();
                match p.strip_prefix(&base) {
                    Ok(r) => v.push(r.to_string_lossy().to_string()),
                    Err(_) => v.push(p.to_string_lossy().to_string()),
                }
            }
        }
    }
    v.sort();
    v.dedup();
    v
}

fn eat(h: &mut u64, s: &str) {
    for b in s.as_bytes() {
        *h ^= *b as u64;
        *h = h.wrapping_mul(0x100000001b3);
    }
}

// (fingerprint, newest mtime in ns) over the watched files and every asset.
pub fn fingerprint(lib: &str, watch: &[String]) -> (u64, u128) {
    let base = DataStore::new().root.join(lib);
    let mut h: u64 = 0xcbf29ce484222325;
    let mut newest = 0u128;
    for w in watch {
        let (m, l) = mtime_len(&base.join(w));
        if m > newest { newest = m; }
        eat(&mut h, &format!("W {} {} {}\n", w, m, l));
    }
    let ab = base.join("_ASSETS");
    for a in asset_names(lib) {
        let (m, l) = mtime_len(&ab.join(&a));
        if m > newest { newest = m; }
        eat(&mut h, &format!("A {} {} {}\n", a, m, l));
    }
    (h, newest)
}

// The stored fingerprint and watch list. None = no usable index.
pub fn read_watch(lib: &str) -> Option<(u64, Vec<String>)> {
    use std::io::Seek;
    let mut f = std::fs::File::open(index_path(lib)).ok()?;
    let mut head = vec![0u8; 28];
    f.read_exact(&mut head).ok()?;
    if &head[0..8] != MAGIC { return None; }
    let fp = u64::from_le_bytes(head[16..24].try_into().ok()?);
    f.seek(std::io::SeekFrom::Current((LIB_WORDS * 8) as i64)).ok()?;
    let mut r = std::io::BufReader::new(f);
    let mut nb = [0u8; 4];
    r.read_exact(&mut nb).ok()?;
    let n = u32::from_le_bytes(nb) as usize;
    let mut v = Vec::with_capacity(n.min(100000));
    for _ in 0..n {
        let mut lb = [0u8; 2];
        r.read_exact(&mut lb).ok()?;
        let mut s = vec![0u8; u16::from_le_bytes(lb) as usize];
        r.read_exact(&mut s).ok()?;
        v.push(String::from_utf8(s).ok()?);
    }
    Some((fp, v))
}

// Does the index still describe the files on disk? Stats only.
pub fn is_fresh(lib: &str) -> bool {
    match read_watch(lib) {
        Some((fp, w)) => fp != 0 && fingerprint(lib, &w).0 == fp,
        None => false,
    }
}

// Rebuild the library's index when it is missing or stale. true = rebuilt.
// Checked at most once per FRESH_MS per library in this process.
pub fn ensure_fresh(lib: &str) -> bool {
    let now = (now_ns() / 1_000_000) as u64;
    {
        let mut g = match CHECKED.lock() { Ok(g) => g, Err(p) => p.into_inner() };
        match g.iter_mut().find(|e| e.0 == lib) {
            Some(e) => {
                if now.saturating_sub(e.1) < FRESH_MS && index_path(lib).exists() { return false; }
                e.1 = now;
            }
            None => g.push((lib.to_string(), now)),
        }
    }
    if is_fresh(lib) { return false; }
    build(lib).is_ok()
}

fn take<'a>(b: &'a [u8], pos: &mut usize, n: usize) -> Option<&'a [u8]> {
    if *pos + n > b.len() { return None; }
    let s = &b[*pos..*pos + n];
    *pos += n;
    Some(s)
}

fn take_str(b: &[u8], pos: &mut usize) -> Option<String> {
    let l = take(b, pos, 2)?;
    let n = u16::from_le_bytes([l[0], l[1]]) as usize;
    let s = take(b, pos, n)?;
    String::from_utf8(s.to_vec()).ok()
}

// Load a library's index for a query. None = missing or unreadable (caller
// builds). Some((true, [])) = the library mask rules the query out, and only
// the header was read.
pub fn load(lib: &str, hashes: &[u64]) -> Option<(bool, Vec<Doc>)> {
    let mut f = std::fs::File::open(index_path(lib)).ok()?;
    let mut head = vec![0u8; 28 + LIB_WORDS * 8];
    f.read_exact(&mut head).ok()?;
    if &head[0..8] != MAGIC { return None; }
    let bits = LIB_WORDS * 64;
    for h in hashes {
        let i = (*h as usize) & (bits - 1);
        let o = 28 + (i >> 6) * 8;
        let w = u64::from_le_bytes(head[o..o + 8].try_into().ok()?);
        if w & (1u64 << (i & 63)) == 0 { return Some((true, Vec::new())); }
    }
    let mut b: Vec<u8> = Vec::new();
    f.read_to_end(&mut b).ok()?;
    let mut pos = 0usize;
    let n = u32::from_le_bytes(head[24..28].try_into().ok()?) as usize;
    let wn = take(&b, &mut pos, 4)?;
    let nw = u32::from_le_bytes([wn[0], wn[1], wn[2], wn[3]]) as usize;
    for _ in 0..nw {
        let l = take(&b, &mut pos, 2)?;
        let k = u16::from_le_bytes([l[0], l[1]]) as usize;
        take(&b, &mut pos, k)?;
    }
    let mut docs = Vec::with_capacity(n.min(100000));
    for _ in 0..n {
        let kind = take(&b, &mut pos, 1)?[0];
        let ctl = take_str(&b, &mut pos)?;
        let ctl_id = take_str(&b, &mut pos)?;
        let name = take_str(&b, &mut pos)?;
        let id = take_str(&b, &mut pos)?;
        let hb = take(&b, &mut pos, 8)?;
        let hash = u64::from_le_bytes(hb.try_into().ok()?);
        let wb = take(&b, &mut pos, 4)?;
        let words = u32::from_le_bytes([wb[0], wb[1], wb[2], wb[3]]) as usize;
        if words > MAX_DOC_WORDS { return None; }
        let mb = take(&b, &mut pos, words * 8)?;
        let mut mask = Vec::with_capacity(words);
        for k in 0..words {
            mask.push(u64::from_le_bytes(mb[k * 8..k * 8 + 8].try_into().ok()?));
        }
        docs.push(Doc { kind, ctl, ctl_id, name, id, hash, mask });
    }
    Some((false, docs))
}

fn preview(text: &str, needle: &str) -> (i64, String) {
    let mut first = 0i64;
    let mut p = String::new();
    let mut shown = 0;
    for (i, line) in text.lines().enumerate() {
        if line.to_lowercase().contains(needle) {
            if shown == 0 { first = (i + 1) as i64; }
            let t: String = line.trim().chars().take(200).collect();
            p.push_str(&t);
            p.push('\n');
            shown += 1;
            if shown >= 3 { break; }
        }
    }
    (first, p)
}

fn fail(msg: &str) -> DataObject {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", msg);
    o
}

// THE search. query is ONE case-insensitive substring (spaces included).
// lib / ctl: "" or "*" = all. kinds: comma-separated subset of KINDS, "" = all.
// session: Some(id) filters every hit by the reader check app.app.read
// applies (security.check_auth) to the record it lives in; None is for
// in-crate callers whose own command gate already admitted the asker.
pub fn search(lib: &str, ctl: &str, kinds: &str, query: &str, limit: i64, session: Option<&str>) -> DataObject {
    let t0 = Instant::now();
    let needle = query.to_lowercase();
    if needle.trim().is_empty() { return fail("query is empty"); }
    let hashes = trigram_hashes(&needle);
    let mut want: Vec<u8> = Vec::new();
    for k in kinds.split(',') {
        let k = k.trim().to_lowercase();
        if k.is_empty() { continue; }
        match KINDS.iter().position(|x| *x == k) {
            Some(i) => want.push(i as u8),
            None => return fail(&format!("unknown kind '{}' (expected: control, facet, command, asset)", k)),
        }
    }
    if want.is_empty() { want = vec![0, 1, 2, 3]; }
    let limit = if limit <= 0 { 50usize } else { limit as usize };
    let all_libs = lib.is_empty() || lib == "*";
    let all_ctls = ctl.is_empty() || ctl == "*";
    let store = DataStore::new();
    // Absent in a bare process (no booted system): a session-filtered search
    // then finds nothing, which is the safe answer.
    let globals = DataStore::globals();
    let libraries = if globals.has("system") && globals.get_object("system").has("libraries") {
        Some(globals.get_object("system").get_object("libraries"))
    } else { None };

    let mut matches = DataArray::new();
    let mut count = 0usize;
    let mut searched = 0i64;
    let mut pruned = 0i64;
    let mut built = 0i64;
    let mut candidates = 0i64;
    let mut denied = 0i64;

    for l in lib_ids() {
        if !all_libs && l != lib { continue; }
        if session.is_some() {
            match &libraries {
                Some(ls) => { if !ls.has(&l) { continue; } }
                None => continue,
            }
        }
        // Missing or stale (a watched file moved): rebuilt before it is trusted.
        if ensure_fresh(&l) { built += 1; }
        let loaded = match load(&l, &hashes) { Some(x) => x, None => continue };
        searched += 1;
        if loaded.0 { pruned += 1; continue; }
        let mut auth: std::collections::HashMap<String, bool> = std::collections::HashMap::new();
        for d in loaded.1.iter() {
            if !want.contains(&d.kind) { continue; }
            if !all_ctls && d.ctl != ctl { continue; }
            if !mask_has_all(&d.mask, &hashes) { continue; }
            candidates += 1;
            if let Some(sid) = session {
                // Assets are served to anyone by app.app.asset; records are not.
                if d.kind != 3 {
                    let rid = if d.kind == 2 { d.id.clone() } else { d.ctl_id.clone() };
                    let ok = match auth.get(&rid) {
                        Some(b) => *b,
                        None => {
                            let b = std::panic::catch_unwind(|| check_auth(&l, &rid, sid, false)).unwrap_or(false);
                            auth.insert(rid.clone(), b);
                            b
                        }
                    };
                    if !ok { denied += 1; continue; }
                }
            }
            let text = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| doc_text(&store, &l, d))) {
                Ok(Some(t)) => t,
                _ => continue,
            };
            if !text.to_lowercase().contains(&needle) { continue; }
            count += 1;
            if count > limit { continue; }
            let (line, prev) = preview(&text, &needle);
            let mut m = DataObject::new();
            m.put_string("lib", &l);
            m.put_string("kind", KINDS[d.kind as usize]);
            m.put_string("ctl", &d.ctl);
            m.put_string("name", &d.name);
            match d.kind {
                1 => m.put_string("facet", &d.name),
                2 => m.put_string("cmd", &d.name),
                3 => m.put_string("asset", &d.name),
                _ => {}
            }
            m.put_int("line", line);
            m.put_string("preview", &prev);
            m.put_boolean("changed_since_index", fnv(&text) != d.hash);
            matches.push_object(m);
        }
    }

    let mut o = DataObject::new();
    o.put_string("status", "ok");
    o.put_string("query", query);
    o.put_int("count", count as i64);
    o.put_boolean("truncated", count > limit);
    o.put_boolean("pruned_by_mask", !hashes.is_empty());
    o.put_int("libraries_searched", searched);
    o.put_int("libraries_ruled_out", pruned);
    o.put_int("indexes_built", built);
    o.put_int("candidates", candidates);
    o.put_int("denied", denied);
    o.put_int("ms", t0.elapsed().as_millis() as i64);
    o.put_array("matches", matches);
    o
}

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib"] {
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
        index(arg_0)
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

pub fn index(lib: String) -> DataObject {
let all = lib.is_empty() || lib == "*";
let mut arr = DataArray::new();
let mut found = false;
let mut failed = 0i64;
for l in lib_ids() {
    if !all && l != lib { continue; }
    found = true;
    let mut r = DataObject::new();
    r.put_string("lib", &l);
    match build(&l) {
        Ok((docs, bytes, ms)) => {
            r.put_int("docs", docs as i64);
            r.put_int("bytes", bytes as i64);
            r.put_int("ms", ms);
        }
        Err(e) => {
            failed += 1;
            r.put_string("error", &e);
        }
    }
    arr.push_object(r);
}
let mut o = DataObject::new();
if !found {
    o.put_string("status", "err");
    o.put_string("msg", &format!("library '{}' not found", lib));
    return o;
}
o.put_string("status", if failed == 0 { "ok" } else { "err" });
if failed > 0 { o.put_string("msg", &format!("{} library index(es) failed", failed)); }
o.put_string("dir", &index_dir().to_string_lossy());
o.put_array("libraries", arr);
o
}
