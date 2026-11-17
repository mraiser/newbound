// A filter over the global store search (dev.search), restricted to
// commands: the index rules records out by trigram mask and every hit is
// verified against the live command, so the haystack is unchanged (name,
// parameter names, desc, imports, source). An empty query matches nothing.
let mut results = DataArray::new();
let r = search(&lib, &ctl, "command", &query, 1_000_000, None);
if r.has("matches") {
    let ms = r.get_array("matches");
    for i in 0..ms.len() {
        let m = ms.get_object(i);
        let mut o = DataObject::new();
        o.put_string("lib", &m.get_string("lib"));
        o.put_string("ctl", &m.get_string("ctl"));
        o.put_string("cmd", &m.get_string("name"));
        results.push_object(o);
    }
}
results