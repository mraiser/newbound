// Replace-only (Q7): a set wholly replaces the named timer's component
// record — no partial component patching. Field shape comes from the dev
// lib's edittimer editor; firing uses cmd/cmddb/params/repeat +
// start/interval in units to_millis understands.
let valid_units = ["milliseconds", "seconds", "minutes", "hours", "days"];
if !valid_units.contains(&startunit.as_str()) || !valid_units.contains(&intervalunit.as_str()) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Invalid time unit. Valid units: {:?}", valid_units));
    return o;
}

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

// Resolve the command NAME to its record id — the timer stores the id.
let cmds = if data_obj.has("cmd") { data_obj.get_array("cmd") } else { DataArray::new() };
let mut cmd_id = String::new();
for i in 0..cmds.len() {
    let item = cmds.get_object(i);
    if item.get_string("name") == cmd {
        cmd_id = item.get_string("id");
        break;
    }
}
if cmd_id.is_empty() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Command '{}' not found in control '{}'", cmd, ctl));
    return o;
}

// Find the named timer component; create the array/entry when absent.
let mut timers = if data_obj.has("timer") { data_obj.get_array("timer") } else { DataArray::new() };
let mut comp_id = String::new();
for i in 0..timers.len() {
    let item = timers.get_object(i);
    if item.get_string("name") == name {
        comp_id = item.get_string("id");
        break;
    }
}
let created = comp_id.is_empty();
if created {
    comp_id = unique_session_id();
    let mut entry = DataObject::new();
    entry.put_string("name", &name);
    entry.put_string("id", &comp_id);
    timers.push_object(entry);
    data_obj.put_array("timer", timers);
    ctl_rec.put_object("data", data_obj);
    ctl_rec.put_int("time", time());
    store.set_data(&lib, &ctlid, ctl_rec);
}

let old = if store.exists(&lib, &comp_id) {
    store.get_data(&lib, &comp_id).get_object("data").to_string()
} else {
    String::new()
};

let mut comp = DataObject::new();
comp.put_string("id", &comp_id);
comp.put_string("name", &name);
comp.put_string("cmd", &cmd_id);
comp.put_string("cmddb", &lib);
comp.put_string("cmdlib", &lib);
comp.put_object("params", DataObject::new());
comp.put_int("start", start);
comp.put_string("startunit", &startunit);
comp.put_int("interval", interval);
comp.put_string("intervalunit", &intervalunit);
comp.put_boolean("repeat", repeat);

let mut comp_rec = DataObject::new();
comp_rec.put_string("id", &comp_id);
comp_rec.put_string("username", "system");
comp_rec.put_array("readers", DataArray::new());
comp_rec.put_array("writers", DataArray::new());
comp_rec.put_object("data", comp.clone());
comp_rec.put_int("time", time());
store.set_data(&lib, &comp_id, comp_rec);

// Register live, replacing any prior registration — the same behavior as
// the dev editor's save (timeron). add_timer mutates its copy (computes
// startmillis/intervalmillis), so hand it a deep copy.
remove_timer(&comp_id);
add_timer(&comp_id, comp.deep_copy());

// Journal on the control's shared _patches record.
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
entry.put_string("new", &comp.to_string());
entry.put_int("time", time());
entry.put_string("label", &format!("set timer {}", name));
jlist.push_object(entry);
jdata.put_array("list", jlist);
jrec.put_object("data", jdata);
jrec.put_int("time", time());
store.set_data(&lib, &jid, jrec);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("created", created);
o.put_string("patch_id", &patch_id);
o.put_string("component_id", &comp_id);
o