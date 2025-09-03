let mut o = DataObject::new();
let mut js = "".to_string();

let x = nn_path.rfind(".").unwrap();
let nn_path = &nn_path[14..x];
let mut sa = nn_path.split("/");
let lib = sa.nth(0).unwrap();
let id = sa.nth(0).unwrap();

let store = DataStore::new();
if store.exists(lib, id) {
  let ctl = store.get_data(lib, id).get_object("data");
  if ctl.has("cmd") {
    let cmds = ctl.get_array("cmd");
    for cmd in cmds.objects(){
      let cmd = cmd.object();
      let ocmdid = cmd.get_string("id");
      let name = cmd.get_string("name");
      let cmd = store.get_data(lib, &ocmdid).get_object("data");
      let lang = cmd.try_get_string("type").unwrap_or(cmd.try_get_string("lang").unwrap_or("java".to_string()));
      let cmdid = cmd.get_string(&lang);
      let cmd = store.get_data(lib, &cmdid).get_object("data");
      let params;
      if cmd.has("params") { params = cmd.get_array("params"); }
      else { params = DataArray::new(); }

      js += "function send_";
      js += &name;
      js += "(";

      let mut args = "{".to_string();
      for p in params.objects(){
        let p = p.object();
        // FIXME
        if let Ok(typ) = p.try_get_string("type") {
          if typ != "Bot" && typ != "Data" {
            let n = &p.get_string("name");
            js += n;
            js += ", ";
            if args != "{" { args += ", "; }
            args += n;
            args += ": ";
            args += n;
          }
        }
      }
      args += "}";

      js += "xxxxxcb, xxxxxpeer){\n";
      js += "  var args = ";
      js += &args;
      js += ";\n";
      js += "  var xxxprefix = xxxxxpeer ? '../peer/remote/'+xxxxxpeer+'/' : '../';\n";
      js += "  args = encodeURIComponent(JSON.stringify(args));\n";
      js += "  json(xxxprefix+'app/exec', 'lib=";
      js += &hex_encode(lib.to_string());
      js += "&id=";
      js += &hex_encode(ocmdid);
      js += "&args='+args, function(result){\n    if (typeof xxxxxcb == 'function') xxxxxcb(result);\n  });\n";
      js += "}\n";
    }
  }
}

o.put_string("js", &js);
o