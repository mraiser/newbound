let mut ja = DataArray::new();
ja.push_string("reboot");
let o = system_call(ja);
o