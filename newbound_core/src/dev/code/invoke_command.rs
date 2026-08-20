use flowlang::datastore::DataStore;
use ndata::dataobject::DataObject;
use std::panic;
use flowlang::command::Command;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "cmd", "args"] {
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
        invoke_command(arg_0, arg_1, arg_2, arg_3)
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

pub fn invoke_command(lib: String, ctl: String, cmd: String, args: DataObject) -> DataObject {
let store = DataStore::new();
let id = store.lookup_cmd_id(&lib, &ctl, &cmd);

if id.is_empty() {
    let mut err_obj = DataObject::new();
    err_obj.put_string("status", "err");
    err_obj.put_string("msg", &format!("Command {}:{}:{} not found", lib, ctl, cmd));
    return err_obj;
}

let command = Command::new(&lib, &id);

// Cast parameters according to the command's expected signature
command.cast_params(args.clone());

// Execute the command in an isolated unwind context to catch panics
let result = panic::catch_unwind(panic::AssertUnwindSafe(|| {
    let o = command.execute(args).unwrap();
    return o;
}));

let mut out = DataObject::new();

match result {
    Ok(o) => {
        out.put_string("status", "ok");
        // o is the wrapper's packaging ({"a": <value>} for generated code;
        // a flow can return multiple named outputs). Unwrap it the way
        // format_result does, so `result` carries the command's actual
        // return value rather than the packaging.
        if command.lang == "flow" && o.clone().keys().len() > 1 {
            out.put_object("result", o);
        } else if o.has("a") {
            out.set_property("result", o.get_property("a"));
        } else {
            out.put_object("result", o);
        }
    },
    Err(e) => {
        out.put_string("status", "err");
        
        // Attempt to extract the panic message safely
        let msg = if let Some(s) = e.downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = e.downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic occurred during execution".to_string()
        };
        
        out.put_string("msg", &msg);
    }
}

out
}
