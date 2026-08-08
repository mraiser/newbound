use ndata::dataobject::DataObject;
use flowlang::appserver::*;
pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["id", "app", "event", "cmdlib", "cmdid"] {
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
        let arg_0: String = o.get_string("id");
        let arg_1: String = o.get_string("app");
        let arg_2: String = o.get_string("event");
        let arg_3: String = o.get_string("cmdlib");
        let arg_4: String = o.get_string("cmdid");
        eventon(arg_0, arg_1, arg_2, arg_3, arg_4)
    }));
    match ax {
        Ok(ax) => {
            let mut result_obj = DataObject::new();
    result_obj.put_string("a", &ax);
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

pub fn eventon(id: String, app: String, event: String, cmdlib: String, cmdid: String) -> String {
add_event_listener(&id, &app, &event, &cmdlib, &cmdid);
"OK".to_string()
}
