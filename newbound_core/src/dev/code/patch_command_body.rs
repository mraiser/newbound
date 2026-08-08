use flowlang::datastore::DataStore;
use flowlang::flowlang::data;
use ndata::dataobject::DataObject;
use ndata::dataarray::DataArray;
use flowlang::command::Command;

pub fn execute(o: DataObject) -> DataObject {
    use std::panic;
    for p in ["lib", "ctl", "cmd", "old_snippet", "new_snippet"] {
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
        let arg_3: String = o.get_string("old_snippet");
        let arg_4: String = o.get_string("new_snippet");
        patch_command_body(arg_0, arg_1, arg_2, arg_3, arg_4)
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

pub fn patch_command_body(lib: String, ctl: String, cmd: String, old_snippet: String, new_snippet: String) -> DataObject {
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

// In flowlang, the ID of the implementation is stored under the language name key
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
let ext = if lang == "rust" { "rs" } else { &lang };

if !impl_doc.has(&ext) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Code body for extension '{}' not found", ext));
    return o;
}

let current_code = impl_doc.get_string(&ext);

// Normalize line endings to avoid strict matching failures caused by \r\n vs \n
let normalized_current = current_code.replace("\r", "");
let normalized_old = old_snippet.replace("\r", "");

if !normalized_current.contains(&normalized_old) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", "Snippet not found. Call `read_command` to view the exact current code and try again. The snippet must match exactly, including whitespace and indentation.");
    return o;
}

// Replace the old snippet with the new snippet
let new_code = normalized_current.replace(&normalized_old, &new_snippet.replace("\r", ""));
impl_doc.put_string(&ext, &new_code);

// Save the updated implementation back to the datastore
data::write::write(lib.clone(), impl_id.clone(), impl_doc, DataArray::new(), DataArray::new());

// Compile, and report a failure in the SAME shape upsert_command and
// set_command_imports use: {status:"err", kind:"compile_error", msg}.
// Without `kind`, a client that distinguishes "stored, but did not compile"
// from "the patch itself failed" (the workbench code pane does) takes the
// wrong branch: it reports the edit as rejected and leaves its baseline
// stale, so the NEXT save computes its snippet against text the server no
// longer has and fails with "snippet not found".
// Command::lookup rather than the api struct: name resolution against the
// store survives any regeneration of api.rs (the upsert_command posture).
let compile_cmd = Command::lookup("dev", "dev", "compile");
let mut cargs = DataObject::new();
cargs.put_string("lib", &lib);
cargs.put_string("ctl", &ctl);
cargs.put_string("cmd", &cmd);

let mut out = DataObject::new();
match compile_cmd.execute(cargs) {
    Ok(r) => {
        let r = match r.try_get_object("a") { Ok(inner) => inner, _ => r };
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
out
}
