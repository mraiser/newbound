use ndata::dataobject::DataObject;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["session"] {
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
        let arg_0: String = o.get_string("session");
        debug_stop(arg_0)
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

pub fn debug_stop(session: String) -> DataObject {
// End a debug session (flow step debugger P3, lifecycle R4). The transition lives in debug_step (mode stop) so ONE
// function owns every lifecycle change: an idle session ends at once; a session with an owner (a running continue
// or a synchronous step) is marked stopping, the owner finishes the step in flight (cooperative - an op that is
// executing cannot be preempted; it is recorded exactly once), sees stopping at the step boundary and runs the
// terminal cleanup itself; this call waits up to 10 s for that acknowledgement. Idempotent: a stopped/reaped
// session answers ok with already:true (tombstones capped at 64 / 6 h).
super::debug_step::debug_step(session, "stop".to_string(), DataObject::new())
}
