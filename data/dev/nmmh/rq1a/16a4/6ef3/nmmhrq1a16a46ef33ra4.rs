// Open a debug session (flow step debugger P3) on lib.ctl.cmd. body = the flow's root Case JSON to debug - an
// UNSAVED editor body is allowed (admin-only, like any code edit); pass {} to debug the SAVED body. args = the
// flow's arguments, raw (the stepper does no cast_params). Returns the session id and the view at cursor 0.
fn err(msg: &str) -> DataObject { let mut o = DataObject::new(); o.put_string("status", "err"); o.put_string("msg", msg); o }
let mut b = body.clone();
if !(b.has("cmds") && b.get_property("cmds").is_array()) {
  let mut a = DataObject::new(); a.put_string("lib", &lib); a.put_string("ctl", &ctl); a.put_string("cmd", &cmd);
  let (l, c, m) = (lib.clone(), ctl.clone(), cmd.clone());
  let r = match panic::catch_unwind(panic::AssertUnwindSafe(move || Command::lookup("dev", "code", "read_flow_body").execute(a))) {
    Ok(Ok(r)) => { if r.has("a") && r.clone().keys().len() == 1 && r.get_property("a").is_object() { r.get_object("a") } else { r } }
    _ => return err(&format!("could not read the saved flow body of {}.{}.{}", l, c, m)),
  };
  if !(r.has("body") && r.get_property("body").is_object()) || (r.has("exists") && r.get_property("exists").is_boolean() && !r.get_boolean("exists")) {
    let msg = if r.has("msg") { r.get_string("msg") } else { "no saved body".to_string() };
    return err(&format!("{}.{}.{} has no flow body to debug ({}); pass the editor body instead", lib, ctl, cmd, msg));
  }
  b = r.get_object("body");
}
let mut pick = DataObject::new();
pick.put_string("lib", &lib); pick.put_string("ctl", &ctl); pick.put_string("cmd", &cmd);
pick.put_object("body", b); pick.put_object("args", args);
super::debug_step::debug_step(String::new(), "init".to_string(), pick)