//! Commands over a WebSocket (`cmd {...}` messages): the handshake, the
//! session the socket carries, the same permission checks as HTTP, and
//! replies matched to requests by `pid`.

mod common;

use common::{Instance, USER};

#[test]
fn anonymous_socket_runs_open_commands() {
    let inst = Instance::start();
    let mut ws = inst.client().websocket();
    let r = ws.command("security", "current_user", "{}", 7);
    assert_eq!(r.get_string("status"), "ok", "{}", r.to_string());
    assert_eq!(r.get_int("pid"), 7);
    assert_eq!(r.get_object("data").get_string("username"), "anonymous");

    let apps = ws.command("app", "apps", "{}", 8);
    assert_eq!(apps.get_string("status"), "ok");
    assert!(apps.get_array("data").len() > 0);
}

#[test]
fn socket_carries_the_logged_in_session() {
    let inst = Instance::start();
    let mut ws = inst.login_admin().websocket();
    let r = ws.command("security", "current_user", "{}", 1);
    assert_eq!(r.get_object("data").get_string("id"), "admin");
    let libs = ws.command("app", "libs", "{}", 2);
    assert_eq!(libs.get_string("status"), "ok", "{}", libs.to_string());
}

#[test]
fn socket_commands_obey_permissions() {
    let inst = Instance::start();
    for (who, mut c) in [("anonymous", inst.client()), (USER, inst.login_user())] {
        let mut ws = c.websocket();
        for (i, (app, cmd)) in [("app", "libs"), ("security", "users")].into_iter().enumerate() {
            let r = ws.command(app, cmd, "{}", i as i64 + 1);
            assert_eq!(r.get_string("status"), "err", "{}.{} as {}: {}", app, cmd, who, r.to_string());
            assert!(r.get_string("msg").starts_with("UNAUTHORIZED"), "{}", r.to_string());
            assert!(!r.has("data"));
        }
    }
}

#[test]
fn unknown_socket_command_is_an_error() {
    let inst = Instance::start();
    let mut ws = inst.client().websocket();
    let r = ws.command("app", "no_such_command", "{}", 3);
    assert_eq!(r.get_string("status"), "err");
    assert!(r.get_string("msg").starts_with("Unknown command"), "{}", r.to_string());
}

#[test]
fn replies_are_matched_by_pid() {
    // Commands run concurrently; replies may come back in any order.
    let inst = Instance::start();
    let mut ws = inst.login_admin().websocket();
    for pid in 1..=10 {
        ws.send_text(&format!(r#"cmd {{"bot":"security","cmd":"current_user","pid":{},"params":{{}}}}"#, pid));
    }
    let mut seen = Vec::new();
    for _ in 1..=10 {
        let o = ndata::dataobject::DataObject::from_string(&ws.recv_text());
        assert_eq!(o.get_string("status"), "ok");
        assert_eq!(o.get_object("data").get_string("id"), "admin");
        seen.push(o.get_int("pid"));
    }
    seen.sort();
    assert_eq!(seen, (1..=10).collect::<Vec<i64>>());
}
