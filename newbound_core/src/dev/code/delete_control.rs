use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::appserver::remove_event_listener;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "author"] {
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
        let arg_2: String = o.get_string("author");
        delete_control(arg_0, arg_1, arg_2)
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

pub fn delete_control(lib: String, ctl: String, author: String) -> DataObject {

fn zap(store: &DataStore, lib: &str, id: &str) {
    if !store.exists(lib, id) { return; }
    let d = store.get_data(lib, id).get_object("data");
    let f = store.get_data_file(lib, id);
    if d.has("attachmentkeynames") {
        let keys = d.get_array("attachmentkeynames");
        for i in 0..keys.len() {
            let k = keys.get_string(i);
            if let Some(dir) = f.parent() {
                let af = dir.join(format!("{}.{}", id, k));
                if af.exists() { let _x = std::fs::remove_file(af); }
            }
        }
    }
    if f.exists() { let _x = std::fs::remove_file(f); }
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

// A published app's control must be unpublished first, not deleted under it.
if ctl == lib {
    let app_props = store.root.join(&lib).join("_APPS").join(&ctl).join("app.properties");
    if app_props.exists() {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Control '{}' is a published app (_APPS/{} exists) - unpublish before deleting", ctl, ctl));
        return o;
    }
}

let _author = author; // terminal deletion: the journal it would be recorded in goes too
let rec = store.get_data(&lib, &ctlid);
let data = rec.get_object("data");
let mut n_cmds = 0i64;
let mut n_comps = 0i64;

// timers/events: deregister LIVE first (the setters' timeron/eventon in
// reverse), then delete the component records
if data.has("timer") {
    let list = data.get_array("timer");
    for i in 0..list.len() {
        let id = list.get_object(i).get_string("id");
        flowlang::appserver::remove_timer(&id);
        zap(&store, &lib, &id);
        n_comps += 1;
    }
}
if data.has("event") {
    let list = data.get_array("event");
    for i in 0..list.len() {
        let id = list.get_object(i).get_string("id");
        remove_event_listener(&id);
        zap(&store, &lib, &id);
        n_comps += 1;
    }
}

// commands: command record -> its typed impl/flow record -> both, with attachments
if data.has("cmd") {
    let list = data.get_array("cmd");
    for i in 0..list.len() {
        let cid = list.get_object(i).get_string("id");
        if store.exists(&lib, &cid) {
            let cd = store.get_data(&lib, &cid).get_object("data");
            let t = if cd.has("type") { cd.get_string("type") } else { "rust".to_string() };
            if cd.has(&t) {
                let impl_id = cd.get_string(&t);
                zap(&store, &lib, &impl_id);
            }
        }
        zap(&store, &lib, &cid);
        n_cmds += 1;
    }
}

// the journal dies with the control (terminal - stated in the contract)
let jid = format!("{}_patches", ctlid);
zap(&store, &lib, &jid);

// unlink from the library's controls index
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

// finally the control record itself (facet attachments go with it)
zap(&store, &lib, &ctlid);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("msg", &format!("Control '{}' deleted from library '{}'", ctl, lib));
o.put_int("deleted_commands", n_cmds);
o.put_int("deleted_components", n_comps);
o

}
