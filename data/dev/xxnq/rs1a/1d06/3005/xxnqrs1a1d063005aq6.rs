let mut arr = DataArray::new();
let mut indexed = 0i64;
let mut docs_total = 0i64;
let mut bytes_total = 0i64;
for l in lib_ids() {
    let mut r = DataObject::new();
    r.put_string("lib", &l);
    match header(&l) {
        Some((built, docs, bytes)) => {
            r.put_boolean("indexed", true);
            r.put_int("built", built as i64);
            r.put_int("docs", docs as i64);
            r.put_int("bytes", bytes as i64);
            indexed += 1;
            docs_total += docs as i64;
            bytes_total += bytes as i64;
        }
        None => r.put_boolean("indexed", false),
    }
    arr.push_object(r);
}
let mut o = DataObject::new();
o.put_string("status", "ok");
o.put_string("dir", &index_dir().to_string_lossy());
o.put_int("indexed", indexed);
o.put_int("docs", docs_total);
o.put_int("bytes", bytes_total);
o.put_array("libraries", arr);
o