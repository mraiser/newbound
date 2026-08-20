let api = crate::api::new();
let ctlid = api.dev.editcontrol.lookup_id(lib.clone(), ctl.clone());

// Validate lang
let valid_langs = ["rust", "python", "java", "javascript", "flow"];
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
          if nucmd_doc.has("rust") {
              rustid = nucmd_doc.get_string("rust");
          }
      }
  }

  if rustid.is_empty() {
      rustid = unique_session_id();
  }

  nucmd_doc.put_string("name", &cmd);
  nucmd_doc.put_string("type", "rust");
  nucmd_doc.put_string("rust", &rustid);
  
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
  
  if !nurust.has("attachmentkeynames") {
      let mut a = DataArray::new();
      a.push_string("rs");
      nurust.put_array("attachmentkeynames", a);
  }
  
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
  return o;
}

let mut o = DataObject::new();
o.put_string("status", "err");
o.put_string("msg", "No such control");
return o;