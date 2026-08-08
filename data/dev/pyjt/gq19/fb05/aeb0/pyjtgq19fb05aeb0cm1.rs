// The Great Refactoring's move (charter D2): a control changes library WITH
// its history. Records, facet attachments, commands with their typed impl
// records and attachments, and timer/event components all move; live
// timer/event registrations are re-pointed at the target library; the
// _patches journal moves too and the move itself is stamped as an entry.
// get_data/set_data carry attachments natively (get materializes them into
// the data object, set writes them back out as sibling files in the target
// shard), so a get->set pair IS the per-record move; source files are
// removed only after the target copies exist.

fn move_rec(store: &DataStore, from: &str, to: &str, id: &str) -> bool {
    if !store.exists(from, id) { return false; }
    let src_file = store.get_data_file(from, id);
    let rec = store.get_data(from, id);
    let mut d = rec.get_object("data");
    let mut names: Vec<String> = Vec::new();
    if d.has("attachmentkeynames") {
        // Keep only keys whose content actually materialized: set_data reads
        // every listed key, and an attachment file already lost (the orphan
        // class the deletion audit found) must not panic the move.
        let listed = d.get_array("attachmentkeynames");
        let mut kept = DataArray::new();
        for i in 0..listed.len() {
            let k = listed.get_string(i);
            if d.has(&k) {
                kept.push_string(&k);
                names.push(k);
            }
        }
        d.put_array("attachmentkeynames", kept);
    }
    store.set_data(to, id, rec);
    if let Some(dir) = src_file.parent() {
        for k in &names {
            let af = dir.join(format!("{}.{}", id, k));
            if af.exists() { let _x = std::fs::remove_file(af); }
        }
    }
    if src_file.exists() { let _x = std::fs::remove_file(src_file); }
    true
}

let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());
let store = DataStore::new();

if lib == to_lib {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Source and target are the same library");
    return o;
}
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}
if !store.exists(&to_lib, "controls") {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Target library '{}' not found", to_lib));
    return o;
}

// A published app's control keeps its address - unpublish first
// (delete_control's rule, same reasoning).
if ctl == lib {
    let app_props = store.root.join(&lib).join("_APPS").join(&ctl).join("app.properties");
    if app_props.exists() {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Control '{}' is a published app (_APPS/{} exists) - unpublish before moving", ctl, ctl));
        return o;
    }
}

// The target must not already have a control with this name.
{
    let tidx = store.get_data(&to_lib, "controls").get_object("data");
    if tidx.has("list") {
        let tl = tidx.get_array("list");
        for i in 0..tl.len() {
            if tl.get_object(i).get_string("name") == ctl {
                let mut o = DataObject::new();
                o.put_string("status", "err");
                o.put_string("msg", &format!("Library '{}' already has a control named '{}'", to_lib, ctl));
                return o;
            }
        }
    }
}

let rec = store.get_data(&lib, &ctlid);
let data = rec.get_object("data");
let mut n_cmds = 0i64;
let mut n_comps = 0i64;

// Commands: the command record and its typed impl record (attachments ride).
// Rust dispatch is unaffected by the move - the RUST_COMMANDS registry is
// keyed by impl id alone, and the next rebuild regenerates sources from
// store state under the new library path.
if data.has("cmd") {
    let list = data.get_array("cmd");
    for i in 0..list.len() {
        let cid = list.get_object(i).get_string("id");
        if store.exists(&lib, &cid) {
            let cd = store.get_data(&lib, &cid).get_object("data");
            let t = if cd.has("type") { cd.get_string("type") } else { "rust".to_string() };
            if cd.has(&t) {
                let impl_id = cd.get_string(&t);
                let _x = move_rec(&store, &lib, &to_lib, &impl_id);
            }
            let _x = move_rec(&store, &lib, &to_lib, &cid);
            n_cmds += 1;
        }
    }
}

