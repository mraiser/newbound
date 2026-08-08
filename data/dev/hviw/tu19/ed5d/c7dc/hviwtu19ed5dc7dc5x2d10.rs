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
        // Inject the native flowlang Data return value into the result object
        out.put_object("result", o);
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