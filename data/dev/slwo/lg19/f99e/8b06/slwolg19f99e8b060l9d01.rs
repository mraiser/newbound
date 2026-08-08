// Replace-only (Q7): a set wholly replaces the named handler's component
// record. Field shape comes from the dev lib's editevent editor: `bot` is
// the app whose event fires; the handler runs `cmd` in this library.
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

let mut events = if data_obj.has("event") { data_obj.get_array("event") } else { DataArray::new() };
let mut comp_id = String::new();
for i in 0..events.len() {
    let item = events.get_object(i);
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
    events.push_object(entry);
    data_obj.put_array("event", events);
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
comp.put_string("bot", &bot);
comp.put_string("event", &event);

let mut comp_rec = DataObject::new();
comp_rec.put_string("id", &comp_id);
comp_rec.put_string("username", "system");
comp_rec.put_array("readers", DataArray::new());
comp_rec.put_array("writers", DataArray::new());
comp_rec.put_object("data", comp.clone());
comp_rec.put_int("time", time());
store.set_data(&lib, &comp_id, comp_rec);

// Register live, replacing any prior registration — the editor's eventon.
remove_event_listener(&comp_id);
add_event_listener(&comp_id, &bot, &event, &lib, &cmd_id);

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
entry.put_string("facet", "event");
entry.put_string("cmd", &name);
entry.put_string("old", &old);
entry.put_string("new", &comp.to_string());
entry.put_int("time", time());
entry.put_string("label", &format!("set event handler {}", name));
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