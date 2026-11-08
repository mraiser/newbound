let mut globals = DataStore::globals();
globals.put_int("PEERCHAT_TEST_HANDLE_COMMAND_PTR", crate::app::service::init::handle_command_parity_host as usize as i64);
let mut out = DataObject::new();
out.put_string("status", "ok");
out.put_boolean("linked", true);
out
