let all = lib.is_empty() || lib == "*";
let mut arr = DataArray::new();
let mut found = false;
let mut failed = 0i64;
for l in lib_ids() {
    if !all && l != lib { continue; }
    found = true;
    let mut r = DataObject::new();
    r.put_string("lib", &l);
    match build(&l) {
        Ok((docs, bytes, ms)) => {
            r.put_int("docs", docs as i64);
            r.put_int("bytes", bytes as i64);
            r.put_int("ms", ms);
        }
        Err(e) => {
            failed += 1;
            r.put_string("error", &e);
        }
    }
    arr.push_object(r);
}
let mut o = DataObject::new();
if !found {
    o.put_string("status", "err");
    o.put_string("msg", &format!("library '{}' not found", lib));
    return o;
}
o.put_string("status", if failed == 0 { "ok" } else { "err" });
if failed > 0 { o.put_string("msg", &format!("{} library index(es) failed", failed)); }
o.put_string("dir", &index_dir().to_string_lossy());
o.put_array("libraries", arr);
o