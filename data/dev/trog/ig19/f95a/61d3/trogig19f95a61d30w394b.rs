let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

let mut record = store.get_data(&lib, &ctlid);
let mut data_obj = record.get_object("data");

// Empty string leaves a field untouched. `groups` is the platform's
// comma-delimited security-group string, stored verbatim (the same field
// the dev editor's save_control writes). Record-level readers/writers are
// not modified.
let mut changed = false;
if !desc.is_empty() {
    data_obj.put_string("desc", &desc);
    changed = true;
}
if !groups.is_empty() {
    data_obj.put_string("groups", &groups);
    changed = true;
}

if changed {
    record.put_object("data", data_obj);
    record.put_int("time", time());
    store.set_data(&lib, &ctlid, record);
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
o