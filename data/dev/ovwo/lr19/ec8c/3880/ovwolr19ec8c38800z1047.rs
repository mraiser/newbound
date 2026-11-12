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

// Validate lang
// "typescript" runs in the JavaScript engine (flowlang compiles it with
// esbuild); its body and imports are stored like a JavaScript command's.
let valid_langs = ["rust", "python", "java", "javascript", "typescript", "flow"];
if !valid_langs.contains(&lang.as_str()) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Invalid language: '{}'. Must be one of {:?}", lang, valid_langs));
    return o;
}

// Validate parameter array
// List of objects with fields, "name" and "type"
// The parameter "type" should be a *flowlang* type: String, Integer, Double, Float, Boolean, JSONObject, JSONArray, Any
// The "Any" type means the parameter is wrapped in an NData type enum (DObject, DNull, DString, etc.)
let valid_param_types = ["String", "Integer", "Double", "Float", "Boolean", "JSONObject", "JSONArray", "Any"];
for i in 0..params.len() {
    let p = params.get_object(i);
    if !p.has("name") || !p.has("type") {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Parameter at index {} is missing 'name' or 'type'", i));
        return o;
    }
    let p_type = p.get_string("type");
    if !valid_param_types.contains(&p_type.as_str()) {
        let mut o = DataObject::new();
        o.put_string("status", "err");
        o.put_string("msg", &format!("Invalid parameter type '{}' for parameter '{}'. Valid types: {:?}", p_type, p.get_string("name"), valid_param_types));
        return o;
    }
}

// Validate return type
// The return type can be any valid parameter type, plus "File"
// The "File" return type is a String containing the full path to the file being returned
let mut valid_return_types = valid_param_types.to_vec();
valid_return_types.push("File");
valid_return_types.push("FLAT"); // Native to IDE
valid_return_types.push("NULL"); // Native to IDE

if !valid_return_types.contains(&return_type.as_str()) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &format!("Invalid return type '{}'. Valid types: {:?}", return_type, valid_return_types));
    return o;
}

