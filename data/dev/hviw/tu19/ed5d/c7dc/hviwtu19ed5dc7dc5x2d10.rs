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