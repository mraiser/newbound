use ndata::dataobject::DataObject;
use flowlang::datastore::DataStore;
use flowlang::flowlang::data;
use flowlang::command::Command;
use ndata::dataarray::DataArray;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "cmd", "imports"] {
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
        let arg_3: String = o.get_string("imports");
        set_command_imports(arg_0, arg_1, arg_2, arg_3)
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

pub fn set_command_imports(lib: String, ctl: String, cmd: String, imports: String) -> DataObject {
// Replace a text command's file-level import block (the impl record's
// `import` field) and recompile — patch_command_body's sibling for the one
// section the body patch cannot reach. Flow commands have no import field
// and are refused. Unjournaled like patch_command_body: the compile result
// is the outcome, canon's git history is the record.
let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

let store = DataStore::new();
if !store.exists(&lib, &ctlid) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "No such control");
    return o;
}

let mut o = store.get_data(&lib, &ctlid);
let data_obj = o.get_object("data");

let list = if data_obj.has("cmd") {
    data_obj.get_array("cmd")
} else {
    DataArray::new()
};

let mut cmd_id = String::new();
for i in 0..list.len() {
    let item = list.get_object(i);
    if item.get_string("name") == cmd {
        cmd_id = item.get_string("id");
        break;
    }
}

if cmd_id.is_empty() {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Command '{}' not found in control '{}'", cmd, ctl));
    return o;
}

if !store.exists(&lib, &cmd_id) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Command metadata not found in datastore");
    return o;
}

let cmd_doc = store.get_data(&lib, &cmd_id).get_object("data");
let lang = if cmd_doc.has("type") { cmd_doc.get_string("type") } else { "rust".to_string() };

if lang == "flow" {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Flow commands have no import section (use write_flow_body)");
    return o;
}

if !cmd_doc.has(&lang) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Implementation ID for language '{}' not found", lang));
    return o;
}
let impl_id = cmd_doc.get_string(&lang);

if !store.exists(&lib, &impl_id) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Implementation file not found in datastore");
    return o;
}

let mut impl_doc = store.get_data(&lib, &impl_id).get_object("data");
let old_imports = if impl_doc.has("import") { impl_doc.get_string("import") } else { "".to_string() };
impl_doc.put_string("import", &imports.replace("\r", ""));

data::write::write(lib.clone(), impl_id.clone(), impl_doc, DataArray::new(), DataArray::new());

// Compile via Command rather than the typed api: survives regeneration of
// the dev library under any wrapper template (the upsert_command posture).
let compile_cmd = Command::lookup("dev", "dev", "compile");
let mut cargs = DataObject::new();
cargs.put_string("lib", &lib);
cargs.put_string("ctl", &ctl);
cargs.put_string("cmd", &cmd);

let mut out = DataObject::new();
match compile_cmd.execute(cargs) {
    Ok(r) => {
        let r = match r.try_get_object("a") {
            Ok(inner) => inner,
            _ => r
        };
        let txt = if r.has("status") && r.get_string("status") == "err" {
            if r.has("msg") { r.get_string("msg") } else { r.to_string() }
        } else if r.has("a") {
            r.get_string("a")
        } else if r.has("msg") {
            r.get_string("msg")
        } else {
            r.to_string()
        };
        if txt == "OK" {
            out.put_string("status", "ok");
            out.put_string("msg", "OK");
        } else {
            out.put_string("status", "err");
            out.put_string("kind", "compile_error");
            out.put_string("msg", &txt);
        }
    },
    Err(e) => {
        out.put_string("status", "err");
        out.put_string("kind", "compile_error");
        out.put_string("msg", &format!("{:?}", e));
    }
}
out.put_string("old_imports", &old_imports);
out
}
