// The read half of the meta-identity pair. /app/read cannot serve the
// runtime lib (it answers 500 - the lib is store-only, never app-loaded),
// so the publish panel reads through this instead. Returns exists=false
// with empty fields on a fresh instance - the state set_meta_identity
// (and its form) exists to fix, because publishapp panics in it.
let store = DataStore::new();
let mut o = DataObject::new();
o.put_string("status", "ok");
if store.exists("runtime", "metaidentity") {
    let d = store.get_data("runtime", "metaidentity").get_object("data");
    o.put_boolean("exists", true);
    let dn = if d.has("displayname") { d.get_string("displayname") } else { String::new() };
    let og = if d.has("organization") { d.get_string("organization") } else { String::new() };
    o.put_string("displayname", &dn);
    o.put_string("organization", &og);
} else {
    o.put_boolean("exists", false);
    o.put_string("displayname", "");
    o.put_string("organization", "");
}
o
