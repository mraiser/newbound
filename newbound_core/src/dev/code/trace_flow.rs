use ndata::dataobject::DataObject;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "cmd", "args", "nn_sessionid"] {
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
        let arg_2: String = o.get_string("cmd");
        let arg_3: DataObject = o.get_object("args");
        let arg_4: String = o.get_string("nn_sessionid");
        trace_flow(arg_0, arg_1, arg_2, arg_3, arg_4)
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

pub fn trace_flow(lib: String, ctl: String, cmd: String, args: DataObject, nn_sessionid: String) -> DataObject {
// The case path of ONE ordinary run (R5). No debug session, no tape, no
// sentinel nextcase, no 10k debugger budget: dev.flowstep.run_flow drives
// flowlang's own stepper (the one semantics Command::execute runs) to the
// end and observes it. The path is COMPLETE by construction - one segment per
// ROOT case (nested frames never enter it), closed by the root's next events
// and the terminal event - and each segment's ms/us is monotonic wall time
// measured at the execution boundary (nested work is attributed to the root
// case it ran under). result is THE mapping: app.app.exec's auth and
// format_result on ok/terminate; fail/stall/I-4/panic/budget name themselves
// (flow_end). Step budget = the ordinary run's (1,000,000 steps); running out
// is an explicit budget error, never a truncated success. No events kept.
crate::dev::flowstep::run_flow::run_flow(lib, ctl, cmd, args, 0, 0, nn_sessionid)
}
