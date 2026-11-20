//! Checks the test harness itself: an instance boots in its own directory
//! on its own port, answers HTTP, and leaves nothing behind when dropped.

mod common;

use common::Instance;
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

#[test]
fn instance_boots_answers_and_cleans_up() {
    let mut inst = Instance::start();
    let dir = inst.dir.clone();
    let port = inst.port;

    // Disposable: under the system temp dir, never inside the checkout.
    assert!(dir.starts_with(std::env::temp_dir()), "{} is not under the temp dir", dir.display());
    assert!(!dir.starts_with(common::repo_root()));
    assert!(dir.join("data").join("app").is_dir());
    assert!(dir.join("users").join("admin.properties").is_file());
    assert!(port > 0);
    assert!(inst.is_running());

    let r = inst.client().get("/");
    assert_eq!(r.status, 302, "GET / should redirect to the default app");

    drop(inst);

    assert!(!dir.exists(), "{} was not removed", dir.display());
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    assert!(
        TcpStream::connect_timeout(&addr, Duration::from_secs(2)).is_err(),
        "port {} still accepts connections after drop",
        port
    );
}

#[test]
fn instances_are_independent() {
    let a = Instance::start();
    let b = Instance::start();
    assert_ne!(a.dir, b.dir);
    assert_ne!(a.port, b.port);
    assert_ne!(a.admin_password, b.admin_password);
    assert_ne!(a.admin_password, a.user_password);

    // A session cookie from one instance means nothing to the other.
    let mut ca = a.login_admin();
    let mut cb = b.client();
    cb.session = ca.session.clone();
    let on_a = ca.get("/security/current_user").json();
    let on_b = cb.get("/security/current_user").json();
    assert_eq!(on_a.get_object("data").get_string("id"), "admin");
    assert_eq!(on_b.get_object("data").get_string("username"), "anonymous");
}

#[test]
fn fixture_users_log_in() {
    let inst = Instance::start();
    let mut admin = inst.login_admin();
    let mut user = inst.login_user();
    let a = admin.get("/security/current_user").json().get_object("data");
    let u = user.get("/security/current_user").json().get_object("data");
    assert_eq!(a.get_string("id"), "admin");
    assert_eq!(u.get_string("id"), common::USER);
    assert_eq!(u.get_array("groups").get_string(0), common::USER_GROUP);
}
