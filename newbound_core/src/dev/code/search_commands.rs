use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use crate::dev::search::index::search;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "query"] {
        if !o.has(p) {
            let mut e = DataObject::new();
            e.put_string("status", "err");
            e.put_string("msg", &format!("missing required parameter: {}", p));
            let mut result_obj = DataObject::new();
            result_obj.put_object("a", e);
            return result_obj;
        }
    }
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        let arg_0: String = o.get_string("lib");
        let arg_1: String = o.get_string("ctl");
        let arg_2: String = o.get_string("query");
        search_commands(arg_0, arg_1, arg_2)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_array("a", ax);
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

pub fn search_commands(lib: String, ctl: String, query: String) -> DataArray {
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
}
