if !log_in(&nn_sessionid, &user, &pass) { panic!("UNAUTHORIZED: {}", user); }
format!("You are now logged in\", \"sessionid\": \"{}", nn_sessionid)