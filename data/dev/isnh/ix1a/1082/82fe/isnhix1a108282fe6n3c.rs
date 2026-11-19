// create_control - THE way to birth a control (add_control is retired).
// Creates the control record with the platform's exact internal shape and
// registers it in the library's controls index (data.list), so every other
// dev.code command works on it immediately. A new control is ADMIN-ONLY:
// readers [] and NO groups label - security is set afterwards, deliberately,
// with set_groups (which writes label and readers together). JOURNALED on the
// new control's patch journal (facet "control", op "create").
//
// An existing control with the same name is refused, never clobbered. A
// PHANTOM (name in the index, record missing) is healed: the record is
// written under the indexed id and no second index entry is added.

let author = {
    let a = author.trim().to_string();
    if !a.is_empty() { a } else {
        let mut who = String::new();
        if !nn_sessionid.is_empty() {
            let system = DataStore::globals().get_object("system");
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

let store = DataStore::new();
let name = name.trim().to_string();
if name.is_empty() {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("created", "false");
  o.put_string("msg", "Control name is empty");
  return o;
}

// The library must exist.
if !store.exists(&lib, &"controls".to_string()) {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("created", "false");
  o.put_string("msg", &format!("Library '{}' has no controls index (does it exist?)", lib));
  return o;
}

let mut index = store.get_data(&lib, &"controls".to_string());
let mut index_data = index.get_object("data");
let mut list = if index_data.has("list") { index_data.get_array("list") } else { DataArray::new() };

// Is the name already in the index?
let mut indexed_id = String::new();
for i in 0..list.len() {
  let item = match list.try_get_object(i) { Ok(x) => x, Err(_) => continue };
  if item.has("name") && item.get_string("name") == name {
    indexed_id = if item.has("id") { item.get_string("id") } else { String::new() };
    break;
  }
}
if !indexed_id.is_empty() && store.exists(&lib, &indexed_id) {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("created", "false");
  o.put_string("id", &indexed_id);
  o.put_string("name", &name);
  o.put_string("msg", &format!("Control '{}' already exists in library '{}' (id {}).", name, lib, indexed_id));
  return o;
}
let healed = !indexed_id.is_empty();
let ctlid = if healed { indexed_id.clone() } else { unique_session_id() };

// Build the control record. Facets are attachment fields listed in
// attachmentkeynames; html/css/js start empty and are authored via
// patch_control_facet. NO groups label: readers [] is admin-only, and a label
// that says otherwise would lie about it.
let mut data = DataObject::new();
data.put_string("id", &ctlid);
data.put_string("ctl", &ctlid);
data.put_string("db", &lib);
data.put_string("lib", &lib);
data.put_string("name", &name);
data.put_string("desc", &desc);
data.put_array("cmd", DataArray::new());
data.put_array("attachmentkeynames", DataArray::new());
let data_json = data.to_string();

let mut record = DataObject::new();
record.put_string("id", &ctlid);
record.put_string("username", "system");
record.put_array("readers", DataArray::new());
record.put_array("writers", DataArray::new());
record.put_int("time", time());
record.put_object("data", data);

store.set_data(&lib, &ctlid, record);

// Register in the library's controls index (data.list) - the single source
// of truth for name -> id resolution. A healed phantom is already there.
if !healed {
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
}

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("created", "true");
o.put_boolean("healed", healed);
o.put_string("id", &ctlid);
o.put_string("name", &name);
o.put_string("lib", &lib);

// JOURNAL: first entry of the new control's patch journal. A journal problem
// is reported on the result, never as a failed create.
let mut j_entry = DataObject::new();
j_entry.put_string("author", &author);
j_entry.put_string("facet", "control");
j_entry.put_string("cmd", "");
j_entry.put_string("op", "create");
j_entry.put_string("old", "");
j_entry.put_string("new", &data_json);
j_entry.put_string("label", &format!("create control {}.{} (admin only){}", lib, name, if healed { " - healed a phantom index entry" } else { "" }));
let j_r = crate::dev::code::patch_journal::patch_journal("append".to_string(), lib.clone(), ctlid.clone(), String::new(), j_entry, 0, false, nn_sessionid.clone());
if j_r.has("status") && j_r.get_string("status") == "ok" {
  o.put_string("patch_id", &j_r.try_get_string("patch_id").unwrap_or_default());
} else {
  o.put_string("journal_warning", &j_r.try_get_string("msg").unwrap_or_default());
}
o