let b = remove_timer(&id);
if b { return "OK".to_string(); }
format!("Not found: {}", id)