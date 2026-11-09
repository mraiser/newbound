let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

// Runtime-backed journals are instance-local; an unconverted source
// journal remains readable. Reads do not migrate or modify either copy.
// The public response deliberately retains its historical FLAT shape.
let r = crate::dev::code::patch_journal::patch_journal(
    "read".to_string(), lib, ctl, String::new(), DataObject::new(), limit, false, String::new());
if r.get_string("status") != "ok" { return r; }
let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_array("patches", r.get_array("patches"));
o