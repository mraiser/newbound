//! Commands that change data, each on its own disposable instance: they
//! work for admin, are refused to everyone else (and then change nothing),
//! and write only into the instance's copy, never the checkout.

mod common;

use common::{command_id, Client, Instance, Response, USER, USER_GROUP};
use ndata::dataobject::DataObject;

fn status(r: &Response, what: &str) -> DataObject {
    assert_eq!(r.status, 200, "{}: HTTP {}: {}", what, r.status, r.text());
    r.json()
}

fn assert_ok(r: &Response, what: &str) -> DataObject {
    let j = status(r, what);
    assert_eq!(j.get_string("status"), "ok", "{}: {}", what, r.text());
    j
}

fn assert_denied(r: &Response, what: &str) {
    let j = status(r, what);
    assert_eq!(j.get_string("status"), "err", "{} should be denied: {}", what, r.text());
    assert!(j.get_string("msg").starts_with("UNAUTHORIZED"), "{}: {}", what, r.text());
}

fn try_login(inst: &Instance, user: &str, pass: &str) -> String {
    let mut c = inst.client();
    c.post_json("/app/login", &format!(r#"{{"user":"{}","pass":"{}"}}"#, user, pass))
        .json()
        .get_string("status")
}

// ---------------------------------------------------------------- users

#[test]
fn admin_creates_and_deletes_a_user() {
    let inst = Instance::start();
    let mut admin = inst.login_admin();
    let file = inst.dir.join("users").join("newbie.properties");

    let j = assert_ok(
        &admin.post_json(
            "/security/setuser",
            &format!(r#"{{"id":"newbie","displayname":"New","password":"pw-newbie","groups":["{}"]}}"#, USER_GROUP),
        ),
        "setuser",
    );
    assert_eq!(j.get_object("data").get_string("id"), "newbie");
    assert!(file.is_file(), "setuser did not write {}", file.display());
    assert!(!common::repo_root().join("users").join("newbie.properties").exists());

    let users = assert_ok(&admin.get("/security/users"), "users").get_object("data");
    assert!(users.has("newbie"), "users lacks newbie: {}", users.to_string());

    assert_eq!(try_login(&inst, "newbie", "pw-newbie"), "ok");
    assert_eq!(try_login(&inst, "newbie", "wrong"), "err");

    assert_ok(&admin.get("/security/deleteuser?id=newbie"), "deleteuser");
    assert!(!file.exists(), "deleteuser left {}", file.display());
    assert_eq!(try_login(&inst, "newbie", "pw-newbie"), "err", "a deleted user can still log in");
    let users = assert_ok(&admin.get("/security/users"), "users").get_object("data");
    assert!(!users.has("newbie"));
}

#[test]
fn only_admin_manages_users() {
    let inst = Instance::start();
    let body = r#"{"id":"intruder","displayname":"X","password":"pw-intruder","groups":["admin"]}"#;
    for (who, mut c) in [("anonymous", inst.client()), (USER, inst.login_user())] {
        assert_denied(&c.post_json("/security/setuser", body), &format!("setuser as {}", who));
        assert_denied(&c.get(&format!("/security/deleteuser?id={}", USER)), &format!("deleteuser as {}", who));
    }
    assert!(!inst.dir.join("users").join("intruder.properties").exists());
    assert_eq!(try_login(&inst, "intruder", "pw-intruder"), "err");
    assert_eq!(try_login(&inst, USER, &inst.user_password), "ok", "the fixture user was deleted");
}

// ---------------------------------------------------------------- records

fn write_record(c: &mut Client, id: &str, readers: &str) -> Response {
    c.post_json(
        "/app/write",
        &format!(r#"{{"lib":"app","id":"{}","data":{{"x":42}},"readers":{},"writers":[]}}"#, id, readers),
    )
}

fn read_record(c: &mut Client, id: &str) -> Response {
    c.get(&format!("/app/read?lib=app&id={}", id))
}

#[test]
fn records_obey_their_reader_groups() {
    let inst = Instance::start();
    let mut admin = inst.login_admin();
    let mut anon = inst.client();
    let mut user = inst.login_user();

    assert_ok(&write_record(&mut admin, "nbtest_public", r#"["anonymous"]"#), "write public record");
    assert_ok(&write_record(&mut admin, "nbtest_private", "[]"), "write private record");

    // Written into the instance's store, never the checkout's.
    let in_copy = |id: &str| {
        let p: String = id.chars().chain(std::iter::repeat('_')).take(16).collect();
        let mut path = inst.dir.join("data").join("app");
        for i in 0..4 {
            path = path.join(&p[i * 4..i * 4 + 4]);
        }
        path.join(id)
    };
    assert!(in_copy("nbtest_public").is_file());
    let in_checkout = common::repo_root().join(in_copy("nbtest_public").strip_prefix(&inst.dir).unwrap());
    assert!(!in_checkout.exists(), "the write reached the checkout: {}", in_checkout.display());

    for (who, c) in [("anonymous", &mut anon), (USER, &mut user), ("admin", &mut admin)] {
        let j = assert_ok(&read_record(c, "nbtest_public"), &format!("public record as {}", who));
        assert_eq!(j.get_object("data").get_int("x"), 42, "{}", j.to_string());
    }
    assert_denied(&read_record(&mut anon, "nbtest_private"), "private record as anonymous");
    assert_denied(&read_record(&mut user, "nbtest_private"), "private record as a plain user");
    let j = assert_ok(&read_record(&mut admin, "nbtest_private"), "private record as admin");
    assert_eq!(j.get_object("data").get_int("x"), 42);
}

#[test]
fn only_admin_writes_records() {
    let inst = Instance::start();
    for (who, mut c) in [("anonymous", inst.client()), (USER, inst.login_user())] {
        assert_denied(&write_record(&mut c, "nbtest_denied", r#"["anonymous"]"#), &format!("app.write as {}", who));
    }
    let j = status(&read_record(&mut inst.login_admin(), "nbtest_denied"), "read after denied writes");
    assert_eq!(j.get_string("status"), "err", "a denied write created the record: {}", j.to_string());
}

// ---------------------------------------------------------------- assets

#[test]
fn dev_code_asset_write_list_delete() {
    let inst = Instance::start();
    let write = command_id("dev", "code", "write_asset");
    let list = command_id("dev", "code", "list_assets");
    let delete = command_id("dev", "code", "delete_asset");
    let file = inst.dir.join("data").join("app").join("_ASSETS").join("nbtest.txt");

    let mut anon = inst.client();
    let mut user = inst.login_user();
    let args = r#"{"lib":"app","name":"nbtest.txt","content":"hello","tempfile":""}"#;
    assert_denied(&anon.exec("dev", &write, args), "write_asset as anonymous");
    assert_denied(&user.exec("dev", &write, args), "write_asset as a plain user");
    assert!(!file.exists(), "a denied write_asset wrote {}", file.display());

    let mut admin = inst.login_admin();
    assert_ok(&admin.exec("dev", &write, args), "write_asset");
    assert_eq!(std::fs::read_to_string(&file).expect("asset file"), "hello");
    assert!(!common::repo_root().join("data").join("app").join("_ASSETS").join("nbtest.txt").exists());

    let listed = assert_ok(&admin.exec("dev", &list, r#"{"lib":"app"}"#), "list_assets");
    assert!(listed.to_string().contains("nbtest.txt"), "list_assets lacks the asset: {}", listed.to_string());

    let del = r#"{"lib":"app","name":"nbtest.txt"}"#;
    assert_denied(&anon.exec("dev", &delete, del), "delete_asset as anonymous");
    assert!(file.exists());
    assert_ok(&admin.exec("dev", &delete, del), "delete_asset");
    assert!(!file.exists(), "delete_asset left {}", file.display());
}
