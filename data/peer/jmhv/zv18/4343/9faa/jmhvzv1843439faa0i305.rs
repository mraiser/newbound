let os = std::env::consts::OS;
let plan = reboot_plan(os);

let system = DataStore::globals().get_object("system");
let mut dryrun = false;
if system.has("config") {
  let config = system.get_object("config");
  if config.has("reboot_dryrun") {
    dryrun = config.get_string("reboot_dryrun").trim() == "true";
  }
}
if dryrun {
  let mut out = DataObject::new();
  out.put_string("status", "ok");
  out.put_boolean("dryrun", true);
  let mut jplan = DataArray::new();
  for argv in &plan {
    let mut jcmd = DataArray::new();
    for part in argv { jcmd.push_string(part); }
    jplan.push_array(jcmd);
  }
  out.put_array("plan", jplan);
  out.put_string("os", os);
  return out;
}

let mut attempts: Vec<(String, i64, String)> = Vec::new();
for argv in &plan {
  let shown = argv.join(" ");
  let (code, err) = run_attempt(argv, 10);
  if code == 0 {
    let mut out = DataObject::new();
    out.put_string("status", "ok");
    out.put_string("method", &shown);
    return out;
  }
  attempts.push((shown, code, err));
}

let mut out = DataObject::new();
out.put_string("status", "err");
out.put_string("msg", &failure_message(os, &machine_name(), &attempts));
let mut jatt = DataArray::new();
for (cmd, code, err) in &attempts {
  let mut a = DataObject::new();
  a.put_string("cmd", cmd);
  a.put_int("code", *code);
  a.put_string("err", err);
  jatt.push_object(a);
}
out.put_array("attempts", jatt);
out