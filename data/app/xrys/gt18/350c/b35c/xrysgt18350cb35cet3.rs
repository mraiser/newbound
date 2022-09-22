let b = remove_event_listener(&id);
if b { return "OK".to_string(); }
format!("Not found: {}", id)