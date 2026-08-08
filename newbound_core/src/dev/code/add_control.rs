use ndata::dataobject::DataObject;
use flowlang::flowlang::system::unique_session_id::unique_session_id;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl"] {
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
        add_control(arg_0, arg_1)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
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

pub fn add_control(lib: String, ctl: String) -> String {
fn write_ctl_doc(lib: &str, ctl: &str, ctl_id: &str) {
    let store = DataStore::new();
    let mut data = DataObject::new();
    data.put_string("name", ctl);
    data.put_string("id", ctl_id);
    data.put_array("cmd", DataArray::new());
    let mut doc = DataObject::new();
    doc.put_object("data", data);
    store.set_data(lib, ctl_id, doc);
}

let store = DataStore::new();
let id = "controls";
if !store.exists(&lib, id) {
    return format!("ERROR: No such library (`{}`).", &lib);
}

let o = store.get_data(&lib, id);
let mut list = o.get_object("data").get_array("list");

// Idempotency + healing: does this control name already exist in the registry?
let mut existing_id = String::new();
for c in list.objects() {
    let c = c.object();
    if c.get_string("name") == ctl {
        existing_id = c.get_string("id");
        break;
    }
}
if !existing_id.is_empty() {
    if !store.exists(&lib, &existing_id) {
        // Phantom: registered but no document. Heal it.
        write_ctl_doc(&lib, &ctl, &existing_id);
    }
    return existing_id;
}

// Fresh create: registry entry + control document, both halves.
let nuid = unique_session_id();

let mut nuctl = DataObject::new();
nuctl.put_string("id", &nuid);
nuctl.put_string("ctl", &nuid);
nuctl.put_string("lib", &lib);
nuctl.put_string("db", &lib);
nuctl.put_string("name", &ctl);
list.push_object(nuctl);

store.set_data(&lib, id, o);
write_ctl_doc(&lib, &ctl, &nuid);

nuid
}