let store = DataStore::new();
if store.exists(&lib, &ctlid) { 

  let mut o = store.get_data(&lib, &ctlid);
  let mut data_obj = o.get_object("data");
  
  let mut list = if data_obj.has("cmd") {
    data_obj.get_array("cmd")
  } else {
    DataArray::new()
  };

  let mut nuid = String::new();
  let mut rustid = String::new();
  let mut exists = false;

  for i in 0..list.len() {
    let item = list.get_object(i);
    if item.get_string("name") == cmd {
        exists = true;
        nuid = item.get_string("id");
        break;
    }
  }

  // Capture the prior records for the journal before anything is written -
  // the same {command, impl} shape delete_command journals, so `old` is what
  // a revert re-authors from. Empty for a command that does not exist yet.
  let mut j_old = String::new();
  if exists && store.exists(&lib, &nuid) {
      let mut jo = DataObject::new();
      let cd = store.get_data(&lib, &nuid).get_object("data");
      let t = if cd.has("type") { cd.get_string("type") } else { "rust".to_string() };
      let iid = if cd.has(&t) { cd.get_string(&t) } else { String::new() };
      jo.put_object("command", cd);
      if !iid.is_empty() && store.exists(&lib, &iid) { jo.put_object("impl", store.get_data(&lib, &iid).get_object("data")); }
      j_old = jo.to_string();
  }

  let mut nucmd_doc = DataObject::new();

  if !exists {
      nuid = unique_session_id();
      let mut list_item = DataObject::new();
      list_item.put_string("id", &nuid);
      list_item.put_string("name", &cmd);
      list.push_object(list_item);
      
      data_obj.put_array("cmd", list);
      o.put_object("data", data_obj);
      store.set_data(&lib, &ctlid, o);
  } else {
      if store.exists(&lib, &nuid) {
          nucmd_doc = store.get_data(&lib, &nuid).get_object("data");
          // the impl pointer lives under the record's CURRENT type key
          // (rust/python/javascript/flow) — not always "rust"
          let old_t = if nucmd_doc.has("type") { nucmd_doc.get_string("type") } else { "rust".to_string() };
          if nucmd_doc.has(&old_t) {
              rustid = nucmd_doc.get_string(&old_t);
          } else if nucmd_doc.has("rust") {
              rustid = nucmd_doc.get_string("rust");
          }
      }
  }

  if rustid.is_empty() {
      rustid = unique_session_id();
  }

  nucmd_doc.put_string("name", &cmd);
  // the command record's type and impl-pointer key follow the LANGUAGE —
  // hard-coding "rust" broke python/javascript upserts: the body landed
  // under the lang key while attachmentkeynames said "rs", so the store
  // write died on the missing 'rs' attachment
  nucmd_doc.put_string("type", &lang);
  nucmd_doc.put_string(&lang, &rustid);
  
  // Preserve an existing command's readers/writers across the upsert — the
  // meta record's readers are exactly what check_security consults, so
  // re-upserting a gated command must not reset it to admin-only. A NEW
  // command still starts with empty arrays (= admin-only until set_groups).
  let mut nu_readers = DataArray::new();
  let mut nu_writers = DataArray::new();
  if store.exists(&lib, &nuid) {
      let exmeta = store.get_data(&lib, &nuid);
      if exmeta.has("readers") { nu_readers = exmeta.get_array("readers"); }
      if exmeta.has("writers") { nu_writers = exmeta.get_array("writers"); }
  }
  data::write::write(lib.clone(), nuid.clone(), nucmd_doc, nu_readers, nu_writers);
  
  let mut nurust = if store.exists(&lib, &rustid) {
      store.get_data(&lib, &rustid).get_object("data")
  } else {
      DataObject::new()
  };
  
  let ext = if lang == "rust" { "rs" } else { &lang };
  
  // the attachment key must name the key actually written below (ext),
  // and an existing list must gain it when a command is retyped
  let mut atts = if nurust.has("attachmentkeynames") {
      nurust.get_array("attachmentkeynames")
  } else {
      DataArray::new()
  };
  let mut has_ext = false;
  for i in 0..atts.len() {
      if atts.get_string(i) == ext { has_ext = true; break; }
  }
  if !has_ext { atts.push_string(ext); }
  nurust.put_array("attachmentkeynames", atts);
  
  nurust.put_string("import", &imports);
  
  nurust.put_string(ext, &code_body);
  nurust.put_array("params", params);
  nurust.put_string("returntype", &return_type);
  nurust.put_string("type", &lang);
  
  // Same preservation for the impl record (old editcommand kept both in sync).
  let mut imp_readers = DataArray::new();
  let mut imp_writers = DataArray::new();
  if store.exists(&lib, &rustid) {
      let eximpl = store.get_data(&lib, &rustid);
      if eximpl.has("readers") { imp_readers = eximpl.get_array("readers"); }
      if eximpl.has("writers") { imp_writers = eximpl.get_array("writers"); }
  }
  data::write::write(lib.clone(), rustid.clone(), nurust, imp_readers, imp_writers);

  // What the store holds now, read back in the same shape as j_old.
  let mut jn = DataObject::new();
  jn.put_object("command", store.get_data(&lib, &nuid).get_object("data"));
  jn.put_object("impl", store.get_data(&lib, &rustid).get_object("data"));
  let j_new = jn.to_string();
  
  // Compile via a direct call: dev.dev.compile lives in this same crate, so
  // no Command indirection is needed. catch_unwind keeps a compile panic
  // reporting as a compile_error, as the indirect path did.
  let cres = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| compile(lib.clone(), ctl.clone(), cmd.clone())));

  let mut o = DataObject::new();
  match cres {
    Ok(r) => {
      // compile returns {status:"ok"|"err", msg} - msg is "OK" on success
      let txt = if r.has("msg") { r.get_string("msg") } else { r.to_string() };
      if txt == "OK" {
        o.put_string("status", "ok");
        o.put_string("msg", "OK");
      } else {
        o.put_string("status", "err");
        o.put_string("kind", "compile_error");
        o.put_string("msg", &txt);
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
      o.put_string("status", "err");
      o.put_string("kind", "compile_error");
      o.put_string("msg", &msg);
    }
  }
  // Journal the edit on the control's patch journal (facet "command", op
  // "create" or "upsert"). It runs after the store write and the compile, so the entry describes
  // what the store now holds; a journal problem is reported on the result and
  // never turns the edit into a failure. The entry carries the
  // caller-supplied label (the stated why) and the resolved author.
  if j_old != j_new {
      let mut j_entry = DataObject::new();
      j_entry.put_string("author", &author);
      j_entry.put_string("facet", "command");
      j_entry.put_string("cmd", &cmd);
      j_entry.put_string("op", if exists { "upsert" } else { "create" });
      j_entry.put_string("old", &j_old);
      j_entry.put_string("new", &j_new);
      j_entry.put_string("compile", if o.get_string("status") == "ok" { "ok" } else { "err" });
      j_entry.put_string("label", label.trim());
      let j_r = crate::dev::code::patch_journal::patch_journal("append".to_string(), lib.clone(), ctlid.clone(), String::new(), j_entry, 0, false, nn_sessionid.clone());
      if j_r.get_string("status") == "ok" {
          o.put_string("patch_id", &j_r.get_string("patch_id"));
      } else {
          o.put_string("journal_warning", &j_r.try_get_string("msg").unwrap_or_default());
      }
  }
  return o;
}

let mut o = DataObject::new();
o.put_string("status", "err");
o.put_string("msg", "No such control");
return o;