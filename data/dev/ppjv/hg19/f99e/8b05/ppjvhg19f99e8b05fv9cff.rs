let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

let mut ctl_rec = store.get_data(&lib, &ctlid);
let mut data_obj = ctl_rec.get_object("data");
let timers = if data_obj.has("timer") { data_obj.get_array("timer") } else { DataArray::new() };

let mut comp_id = String::new();
let mut kept = DataArray::new();
for i in 0..timers.len() {
    let item = timers.get_object(i);
    if item.get_string("name") == name {
        comp_id = item.get_string("id");
    } else {
        kept.push_object(item);
    }
}
if comp_id.is_empty() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("No timer named '{}' on control '{}'", name, ctl));
    return o;
}

let old = if store.exists(&lib, &comp_id) {
    store.get_data(&lib, &comp_id).get_object("data").to_string()
} else {
    String::new()
};

data_obj.put_array("timer", kept);
ctl_rec.put_object("data", data_obj);
ctl_rec.put_int("time", time());
store.set_data(&lib, &ctlid, ctl_rec);

// Unregister live and delete the component record (no attachments exist
// on timer components; removing the data file is the platform's own
// delete semantics). Fully qualified: this generated fn shares the
// appserver fn's name.
flowlang::appserver::remove_timer(&comp_id);
let f = store.get_data_file(&lib, &comp_id);
if f.exists() {
    let _x = std::fs::remove_file(f);
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
let mut entry = DataObject::new();
entry.put_string("patch_id", &patch_id);
entry.put_string("author", &author);
entry.put_string("facet", "timer");
entry.put_string("cmd", &name);
entry.put_string("old", &old);
entry.put_string("new", "");
entry.put_int("time", time());
entry.put_string("label", &format!("remove timer {}", name));
jlist.push_object(entry);
jdata.put_array("list", jlist);
jrec.put_object("data", jdata);
jrec.put_int("time", time());
store.set_data(&lib, &jid, jrec);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("removed", true);
o.put_string("patch_id", &patch_id);
o