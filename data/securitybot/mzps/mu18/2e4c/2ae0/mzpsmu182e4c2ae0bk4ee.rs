let mut jo = DataObject::new();
let store = DataStore::new();
let system = DataStore::globals().get_object("system");
let apps = system.get_object("apps");
for (appid, appdata) in apps.objects() {
  let appdata = appdata.object().get_object("app");
  let mut app = DataObject::new();
  app.put_str("id", &appid);
  app.put_bool("forsale", appdata.get_string("forsale") == "true");
  app.put_str("name", &appdata.get_string("name"));
  app.put_str("desc", &appdata.get_string("desc"));
  let ctldb = appdata.get_string("ctldb");
  let ctlid = appdata.get_string("ctlid");
  let ctl = store.get_data(&ctldb, &ctlid).get_object("data");
  let cmds = ctl.get_array("cmd");
  let mut o = DataObject::new();
  for cmd in cmds.objects(){
    let cmd = cmd.object();
    //let cmdname = cmd.get_string("name");
    let cmdid = cmd.get_string("id");
    let cmd = store.get_data(&ctldb, &cmdid);
    
    let mut c = DataObject::new();
    
    if cmd.has("readers") { 
      let r = cmd.get_array("readers");
      let mut groups = "".to_string();
      for g in r.objects() {
        if groups != "" { groups += ","; }
        groups += &g.string();
      }
      c.put_array("include", r);
      c.put_str("groups", &groups);
    }
    
    
    let data = cmd.get_object("data");
    let typ = &data.get_string("type");
    let name = &data.get_string("name");
    
    let codename = &data.get_string(typ);
    let code = store.get_data(&ctldb, codename).get_object("data");
    if code.has("desc") { c.put_str("desc", &code.get_string("desc")); }
    
    let p = &code.get_array("params");
    let mut params = DataArray::new();
    for d in p.objects() {
      let d = d.object();
      let a = d.get_string("name");
      params.push_str(&a);
    }
    c.put_array("parameters", params);
    

    o.put_object(&name, c);
  }
  app.put_object("commands", o);
  jo.put_object(&appid, app);
}
jo