let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Control '{}' not found in library '{}'", ctl, lib));
    return o;
}

let mut patches = DataArray::new();
let jid = format!("{}_patches", ctlid);
if store.exists(&lib, &jid) {
    let jdata = store.get_data(&lib, &jid).get_object("data");
    if jdata.has("list") {
        let list = jdata.get_array("list");
        let total = list.len();
        let n = if limit <= 0 { total } else if (limit as usize) < total { limit as usize } else { total };
        // Newest first: the journal appends; the timeline renders reverse-chronological.
        let mut i = total;
        while i > total - n {
            i -= 1;
            patches.push_object(list.get_object(i));
        }
    }
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_array("patches", patches);
o