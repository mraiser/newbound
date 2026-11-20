//! Idle sessions expire (`sessiontimeoutmillis`); active ones do not.

mod common;

use common::{Client, Instance};
use std::thread;
use std::time::{Duration, Instant};

fn who(c: &mut Client) -> String {
    let u = c.get("/security/current_user").json().get_object("data");
    if u.has("id") { u.get_string("id") } else { u.get_string("username") }
}

#[test]
fn idle_sessions_expire_and_active_ones_survive() {
    // The server sweeps sessions every 5 s and drops one idle for more than
    // twice the timeout, so with 1 s an idle session goes within ~7 s.
    let inst = Instance::start_with_config(&[("sessiontimeoutmillis", "1000")]);
    let mut idle = inst.login_admin();
    let mut active = inst.login_admin();
    let idle_sid = idle.session.clone().expect("idle session id");
    assert_eq!(who(&mut idle), "admin");

    // Wait for the server to report the idle session expired. Checking it
    // with a request would keep it alive, so watch the log instead, while
    // the other session keeps making requests.
    let marker = format!("Session expired {}", idle_sid);
    let deadline = Instant::now() + Duration::from_secs(30);
    while !inst.log().contains(&marker) {
        assert!(Instant::now() < deadline, "session never expired\n--- log ---\n{}", inst.log());
        assert_eq!(who(&mut active), "admin", "an active session expired");
        thread::sleep(Duration::from_millis(250));
    }

    assert_eq!(who(&mut idle), "anonymous", "an expired session is still logged in");
    assert_eq!(who(&mut active), "admin");
}
