let mut ja = DataArray::new();

#[cfg(debug_assertions)]
let bin = "target/debug/newbound";

#[cfg(not(debug_assertions))]
let bin = "target/release/newbound";

ja.push_string(&bin);

ja.push_string("exec");
ja.push_string(&lib);
ja.push_string(&ctl);
ja.push_string(&cmd);
ja.push_string(&args.to_string());

system_call(ja)