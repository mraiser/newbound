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
  
  data::write::write(lib.clone(), nuid.clone(), nucmd_doc, DataArray::new(), DataArray::new());
  
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
  
  data::write::write(lib.clone(), rustid.clone(), nurust, DataArray::new(), DataArray::new());
  
  // Compile via Command rather than the typed api: survives regeneration of the
  // dev library under any wrapper template, and reads the result defensively.
  let compile_cmd = Command::lookup("dev", "dev", "compile");
  let mut cargs = DataObject::new();
  cargs.put_string("lib", &lib);
  cargs.put_string("ctl", &ctl);
  cargs.put_string("cmd", &cmd);

  let mut o = DataObject::new();
  match compile_cmd.execute(cargs) {
    Ok(r) => {
      let r = match r.try_get_object("a") {
        Ok(inner) => inner,
        _ => r
      };
      
      // Possible shapes, in order of likelihood:
      //  - wrapper-caught panic (current dev template after regen): {"status":"err","msg":<errors>}
      //  - plain String packaging: {"a": "OK"} or {"a": <error text>}  (new compile body returns errors as text)
      //  - anything else: serialize and inspect
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
        o.put_string("status", "ok");
        o.put_string("msg", "OK");
      } else {
        o.put_string("status", "err");
        o.put_string("kind", "compile_error");
        o.put_string("msg", &txt);
      }
    },
    Err(e) => {
      o.put_string("status", "err");
      o.put_string("kind", "compile_error");
      o.put_string("msg", &format!("{:?}", e));
    }
  }
  return o;
}

let mut o = DataObject::new();
o.put_string("status", "err");
o.put_string("msg", "No such control");
return o;