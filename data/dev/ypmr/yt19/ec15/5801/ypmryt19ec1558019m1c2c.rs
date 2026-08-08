let store = DataStore::new();
let real_id = crate::api::new().dev.editcontrol.lookup_id(lib.clone(), ctl.clone());
let ctlobj = store.get_data(&lib, &real_id).get_object("data");
let cmds = if ctlobj.has("cmd") { ctlobj.get_array("cmd") } else { DataArray::new() };

let mut out = DataArray::new();

for o in cmds.objects() {
  let mut o = o.object();
  //let id = o.get_string("id");
  //let cmdobj = store.get_data(&lib, &id).get_object("data");
  //out.push_object(cmdobj);
  
  
  let cmd = o.get_string("name");
  //out.push_string(&cmd);
  
  let toolname = format!("{}-{}-{}", &lib, &ctl, &cmd);
  let tool = describe(toolname);
  out.push_object(tool);
}

out