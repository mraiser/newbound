use ndata::dataobject::DataObject;
pub fn execute(_: DataObject) -> DataObject {
    use std::panic;
    let ax = panic::catch_unwind(panic::AssertUnwindSafe(|| {
        debug_reap()
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

pub fn debug_reap() -> DataObject {
// Timer target (flow step debugger P3, lifecycle R4) - the transition lives in debug_step (mode reap): idle
// sessions with no debug_* call and no step for 30 min end (tombstoned); a session with an owner is never unlinked
// under it - the owner's per-step heartbeat keeps an active continue alive without HTTP polls, and an owner whose
// heartbeat is older than 2 h (one op executing that long) is asked to stop and ends itself at its next boundary.
super::debug_step::debug_step(String::new(), "reap".to_string(), DataObject::new())
}
