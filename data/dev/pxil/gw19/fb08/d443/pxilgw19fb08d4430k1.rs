// Publishing signs libraries with the instance's meta identity — the
// runtime/metaidentity record publishapp reads (and, on its known FIXME,
// panics without). This setter creates or wholly replaces the record, so
// the publish panel's identity form can close that wrinkle at the root on
// a fresh instance. Unjournaled like write_asset (there is no _patches
// home for the runtime lib); the canonical repo's git history is the
// record. `author` is accepted for symmetry with every other mutation.

if displayname.trim().is_empty() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "A display name is required - publishing signs libraries with it");
    return o;
}

let _author = author;
let store = DataStore::new();
let created = !store.exists("runtime", "metaidentity");
let mut rec;
let mut d;
if created {
    rec = DataObject::new();
    rec.put_string("id", "metaidentity");
    rec.put_string("username", "admin");
    rec.put_array("readers", DataArray::new());
    rec.put_array("writers", DataArray::new());
    d = DataObject::new();
} else {
    rec = store.get_data("runtime", "metaidentity");
    d = rec.get_object("data");
}
d.put_string("displayname", &displayname);
d.put_string("organization", &organization);
rec.put_object("data", d);
rec.put_int("time", time());
store.set_data("runtime", "metaidentity", rec);

let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_boolean("created", created);
o.put_string("displayname", &displayname);
o.put_string("organization", &organization);
o
