if !flowlang::datastore::DataStore::globals().get_object("system").get_object("libraries").has(&lib) {
  let mut o = DataObject::new();
  o.put_string("status", "err");
  o.put_string("msg", &format!("NO SUCH LIBRARY: {}", lib));
  return o;
}
if check_auth(&lib, &id, &nn_sessionid, false) {
  let mut args = args.clone();
  args.put_string("nn_sessionid", &nn_sessionid);
  let command = Command::new(&lib, &id);
  // Arguments that do not fit the declared types are the caller's error, not a panic.
  if let Err(m) = command.try_cast_params(args.clone()) {
    let mut o = DataObject::new();
    o.put_string("status", "err");
    o.put_string("msg", &m);
    return o;
  }
  let result = panic::catch_unwind(|| {
    match command.execute(args) {
      Ok(o) => format_result(command, o),
      // A failed flow: {status: "err", msg: what failed and where, flow_error: the details}.
      Err(e) => e.to_envelope(),
    }
  });

  match result {
    Ok(x) => return x,
    Err(e) => {
      let s = match e.downcast::<String>() {
      Ok(panic_msg) => format!("{}", panic_msg),
      Err(_) => "unknown error".to_string()
    };        

    let mut o = DataObject::new();
    let s = format!("<html><head><title>500 - Server Error</title></head><body><h2>500</h2>Server Error: {}</body></html>", s);
    o.put_string("body", &s);
    o.put_int("code", 500);
    o.put_string("mimetype", "text/html");
    o.put_string("status", "err");
    o.put_string("msg", &s);
    return o;
  }
}
    
}
DataObject::from_string("{\"status\":\"err\",\"msg\":\"UNAUTHORIZED\"}")