// Timers: move, re-point cmddb/cmdlib at the target, re-register live.
if data.has("timer") {
    let list = data.get_array("timer");
    for i in 0..list.len() {
        let id = list.get_object(i).get_string("id");
        if move_rec(&store, &lib, &to_lib, &id) {
            let mut comp_rec = store.get_data(&to_lib, &id);
            let mut cd = comp_rec.get_object("data");
            if cd.has("cmddb") { cd.put_string("cmddb", &to_lib); }
            if cd.has("cmdlib") { cd.put_string("cmdlib", &to_lib); }
            comp_rec.put_object("data", cd.clone());
            comp_rec.put_int("time", time());
            store.set_data(&to_lib, &id, comp_rec);
            flowlang::appserver::remove_timer(&id);
            flowlang::appserver::add_timer(&id, cd.deep_copy());
            n_comps += 1;
        }
    }
}

// Events: same, and the live registration names the library explicitly.
if data.has("event") {
    let list = data.get_array("event");
    for i in 0..list.len() {
        let id = list.get_object(i).get_string("id");
        if move_rec(&store, &lib, &to_lib, &id) {
            let mut comp_rec = store.get_data(&to_lib, &id);
            let mut cd = comp_rec.get_object("data");
            if cd.has("cmddb") { cd.put_string("cmddb", &to_lib); }
            comp_rec.put_object("data", cd.clone());
            comp_rec.put_int("time", time());
            store.set_data(&to_lib, &id, comp_rec);
            flowlang::appserver::remove_event_listener(&id);
            if cd.has("bot") && cd.has("event") && cd.has("cmd") {
                let bot = cd.get_string("bot");
                let event = cd.get_string("event");
                let cmd_id = cd.get_string("cmd");
                flowlang::appserver::add_event_listener(&id, &bot, &event, &to_lib, &cmd_id);
            }
            n_comps += 1;
        }
    }
}

// The journal moves with the control (the point of this command existing),
// then records the move as its own entry.
let jid = format!("{}_patches", ctlid);
let _x = move_rec(&store, &lib, &to_lib, &jid);

let mut jrec;
let mut jdata;
let mut jlist;
if store.exists(&to_lib, &jid) {
    jrec = store.get_data(&to_lib, &jid);
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
let mut entry = DataObject::new();
entry.put_string("patch_id", &patch_id);
entry.put_string("author", &author);
entry.put_string("facet", "move");
entry.put_string("old", &lib);
entry.put_string("new", &to_lib);
entry.put_int("time", time());
entry.put_string("label", &format!("moved from {} to {}", lib, to_lib));
jlist.push_object(entry);
jdata.put_array("list", jlist);
jrec.put_object("data", jdata);
jrec.put_int("time", time());
store.set_data(&to_lib, &jid, jrec);

// The control record itself - facet attachments ride the same get->set.
let _x = move_rec(&store, &lib, &to_lib, &ctlid);

// Unlink from the source index...
if store.exists(&lib, "controls") {
    let mut idx = store.get_data(&lib, "controls");
    let mut idata = idx.get_object("data");
    let list = if idata.has("list") { idata.get_array("list") } else { DataArray::new() };
    let mut kept = DataArray::new();
    for i in 0..list.len() {
        let item = list.get_object(i);
        if item.get_string("id") != ctlid { kept.push_object(item); }
    }
    idata.put_array("list", kept);
    idx.put_object("data", idata);
    store.set_data(&lib, "controls", idx);
}

// ...and link into the target's (the entry shape names the library twice).
{
    let mut idx = store.get_data(&to_lib, "controls");
    let mut idata = idx.get_object("data");
    let mut list = if idata.has("list") { idata.get_array("list") } else { DataArray::new() };
    let mut item = DataObject::new();
    item.put_string("ctl", &ctlid);
    item.put_string("db", &to_lib);
    item.put_string("id", &ctlid);
    item.put_string("lib", &to_lib);
    item.put_string("name", &ctl);
    list.push_object(item);
    idata.put_array("list", list);
    idx.put_object("data", idata);
    store.set_data(&to_lib, "controls", idx);
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("Control '{}' moved from '{}' to '{}'", ctl, lib, to_lib));
o.put_int("moved_commands", n_cmds);
o.put_int("moved_components", n_comps);
o.put_string("patch_id", &patch_id);
o
