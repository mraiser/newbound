use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use flowlang::flowlang::system::unique_session_id::unique_session_id;
use flowlang::appserver::add_timer;
use flowlang::appserver::remove_timer;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "name", "cmd", "start", "startunit", "interval", "intervalunit", "repeat", "author", "nn_sessionid"] {
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
        let arg_1: String = o.get_string("ctl");
        let arg_2: String = o.get_string("name");
        let arg_3: String = o.get_string("cmd");
        let arg_4: i64 = o.get_int("start");
        let arg_5: String = o.get_string("startunit");
        let arg_6: i64 = o.get_int("interval");
        let arg_7: String = o.get_string("intervalunit");
        let arg_8: bool = o.get_boolean("repeat");
        let arg_9: String = o.get_string("author");
        let arg_10: String = o.get_string("nn_sessionid");
        set_timer(arg_0, arg_1, arg_2, arg_3, arg_4, arg_5, arg_6, arg_7, arg_8, arg_9, arg_10)
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

pub fn set_timer(lib: String, ctl: String, name: String, cmd: String, start: i64, startunit: String, interval: i64, intervalunit: String, repeat: bool, author: String, nn_sessionid: String) -> DataObject {
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
}
