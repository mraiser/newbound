use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use ndata::dataarray::DataArray;
pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        autocommit_sweep()
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

pub fn autocommit_sweep() -> DataObject {
// The auto-commit sweeper (frictionless git): for every registry entry
// flagged autocommit, commit the working tree when dirty - "tracks changes
// in git but doesn't complain if nothing ever merges" made mechanical.
// Local history only: never fetches, never pushes. Idempotent by nature -
// a clean tree is a no-op, so the timer can fire at any rate. Canon and
// overlay repos are swept only if the owner explicitly flags them
// (set_repo defaults them off); a registry-less or git-less box no-ops.
let mut o = DataObject::new();
o.put_string("status", "ok");
let mut swept: i64 = 0;
let mut committed: i64 = 0;
let mut results = DataArray::new();
let regpath = DataStore::new().root.parent().unwrap()
    .join("runtime").join("dev").join("repos.json");
if regpath.exists() {
    if let Ok(reg) = DataObject::try_from_string(&std::fs::read_to_string(&regpath).unwrap_or_default()) {
        for n in reg.get_keys() {
            let e = reg.get_object(&n);
            let ac = matches!(e.try_get_boolean("autocommit"), Ok(true));
            if !ac { continue; }
            swept += 1;
            let mut sargs = DataArray::new();
            sargs.push_string("--porcelain");
            let st = crate::dev::git::gitrun::gitrun(
                n.clone(), "status".to_string(), sargs, "read".to_string());
            if st.try_get_string("status").unwrap_or_default() != "ok" {
                let mut r = DataObject::new();
                r.put_string("repo", &n);
                r.put_string("result", "status_failed");
                r.put_string("err", st.try_get_string("err").unwrap_or_default().trim());
                results.push_object(r);
                continue;
            }
            let dirt = st.try_get_string("out").unwrap_or_default();
            if dirt.trim().is_empty() { continue; }
            let npaths = dirt.trim().lines().count();
            let mut aargs = DataArray::new();
            aargs.push_string("-A");
            let ar = crate::dev::git::gitrun::gitrun(
                n.clone(), "add".to_string(), aargs, "write".to_string());
            if ar.try_get_string("status").unwrap_or_default() != "ok" {
                let mut r = DataObject::new();
                r.put_string("repo", &n);
                r.put_string("result", "add_failed");
                r.put_string("err", ar.try_get_string("err").unwrap_or_default().trim());
                results.push_object(r);
                continue;
            }
            let mut cargs = DataArray::new();
            cargs.push_string("-m");
            cargs.push_string(&format!("autocommit: {} path(s) changed", npaths));
            let cr = crate::dev::git::gitrun::gitrun(
                n.clone(), "commit".to_string(), cargs, "write".to_string());
            let mut r = DataObject::new();
            r.put_string("repo", &n);
            if cr.try_get_string("status").unwrap_or_default() == "ok" {
                committed += 1;
                r.put_string("result", "committed");
                r.put_int("paths", npaths as i64);
            } else {
                r.put_string("result", "commit_failed");
                r.put_string("err", cr.try_get_string("err").unwrap_or_default().trim());
            }
            results.push_object(r);
        }
    }
}
o.put_int("swept", swept);
o.put_int("committed", committed);
o.put_array("results", results);
o
}
