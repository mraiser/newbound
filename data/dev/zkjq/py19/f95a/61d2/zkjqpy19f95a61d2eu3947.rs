let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

let patches = match crate::dev::code::journal_storage::list(&store, &lib, &ctlid, limit) {
    Ok(p) => p,
    Err(e) => {
        let mut o = DataObject::new(); o.put_string("status", "err");
        o.put_string("msg", &format!("control journal unavailable: {}", e)); return o;
    }
};
let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_array("patches", patches);
o