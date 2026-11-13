// An empty author defaults to the calling session's user - the platform
// injects nn_sessionid into params on every web call (HTTP and websocket
// alike); CLI/MCP callers that want a specific provenance name pass author.
// Same rule as patch_control_facet and delete_command.
let author = {
    let a = author.trim().to_string();
    if !a.is_empty() { a } else {
        let mut who = String::new();
        if !nn_sessionid.is_empty() {
            let system = flowlang::datastore::DataStore::globals().get_object("system");
            if system.has("sessions") {
                let sessions = system.get_object("sessions");
                if sessions.has(&nn_sessionid) {
                    let session = sessions.get_object(&nn_sessionid);
                    if session.has("user") {
                        who = session.get_object("user").try_get_string("displayname").unwrap_or_default();
                    }
                    if who.trim().is_empty() {
                        who = session.try_get_string("username").unwrap_or_default();
                    }
                }
            }
        }
        if who.trim().is_empty() { "anonymous".to_string() } else { who }
    }
};

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

// Save the updated implementation back to the datastore, PRESERVING the
// record's existing readers/writers: data::write::write stamps whatever it
// is passed, and a code edit must not reset a gated command to admin-only
// (the arrays dev.code.set_groups derives from the groups string).
let ex = store.get_data(&lib, &impl_id);
let ex_readers = if ex.has("readers") { ex.get_array("readers") } else { DataArray::new() };
let ex_writers = if ex.has("writers") { ex.get_array("writers") } else { DataArray::new() };
data::write::write(lib.clone(), impl_id.clone(), impl_doc, ex_readers, ex_writers);

// Compile, and report a failure in the SAME shape upsert_command and
// set_command_imports use: {status:"err", kind:"compile_error", msg}.
// Without `kind`, a client that distinguishes "stored, but did not compile"
// from "the patch itself failed" (the workbench code pane does) takes the
// wrong branch: it reports the edit as rejected and leaves its baseline
// stale, so the NEXT save computes its snippet against text the server no
// longer has and fails with "snippet not found".
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
// Journal the edit on the control's patch journal (facet "command", op
// "patch"). It runs after the store write and the compile, so the entry describes
// what the store now holds; a journal problem is reported on the result and
// never turns the edit into a failure. The entry carries the
// caller-supplied label (the stated why) and the resolved author.
if normalized_old != new_snippet.replace("\r", "") {
    let mut j_entry = DataObject::new();
    j_entry.put_string("author", &author);
    j_entry.put_string("facet", "command");
    j_entry.put_string("cmd", &cmd);
    j_entry.put_string("op", "patch");
    j_entry.put_string("old", &normalized_old);
    j_entry.put_string("new", &new_snippet.replace("\r", ""));
    j_entry.put_string("compile", if out.get_string("status") == "ok" { "ok" } else { "err" });
    j_entry.put_string("label", label.trim());
    let j_r = crate::dev::code::patch_journal::patch_journal("append".to_string(), lib.clone(), ctlid.clone(), String::new(), j_entry, 0, false, nn_sessionid.clone());
    if j_r.get_string("status") == "ok" {
        out.put_string("patch_id", &j_r.get_string("patch_id"));
    } else {
        out.put_string("journal_warning", &j_r.try_get_string("msg").unwrap_or_default());
    }
}
out