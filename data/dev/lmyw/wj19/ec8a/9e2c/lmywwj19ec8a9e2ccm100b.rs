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