//! Smoke tests over HTTP against a disposable instance (see tests/common).
//! They assert on status codes and JSON shape only.

mod common;

use common::{command_id, Client, Instance, Response};
use ndata::dataarray::DataArray;
use ndata::dataobject::DataObject;

// ---------------------------------------------------------------- helpers

fn assert_html(r: &Response, what: &str) {
    assert_eq!(r.status, 200, "{}: HTTP {}", what, r.status);
    let ct = r.header("content-type").unwrap_or("");
    assert!(ct.starts_with("text/html"), "{}: content-type {:?}", what, ct);
    assert!(r.text().to_ascii_lowercase().contains("<html"), "{}: body is not an HTML page", what);
}

/// A JSON command result with status=ok; returns the whole object.
fn ok(r: &Response, what: &str) -> DataObject {
    assert_eq!(r.status, 200, "{}: HTTP {}: {}", what, r.status, r.text());
    let ct = r.header("content-type").unwrap_or("");
    assert!(ct.starts_with("application/json"), "{}: content-type {:?}", what, ct);
    let j = r.json();
    assert_eq!(j.get_string("status"), "ok", "{}: {}", what, r.text());
    j
}

/// A command the session may not run: still HTTP 200, with a JSON error
/// whose msg starts with UNAUTHORIZED.
fn assert_denied(r: &Response, what: &str) {
    assert_eq!(r.status, 200, "{}: HTTP {}: {}", what, r.status, r.text());
    let j = r.json();
    assert_eq!(j.get_string("status"), "err", "{} should be denied: {}", what, r.text());
    assert!(j.get_string("msg").starts_with("UNAUTHORIZED"), "{}: unexpected msg: {}", what, r.text());
    assert!(!j.has("data"), "{}: a denial must carry no data: {}", what, r.text());
}

fn data_array(j: &DataObject, what: &str) -> DataArray {
    assert!(j.has("data"), "{}: no data", what);
    j.get_array("data")
}

fn strings(a: &DataArray, key: &str) -> Vec<String> {
    a.objects().into_iter().map(|d| d.object().get_string(key)).collect()
}

fn strings_of(a: &DataArray) -> Vec<String> {
    a.objects().into_iter().map(|d| d.string()).collect()
}

fn current_user(c: &mut Client) -> DataObject {
    ok(&c.get("/security/current_user"), "security.current_user").get_object("data")
}

fn is_anonymous(u: &DataObject) -> bool {
    u.has("username") && u.get_string("username") == "anonymous" && u.get_array("groups").len() == 0
}

// ---------------------------------------------------------------- static

#[test]
fn root_redirects_to_the_default_app() {
    let inst = Instance::start();
    let r = inst.client().get("/");
    assert_eq!(r.status, 302);
    let loc = r.header("location").expect("302 without Location");
    assert!(loc.ends_with("/app/index.html"), "Location {:?}", loc);
}

#[test]
fn app_pages_are_served() {
    let inst = Instance::start();
    let mut c = inst.client();

    let dir = c.get("/app/");
    assert_html(&dir, "/app/");
    let index = c.get("/app/index.html");
    assert_html(&index, "/app/index.html");
    assert_eq!(dir.body, index.body, "/app/ should serve /app/index.html");

    for app in ["dev", "security"] {
        assert_html(&c.get(&format!("/{}/index.html", app)), app);
    }

    // A file from the top-level html/ folder.
    let fav = c.get("/favicon.ico");
    assert_eq!(fav.status, 200);
    assert!(!fav.body.is_empty());
}

// ---------------------------------------------------------------- app.apps

#[test]
fn app_apps_lists_the_loaded_apps() {
    let inst = Instance::start();
    let j = ok(&inst.client().get("/app/apps"), "app.apps (anonymous)");
    let apps = data_array(&j, "app.apps");
    let mut ids = strings(&apps, "id");
    ids.sort();
    assert_eq!(ids, ["app", "dev", "security"], "exactly the apps in config.properties");
    for a in apps.objects() {
        let a = a.object();
        for key in ["id", "name", "active"] {
            assert!(a.has(key), "app entry without {}: {}", key, a.to_string());
        }
    }
}

// ---------------------------------------------------------------- sessions

#[test]
fn a_new_visitor_is_anonymous_and_gets_a_session_cookie() {
    let inst = Instance::start();
    let mut c = inst.client();
    let r = c.get("/security/current_user");
    assert!(r.cookie("sessionid").is_some(), "no sessionid cookie set");
    let u = ok(&r, "current_user").get_object("data");
    assert!(is_anonymous(&u), "{}", u.to_string());
}

#[test]
fn login_with_the_right_password() {
    let inst = Instance::start();
    let mut c = inst.client();
    current_user(&mut c); // start an anonymous session first

    // The client follows whatever session cookie the login answer sets.
    let pw = inst.user_password.clone();
    let j = ok(&c.get(&format!("/app/login?user={}&pass={}", common::USER, pw)), "login");
    assert!(j.has("msg"));

    let u = current_user(&mut c);
    assert_eq!(u.get_string("id"), common::USER);
    assert_eq!(strings_of(&u.get_array("groups")), [common::USER_GROUP]);

    let admin = current_user(&mut inst.login_admin());
    assert_eq!(admin.get_string("id"), "admin");
    assert!(strings_of(&admin.get_array("groups")).contains(&"admin".to_string()));
}

