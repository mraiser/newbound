let mut globals = DataStore::globals();
globals.put_int("PEERCHAT_TEST_HANDLE_COMMAND_PTR", handle_command as usize as i64);
let result = Command::lookup("peerchat", "peerchat", "transport_parity_selftest").execute(DataObject::new());
globals.remove_property("PEERCHAT_TEST_HANDLE_COMMAND_PTR");
match result {
    Ok(value) => value,
    Err(e) => {
        let mut out = DataObject::new();
        out.put_string("status", "err");
        out.put_string("msg", &e.to_string());
        out
    }
}