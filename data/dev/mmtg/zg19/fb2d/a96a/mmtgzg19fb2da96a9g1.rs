let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

// The module flag (settled with the owner 2026-07-30): a control record
// carrying `module: true` is a MODULE CONTROL — headless; installControl
// registers its js facet as a named ES module on the page instead of
// mounting UI (css facet injects once). "true" sets, "false" clears; the
// flag lives on the record's data object like desc/groups.
let flag = match module.as_str() {
    "true" => true,
    "false" => false,
    _ => {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", "module must be 'true' or 'false'");
        return o;
    }
};

let mut record = store.get_data(&lib, &ctlid);
let mut data_obj = record.get_object("data");
let cur = data_obj.has("module") && data_obj.get_boolean("module");
let changed = cur != flag;
if changed {
    if flag {
        data_obj.put_boolean("module", true);
    } else {
        data_obj.remove_property("module");
    }
    record.put_object("data", data_obj);
    record.put_int("time", time());
    store.set_data(&lib, &ctlid, record);
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("changed", changed);
o.put_boolean("module", flag);
o
