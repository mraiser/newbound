//! Request bodies: each way a client can POST parameters reaches the
//! command, and malformed framing gets the right HTTP error.
//! `app/login` is the probe: it succeeds only if `user` and `pass` arrive.

mod common;

use common::{Client, Instance, USER};

fn logged_in_as(c: &mut Client) -> String {
    let u = c.get("/security/current_user").json().get_object("data");
    if u.has("id") { u.get_string("id") } else { u.get_string("username") }
}

/// Logs in with every body encoding, each on a fresh client.
fn login_each_way(inst: &Instance, pass: &str) -> Vec<(&'static str, Client, String)> {
    let json = format!(r#"{{"user":"{}","pass":"{}"}}"#, USER, pass);
    let (first, second) = json.split_at(json.len() / 2);
    let mut out = Vec::new();
    for how in ["json", "form", "multipart", "chunked json"] {
        let mut c = inst.client();
        let r = match how {
            "json" => c.post_json("/app/login", &json),
            "form" => c.post_form("/app/login", &[("user", USER), ("pass", pass)]),
            "multipart" => c.post_multipart("/app/login", &[("user", USER), ("pass", pass)]),
            _ => c.post_chunked_json("/app/login", &[first, second]),
        };
        assert_eq!(r.status, 200, "{} POST: HTTP {}: {}", how, r.status, r.text());
        let status = r.json().get_string("status");
        out.push((how, c, status));
    }
    out
}

#[test]
fn post_bodies_deliver_parameters() {
    let inst = Instance::start();
    let pw = inst.user_password.clone();
    for (how, mut c, status) in login_each_way(&inst, &pw) {
        assert_eq!(status, "ok", "login by {} POST failed", how);
        assert_eq!(logged_in_as(&mut c), USER, "{} POST", how);
    }
}

#[test]
fn post_bodies_with_a_wrong_password_fail() {
    let inst = Instance::start();
    for (how, mut c, status) in login_each_way(&inst, "wrong-password") {
        assert_eq!(status, "err", "login by {} POST succeeded with a wrong password", how);
        assert_eq!(logged_in_as(&mut c), "anonymous", "{} POST", how);
    }
}

#[test]
fn malformed_framing_gets_an_http_error() {
    let inst = Instance::start();
    let host = format!("Host: 127.0.0.1:{}\r\nConnection: close\r\n", inst.port);
    let cases: [(&str, String, u16); 4] = [
        (
            "bad chunk size",
            format!("POST /app/login HTTP/1.1\r\n{}Transfer-Encoding: chunked\r\n\r\nzz\r\n", host),
            400,
        ),
        (
            "unsupported transfer coding",
            format!("POST /app/login HTTP/1.1\r\n{}Transfer-Encoding: gzip\r\n\r\n", host),
            501,
        ),
        (
            "body over the size limit",
            format!(
                "POST /app/login HTTP/1.1\r\n{}Content-Type: application/json\r\nContent-Length: 70000000\r\n\r\n",
                host
            ),
            413,
        ),
        (
            "non-numeric Content-Length",
            format!("POST /app/login HTTP/1.1\r\n{}Content-Type: application/json\r\nContent-Length: abc\r\n\r\n", host),
            400,
        ),
    ];
    for (what, req, code) in cases {
        let r = inst.client().raw(req.as_bytes());
        assert_eq!(r.status, code, "{}: HTTP {}: {}", what, r.status, r.text());
    }
    // The server is still serving afterwards.
    assert_eq!(inst.client().get("/").status, 302);
}
