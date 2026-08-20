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

// Preserve the record's existing readers/writers — data::write::write stamps
// whatever it is passed, and an imports edit must not reset a gated command
// to admin-only (the arrays dev.code.set_groups derives).
let ex = store.get_data(&lib, &impl_id);
let ex_readers = if ex.has("readers") { ex.get_array("readers") } else { DataArray::new() };
let ex_writers = if ex.has("writers") { ex.get_array("writers") } else { DataArray::new() };
data::write::write(lib.clone(), impl_id.clone(), impl_doc, ex_readers, ex_writers);

// Direct call: dev.dev.compile lives in this same crate, so no Command
// indirection is needed. catch_unwind keeps a compile panic reporting as a
// compile_error, as the indirect path did.
let cres = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| compile(lib.clone(), ctl.clone(), cmd.clone())));

let mut out = DataObject::new();
match cres {
    Ok(r) => {
        // compile returns {status:"ok"|"err", msg} - msg is "OK" on success
        let txt = if r.has("msg") { r.get_string("msg") } else { r.to_string() };
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
        let msg = if let Some(s) = e.downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = e.downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic occurred".to_string()
        };
        out.put_string("status", "err");
        out.put_string("kind", "compile_error");
        out.put_string("msg", &msg);
    }
}
out.put_string("old_imports", &old_imports);
out