use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use crate::dev::search::index::{lib_ids, header, index_dir};

pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        status()
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_object("a", ax);
            result_obj
        }
        Err(err) => {
            let mut err_obj = DataObject::new();
            err_obj.put_string("status", "err");

            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                "Unknown panic occurred".to_string()
            };

            err_obj.put_string("msg", &msg);
            // Wrapped in the same `a` envelope a successful return uses.
            // Unwrapped, callers that unpack the envelope (newbound's
            // format_result, for one) report an opaque 500 — "Not an object:
            // DString(\"err\")" — instead of this message.
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", err_obj);
            result_obj
        }
    }
}

pub fn status() -> DataObject {
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
}
