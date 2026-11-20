//! HTTP Basic authentication (`basicauth=true`): valid credentials stand
//! for a logged-in session without cookies; anything else stays anonymous.

mod common;

use common::{Client, Instance};

fn base64(input: &str) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let b = input.as_bytes();
    let mut out = String::new();
    for chunk in b.chunks(3) {
        let n = (chunk[0] as u32) << 16 | (*chunk.get(1).unwrap_or(&0) as u32) << 8 | *chunk.get(2).unwrap_or(&0) as u32;
        for i in 0..4 {
            if i <= chunk.len() {
                out.push(T[(n >> (18 - 6 * i) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

/// Who `security/current_user` says this request is, sent with
/// `Authorization` and no cookie.
fn who_with(inst: &Instance, authorization: &str) -> (String, Option<String>) {
    let mut c: Client = inst.client();
    let r = c.request("GET", "/security/current_user", &[("Authorization", authorization)], None);
    assert_eq!(r.status, 200, "{}", r.text());
    let u = r.json().get_object("data");
    let who = if u.has("id") { u.get_string("id") } else { u.get_string("username") };
    (who, r.cookie("sessionid"))
}

#[test]
fn base64_helper_matches_rfc_4648() {
    assert_eq!(base64("f"), "Zg==");
    assert_eq!(base64("fo"), "Zm8=");
    assert_eq!(base64("foo"), "Zm9v");
    assert_eq!(base64("foobar"), "Zm9vYmFy");
}

#[test]
fn valid_credentials_log_in_without_a_cookie() {
    let inst = Instance::start_with_config(&[("basicauth", "true")]);
    let auth = format!("Basic {}", base64(&format!("admin:{}", inst.admin_password)));

    let (who, first) = who_with(&inst, &auth);
    assert_eq!(who, "admin");
    // Cookie-less clients (mount tools) reuse one session per user.
    let (who, second) = who_with(&inst, &auth);
    assert_eq!(who, "admin");
    assert!(first.is_some());
    assert_eq!(first, second, "each Basic request minted a new session");

    let user_auth = format!("Basic {}", base64(&format!("{}:{}", common::USER, inst.user_password)));
    assert_eq!(who_with(&inst, &user_auth).0, common::USER);
}

#[test]
fn bad_credentials_stay_anonymous() {
    let inst = Instance::start_with_config(&[("basicauth", "true")]);
    for auth in [
        format!("Basic {}", base64("admin:wrong")),
        format!("Basic {}", base64("nobody:x")),
        format!("Basic {}", base64("admin:")),
        "Basic !!!not-base64!!!".to_string(),
        format!("Bearer {}", inst.admin_password),
    ] {
        assert_eq!(who_with(&inst, &auth).0, "anonymous", "{:?} was accepted", auth);
    }
}

#[test]
fn basic_auth_is_off_unless_configured() {
    let inst = Instance::start();
    let auth = format!("Basic {}", base64(&format!("admin:{}", inst.admin_password)));
    assert_eq!(who_with(&inst, &auth).0, "anonymous");
}