#[test]
fn login_with_a_wrong_password_or_unknown_user_fails() {
    let inst = Instance::start();
    let mut c = inst.client();
    for (user, pass) in [("admin", "not-the-password"), (common::USER, ""), ("nobody", "x")] {
        let r = c.get(&format!("/app/login?user={}&pass={}", user, common::encode(pass)));
        assert_eq!(r.status, 200);
        let j = r.json();
        assert_eq!(j.get_string("status"), "err", "{} logged in with a wrong password", user);
        assert!(j.get_string("msg").starts_with("UNAUTHORIZED"), "{}", r.text());
        assert!(is_anonymous(&current_user(&mut c)), "failed login changed the session");
    }
}

#[test]
fn a_session_ends_with_its_cookie() {
    // Core has no logout command; a session ends when the client drops its
    // session id (or it times out). A new session starts anonymous, and the
    // old one is unaffected by it.
    let inst = Instance::start();
    let mut admin = inst.login_admin();
    let mut fresh = inst.client();
    assert!(is_anonymous(&current_user(&mut fresh)));
    assert_ne!(fresh.session, admin.session);
    assert_eq!(current_user(&mut admin).get_string("id"), "admin");
}

// ---------------------------------------------------------------- security

#[test]
fn admin_only_commands_are_denied_to_anonymous_and_plain_users() {
    let inst = Instance::start();
    let mut anon = inst.client();
    let mut user = inst.login_user();
    let mut admin = inst.login_admin();

    for path in ["/app/libs", "/app/settings", "/security/users", "/security/groups"] {
        assert_denied(&anon.get(path), &format!("{} as anonymous", path));
        assert_denied(&user.get(path), &format!("{} as {}", path, common::USER));
        ok(&admin.get(path), &format!("{} as admin", path));
    }

    let libs = ok(&admin.get("/app/libs"), "app.libs");
    assert!(strings(&data_array(&libs, "app.libs"), "id").contains(&"security".to_string()));
}

// ---------------------------------------------------------------- dev.code

#[test]
fn dev_code_read_commands() {
    let inst = Instance::start();
    let list_libraries = command_id("dev", "code", "list_libraries");
    let list_controls = command_id("dev", "code", "list_controls");
    let list_commands = command_id("dev", "code", "list_commands");
    let read_command = command_id("dev", "code", "read_command");

    let mut admin = inst.login_admin();

    let libs = ok(&admin.exec("dev", &list_libraries, "{}"), "list_libraries");
    let ids = strings(&data_array(&libs, "list_libraries"), "id");
    for lib in ["app", "dev", "security"] {
        assert!(ids.contains(&lib.to_string()), "list_libraries lacks {}: {:?}", lib, ids);
    }

    let ctls = ok(&admin.exec("dev", &list_controls, r#"{"lib":"security"}"#), "list_controls");
    let ctls = data_array(&ctls, "list_controls");
    assert!(strings(&ctls, "name").contains(&"security".to_string()));
    for c in ctls.objects() {
        let c = c.object();
        assert!(c.has("id") && c.has("name") && c.has("lib"), "control entry: {}", c.to_string());
    }

    let cmds = ok(
        &admin.exec("dev", &list_commands, r#"{"lib":"security","ctl":"security"}"#),
        "list_commands",
    );
    let cmds = data_array(&cmds, "list_commands");
    assert!(cmds.len() > 0, "security.security has no commands");
    for c in cmds.objects() {
        let c = c.object();
        assert!(c.has("name") && c.has("inputSchema"), "command entry: {}", c.to_string());
    }
    // Entries are tool descriptions, named <lib>-<ctl>-<cmd>.
    let names = strings(&cmds, "name");
    assert!(names.contains(&"security-security-current_user".to_string()), "{:?}", names);

    let cmd = ok(
        &admin.exec("dev", &read_command, r#"{"lib":"security","ctl":"security","cmd":"current_user"}"#),
        "read_command",
    )
    .get_object("data");
    assert_eq!(cmd.get_string("cmd"), "current_user");
    assert_eq!(cmd.get_string("lib"), "security");
    assert_eq!(cmd.get_string("ctl"), "security");
    assert!(cmd.has("params"), "read_command without params: {}", cmd.to_string());

    // The same commands are closed to anyone who is not an admin.
    let mut anon = inst.client();
    let mut user = inst.login_user();
    for (name, id, args) in [
        ("list_libraries", &list_libraries, "{}"),
        ("list_controls", &list_controls, r#"{"lib":"security"}"#),
        ("list_commands", &list_commands, r#"{"lib":"security","ctl":"security"}"#),
        ("read_command", &read_command, r#"{"lib":"security","ctl":"security","cmd":"current_user"}"#),
    ] {
        assert_denied(&anon.exec("dev", id, args), &format!("dev.code.{} as anonymous", name));
        assert_denied(&user.exec("dev", id, args), &format!("dev.code.{} as {}", name, common::USER));
    }
}

// ---------------------------------------------------------------- 404

#[test]
fn unknown_paths_are_404() {
    let inst = Instance::start();
    let mut c = inst.client();
    for path in ["/no-such-app/index.html", "/app/no_such_command", "/app/no-such-file.css", "/security/no_such_command"] {
        let r = c.get(path);
        assert_eq!(r.status, 404, "{} answered HTTP {}", path, r.status);
    }
}
