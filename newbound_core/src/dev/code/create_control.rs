use flowlang::datastore::DataStore;
use flowlang::flowlang::system::time::time;
use flowlang::flowlang::system::unique_session_id::unique_session_id;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "name", "desc"] {
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
        let arg_1: String = o.get_string("name");
        let arg_2: String = o.get_string("desc");
        create_control(arg_0, arg_1, arg_2)
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

pub fn create_control(lib: String, name: String, desc: String) -> DataObject {
// create_control - the journaled way to birth a control. Creates the control
// record with the platform's exact internal shape and registers it in the
// library's controls index (data.list), so every other dev.code command
// (patch_control_facet, read_control_facet, set_control_meta, delete_control)
// works on it immediately. Without this command agents hand-built records in
// the data folder and corrupted the index (extra `data` wrapper) - see
// kb.platform-api. Returns FLAT {status, id, name, lib, created}.
//
// `name` is the human-facing control name (what data-control='lib:name:{}'
// resolves). It must be unique within the library; an existing control with
// the same name returns status=err created=false rather than clobbering.

let store = DataStore::new();

// The library must exist.
if !store.exists(&lib, &"controls".to_string()) {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("msg", &format!("Library '{}' has no controls index (does it exist?)", lib));
  return o;
}

// Resolve name -> id the same way patch_control_facet does; if it already
// resolves to a real record, refuse to clobber.
let api = crate::api::new();
let existing = api.dev.editcontrol.lookup_id(lib.clone(), name.clone());
if existing != name && store.exists(&lib, &existing) {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("created", "false");
  o.put_string("id", &existing);
  o.put_string("name", &name);
  o.put_string("msg", &format!("Control '{}' already exists in library '{}' (id {}).", name, lib, existing));
  return o;
}

let ctlid = unique_session_id();

// Build the control record. Facets are attachment fields listed in
// attachmentkeynames; html/css/js start empty and are authored via
// patch_control_facet. `groups` defaults to "anonymous" so the control renders
// without an explicit set_groups call; tighten via set_groups afterwards.
let mut data = DataObject::new();
data.put_string("id", &ctlid);
data.put_string("ctl", &ctlid);
data.put_string("db", &lib);
data.put_string("lib", &lib);
data.put_string("name", &name);
data.put_string("desc", &desc);
data.put_string("groups", "anonymous");
data.put_array("cmd", DataArray::new());
data.put_array("attachmentkeynames", DataArray::new());

let mut record = DataObject::new();
record.put_string("id", &ctlid);
record.put_string("username", "system");
record.put_array("readers", DataArray::new());
record.put_array("writers", DataArray::new());
record.put_int("time", time());
record.put_object("data", data);

store.set_data(&lib, &ctlid, record);

// Register in the library's controls index (data.list). The index record is
// the single source of truth for name -> id resolution (lookup_id), so the
// control is not addressable until this entry lands.
let mut index = store.get_data(&lib, &"controls".to_string());
let mut index_data = index.get_object("data");
let mut list = if index_data.has("list") { index_data.get_array("list") } else { DataArray::new() };
let mut entry = DataObject::new();
entry.put_string("ctl", &ctlid);
entry.put_string("db", &lib);
entry.put_string("id", &ctlid);
entry.put_string("lib", &lib);
entry.put_string("name", &name);
list.push_object(entry);
index_data.put_array("list", list);
index.put_object("data", index_data);
index.put_int("time", time());
store.set_data(&lib, &"controls".to_string(), index);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("created", "true");
o.put_string("id", &ctlid);
o.put_string("name", &name);
o.put_string("lib", &lib);
o
}
