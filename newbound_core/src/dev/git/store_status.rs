use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;
use ndata::data::Data;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["repo"] {
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
        let arg_0: String = o.get_string("repo");
        store_status(arg_0)
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

pub fn store_status(repo: String) -> DataObject {
// Store-aware status (the path->store resolver, read side): porcelain
// status via dev.git.read, then every data/<lib>/ path translated into its
// store identity (control, facet, command record, typed impl, _patches
// journal, controls index, asset) and grouped by unit (lib.control).
// Generated sources under newbound_core/src/<lib>/<ctl>/ join their unit.
// Deleted store paths resolve through HEAD - the live store no longer
// knows them. Untracked noise outside the store collapses to counts.
fn shard_dir(root: &std::path::Path, lib: &str, id: &str) -> std::path::PathBuf {
    let mut s = id.to_string();
    while s.len() < 16 { s.push('_'); }
    root.join(lib).join(&s[0..4]).join(&s[4..8]).join(&s[8..12]).join(&s[12..16])
}
fn head_name(repo: &str, relpath: &str) -> String {
    let mut a = DataArray::new();
    a.push_string(&format!("HEAD:{}", relpath));
    let r = crate::dev::git::read::read(repo.to_string(), "show".to_string(), a);
    if r.get_string("status") != "ok" { return String::new(); }
    match DataObject::try_from_string(&r.get_string("out")) {
        Ok(o) => {
            if o.has("data") {
                if let Ok(d) = o.try_get_object("data") {
                    if let Ok(n) = d.try_get_string("name") { return n; }
                }
            }
            o.try_get_string("name").unwrap_or_default()
        }
        Err(_) => String::new(),
    }
}
fn build_map(lib: &str, labels: &mut DataObject, units: &mut DataObject) {
    let store = DataStore::new();
    let idx = store.root.join(lib).join("cont").join("rols").join("____").join("____").join("controls");
    if !idx.exists() { return; }
    labels.put_string(&format!("{}/controls", lib), "controls index");
    units.put_string(&format!("{}/controls", lib), lib);
    let d = store.get_data(lib, "controls").get_object("data");
    let list = if let Ok(a) = d.try_get_array("controls") { a }
        else if let Ok(a) = d.try_get_array("list") { a }
        else { return; };
    for c in list.objects() {
        let co = match c.clone() { Data::DObject(_) => c.object(), _ => continue };
        let cid = match co.try_get_string("id") { Ok(s) => s, _ => continue };
        let cname = co.try_get_string("name").unwrap_or_else(|_| cid.clone());
        let unit = format!("{}.{}", lib, cname);
        labels.put_string(&format!("{}/{}", lib, cid), &format!("control '{}'", cname));
        units.put_string(&format!("{}/{}", lib, cid), &unit);
        if !shard_dir(&store.root, lib, &cid).join(&cid).exists() { continue; }
        let cd = store.get_data(lib, &cid).get_object("data");
        for key in ["cmd", "event", "timer"] {
            let arr = match cd.try_get_array(key) { Ok(a) => a, _ => continue };
            for e in arr.objects() {
                let eid = match e.clone() {
                    Data::DString(s) => s,
                    Data::DObject(_) => match e.object().try_get_string("id") { Ok(s) => s, _ => continue },
                    _ => continue,
                };
                units.put_string(&format!("{}/{}", lib, eid), &unit);
                if key != "cmd" {
                    labels.put_string(&format!("{}/{}", lib, eid), &format!("{} component of control '{}'", key, cname));
                    continue;
                }
                if !shard_dir(&store.root, lib, &eid).join(&eid).exists() {
                    labels.put_string(&format!("{}/{}", lib, eid), &format!("command record of control '{}'", cname));
                    continue;
                }
                let ed = store.get_data(lib, &eid).get_object("data");
                let cmdname = ed.try_get_string("name").unwrap_or_else(|_| eid.clone());
                labels.put_string(&format!("{}/{}", lib, eid), &format!("command '{}.{}' record", cname, cmdname));
                for k in ["rust", "python", "flow", "js", "java"] {
                    if let Ok(iid) = ed.try_get_string(k) {
                        if iid.len() >= 8 {
                            labels.put_string(&format!("{}/{}", lib, iid), &format!("command '{}.{}' {} impl", cname, cmdname, k));
                            units.put_string(&format!("{}/{}", lib, iid), &unit);
                        }
                    }
                }
            }
        }
    }
}

let mut args = DataArray::new();
args.push_string("--porcelain");
args.push_string("-uall");
let st = crate::dev::git::read::read(repo.clone(), "status".to_string(), args);
if st.get_string("status") != "ok" { return st; }
let out = st.get_string("out");

let mut labels = DataObject::new();
let mut units = DataObject::new();
let mut built: Vec<String> = Vec::new();
let mut groups = DataObject::new();
let mut order: Vec<String> = Vec::new();
let mut ocounts = DataObject::new();
let mut oorder: Vec<String> = Vec::new();

for line in out.lines() {
    if line.len() < 4 { continue; }
    let xy = &line[0..2];
    let mut path = line[3..].trim().to_string();
    if let Some(p) = path.find(" -> ") { path = path[p + 4..].to_string(); }
    if path.len() > 1 && path.starts_with('"') && path.ends_with('"') { path = path[1..path.len() - 1].to_string(); }
    let state = if xy.contains('?') { "new" }
        else if xy.contains('D') { "deleted" }
        else if xy.contains('A') || xy.contains('R') { "added" }
        else { "modified" };

    let (unit, what) = if path.starts_with("data/") {
        let comps: Vec<String> = path.split('/').map(|s| s.to_string()).collect();
        if comps.len() < 3 { (String::new(), String::new()) } else {
            let lib = comps[1].clone();
            if !built.contains(&lib) { build_map(&lib, &mut labels, &mut units); built.push(lib.clone()); }
            if comps[2] == "meta.json" { (lib.clone(), "library metadata (meta.json)".to_string()) }
            else if comps[2] == "_ASSETS" { (lib.clone(), format!("asset {}", comps[3..].join("/"))) }
            else {
                let fname = comps.last().unwrap().clone();
                let (base, suffix) = if let Some(p) = fname.find("_patches") { (fname[..p].to_string(), "patches".to_string()) }
                    else if let Some(p) = fname.find('.') { (fname[..p].to_string(), fname[p + 1..].to_string()) }
                    else { (fname.clone(), String::new()) };
                let key = format!("{}/{}", lib, base);
                let mut label = labels.try_get_string(&key).unwrap_or_default();
                if label.is_empty() && state == "deleted" {
                    // the record is gone from the live store - HEAD is the witness
                    let recpath = if suffix.is_empty() { path.clone() } else {
                        let mut c2 = comps.clone();
                        let n = c2.len();
                        c2[n - 1] = base.clone();
                        c2.join("/")
                    };
                    let hn = head_name(&repo, &recpath);
                    if !hn.is_empty() { label = format!("deleted '{}'", hn); }
                }
                if label.is_empty() { label = format!("store record {}", base); }
                let what = if suffix == "patches" { format!("{} - _patches journal", label) }
                    else if suffix.is_empty() { label.clone() }
                    else if label.starts_with("control") || label.starts_with("deleted") { format!("{} - {} facet", label, suffix) }
                    else { format!("{} - {} attachment", label, suffix) };
                let unit = units.try_get_string(&key).unwrap_or_else(|_| lib.clone());
                (unit, what)
            }
        }
    } else if path.starts_with("newbound_core/src/") {
        let comps: Vec<&str> = path.split('/').collect();
        if comps.len() >= 5 { (format!("{}.{}", comps[2], comps[3]), format!("generated source {}", comps[4..].join("/"))) }
        else if comps.len() == 4 { (comps[2].to_string(), format!("generated source {}", comps[3])) }
        else { (String::new(), String::new()) }
    } else { (String::new(), String::new()) };

    if unit.is_empty() {
        // outside the store: untracked collapses to per-directory counts
        let top = path.split('/').next().unwrap_or("").to_string();
        let okey = if state == "new" { format!("new       {}/...", top) } else { format!("{:9} {}", state, path) };
        let n = if ocounts.has(&okey) { ocounts.get_int(&okey) } else { 0 };
        if n == 0 { oorder.push(okey.clone()); }
        ocounts.put_int(&okey, n + 1);
        continue;
    }
    if !groups.has(&unit) { groups.put_array(&unit, DataArray::new()); order.push(unit.clone()); }
    let mut arr = groups.get_array(&unit);
    let mut item = DataObject::new();
    item.put_string("state", state);
    item.put_string("what", &what);
    item.put_string("path", &path);
    arr.push_object(item);
}

let mut text = String::new();
for u in &order {
    text.push_str(&format!("{}\n", u));
    for it in groups.get_array(u).objects() {
        let io = it.object();
        text.push_str(&format!("  {:9} {}\n            {}\n", io.get_string("state"), io.get_string("what"), io.get_string("path")));
    }
}
if !oorder.is_empty() {
    text.push_str("- not store files -\n");
    for k in &oorder {
        let n = ocounts.get_int(k);
        if n > 1 { text.push_str(&format!("  {} ({} files)\n", k, n)); }
        else { text.push_str(&format!("  {}\n", k)); }
    }
}
if text.is_empty() { text = "clean - nothing to report".to_string(); }

let mut res = DataObject::new();
res.put_string("status", "ok");
res.put_object("groups", groups);
res.put_object("other", ocounts);
res.put_string("text", &text);
res
}
