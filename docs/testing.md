# Testing Newbound core

The core has three kinds of automated test, all run by one command and by
CI on Linux, macOS and Windows:

- **Unit tests** inside `newbound_core` (`#[cfg(test)] mod tests`).
- **Smoke tests** (`tests/smoke.rs`) that boot a disposable instance and
  drive it over HTTP.
- **Harness checks** (`tests/harness.rs`) that keep the harness honest.

## Running the suite

```
cargo test --release --features=serde_support --workspace
```

- `--workspace` matters: without it `cargo test` tests only the
  `newbound` binary crate and skips `newbound_core`.
- On a machine with several Pythons, set `PYO3_PYTHON` to the one the
  build expects (e.g. `PYO3_PYTHON=/usr/bin/python3.12`).
- One file: `--test smoke`. One test: add its name, e.g.
  `cargo test --release --features=serde_support --test smoke login`.
- Server output: each instance writes `newbound.log` in its own temp
  directory, and startup failures print it. To keep the directories
  after the run, set `NEWBOUND_TEST_KEEP=1`; the paths are printed.
- The suite takes well under a second once built. It never touches the
  checkout's `data/` or a running instance, so it is safe to run on a
  machine where Newbound is running.

## Adding a test

An HTTP-level test goes in `tests/smoke.rs`, or in a new `tests/<area>.rs`
that starts with `mod common;`:

```rust
mod common;
use common::Instance;

#[test]
fn security_groups_needs_admin() {
    let inst = Instance::start();               // fresh instance, own temp dir
    let mut anon = inst.client();               // anonymous visitor
    let mut admin = inst.login_admin();         // logged-in client

    let r = anon.get("/security/groups");
    assert_eq!(r.status, 200);
    assert_eq!(r.json().get_string("status"), "err");

    let j = admin.get("/security/groups").json();
    assert_eq!(j.get_string("status"), "ok");
}
```

- Commands on an app's main control are `GET /<app>/<cmd>?<params>`.
  Others go through `client.exec(lib, common::command_id(lib, ctl, cmd),
  args_json)`; look ids up by name, never hard-code them.
- Assert on status codes and JSON shape, not on timing, ports, ids or
  ordering that can change between runs.
- Start a new `Instance` per test rather than sharing one, so tests stay
  independent and can run in parallel. A test that writes to the store
  writes to its own copy.
- A fixture user is in `inst.admin_password` / `inst.user_password`;
  `common::USER` is the non-admin user, in group `common::USER_GROUP`.
- Keep the harness portable: `std::path` joins, no shell commands, no
  hard-coded `/tmp`.

A pure-Rust unit test (no server) goes next to the code in
`newbound_core`, in a `#[cfg(test)] mod tests`. Note that
`newbound_core/src` is generated from the store: change the command's
source through the `dev.code` tools (see `CLAUDE.md`), then `newbound
rebuild`, and commit the store and generated source together.

## Before this work (2026-11-18)

| What | Where | Result |
|---|---|---|
| 9 unit tests: the peer stream framing, chunking, flow control and connection choice | `newbound_core/src/peer/service/listen.rs` (`mod tests`) | all pass |
| 1 in-store `test_*` command, run through flowlang rather than `cargo test` | `app.service` | not run by `cargo test` |
| Everything else: HTTP, sessions, login, security groups, static files, `app`, `dev`, `security` commands | | no tests |

The same 9 tests also appear under `data/peer/…` because the store holds
the command source the Rust is generated from; they are one set, not two.

A plain `cargo test` ran 0 of them (they need `--workspace`), and CI
built and started the server but never ran `cargo test`.

## How a request is served (what the tests exercise)

`newbound` with no subcommand loads `config.properties` from the working
directory, opens the store at `./data`, loads the apps listed in
`config.properties` (`apps=`), and starts the HTTP listener
(`app.service.init` → `http_listen` in
`newbound_core/src/app/service/init.rs`). With `http_port=0` it binds a
free port and prints `HTTP TCP listening on port N`.

Each request goes through `prep_request` (session from the `sessionid`
cookie or `session_id` parameter; unknown ids get a fresh *anonymous*
session) and then `do_get`:

1. A file under `html/` is served as-is (a directory serves its
   `index.html`).
2. `/` redirects (302) to `/<default_app>/index.html`.
3. `/<app>/<rest>`, where `<app>` is a loaded app: a file under
   `runtime/<app>/html/` or `runtime/<app>/src/html/<app>/` is served;
   otherwise `<rest>` is looked up as a command on the app's main control
   (`ctlid` in `runtime/<app>/app.properties`) and run through
   `handle_command`.
4. Anything else is a 404 (`html/404.html` when present).

`handle_command` checks the command's reader groups against the session's
user (`security.init::check_security`): a user in `admin` passes
everything; anonymous passes only when both the library and the command
list `anonymous`. A denied command returns `200` with JSON
`{"status":"err","msg":"UNAUTHORIZED: <cmd>"}` (protocol-adapter commands
that declare `nn_method` get a real 401/403 instead). An unknown command
on a known app is a 404. A successful command returns JSON shaped by
`format_result`: `{"status":"ok","data":…}` for most return types,
`{"status":"ok","msg":…}` for `String`, and the command's own object
(plus `status`) for `FLAT`.

Commands that are not on an app's main control (for example the
`dev.code` editing commands) are reached over HTTP through `app.exec`
(`/app/exec?lib=<lib>&id=<command id>&args=<json>`), which applies the
same reader-group check through `check_auth`.

Users live in `users/<name>.properties` beside `data/`. If
`users/admin.properties` is missing, startup creates it with a random
password, so a test fixture writes its own users before starting.

## What the smoke tests cover (`tests/smoke.rs`)

Each test starts its own instance and asserts on status codes and JSON
shape only — never on timing, ports, or anything that changes between runs.

| Test | Checks |
|---|---|
| `root_redirects_to_the_default_app` | `GET /` is a 302 to `/app/index.html` |
| `app_pages_are_served` | `/app/` and `/app/index.html` are the same 200 HTML page; `dev` and `security` index pages are 200 HTML; `/favicon.ico` comes from `html/` |
| `app_apps_lists_the_loaded_apps` | anonymous `app/apps` is `status=ok` with exactly the configured apps, each with `id`, `name`, `active` |
| `a_new_visitor_is_anonymous_and_gets_a_session_cookie` | first request sets `sessionid`; `security/current_user` is anonymous with no groups |
| `login_with_the_right_password` | `app/login` succeeds for the fixture user and admin; `current_user` then shows the user and their groups; the session id is kept |
| `login_with_a_wrong_password_or_unknown_user_fails` | wrong password, empty password, unknown user: `status=err`, `msg` starts `UNAUTHORIZED`, session stays anonymous |
| `a_session_ends_with_its_cookie` | a client without the cookie is anonymous; the logged-in session is unaffected |
| `admin_only_commands_are_denied_to_anonymous_and_plain_users` | `app/libs`, `app/settings`, `security/users`, `security/groups`: denied (`status=err`, `UNAUTHORIZED`, no `data`) to anonymous and to the non-admin user, `status=ok` for admin |
| `dev_code_read_commands` | through `app.exec` as admin: `list_libraries`, `list_controls`, `list_commands`, `read_command` return the expected arrays/objects and keys; all four are denied to anonymous and the non-admin user |
| `unknown_paths_are_404` | unknown app, unknown command, unknown file: 404 |

Core has no logout command; "logout" is covered as the session ending
(dropping the session id). Add a real logout test when the command exists.

Command record ids for `app.exec` are looked up by name from the store
(`common::command_id(lib, ctl, cmd)`), so the tests survive re-ids.

## Not covered yet

Candidates for the next tests, roughly in order of value:

- Commands that write: `app.write`, `security.setuser` / `deleteuser`,
  and the `dev.code` editing commands (each on its own instance, so the
  writes are disposable).
- `POST` bodies: form posts, multipart uploads, chunked request bodies.
- WebSockets (event subscriptions and command calls).
- HTTP Basic auth (`basicauth=true`) and its 401/403 answers.
- Session expiry (`sessiontimeoutmillis`).
- The `peer` library: P2P streams between two instances, with discovery
  kept off the real network.
- Flows, timers and events; the in-store `test_*` commands, which run
  through flowlang rather than `cargo test`.
- The Python and JavaScript runtimes (`newbound pytest` / `jstest`), and
  the browser front end.
- NixOS and Raspberry Pi: CI covers Linux, macOS and Windows on x86-64
  and Apple silicon only.

## How it works

### Harness (`tests/common/mod.rs`)

Integration tests live in `tests/*.rs` in the root crate and start with
`mod common;`.

- **Disposable instance.** `Instance::start()` creates a fresh directory
  under `std::env::temp_dir()` and copies into it only what a core
  instance needs: `data/<lib>` for each library under test, `html/`, and
  `runtime/<lib>/app.properties` and `runtime/<lib>/src/`. It never runs
  in, or writes to, the checkout or a live instance.
- **Config.** It writes `config.properties` with `headless=true`,
  `http_address=127.0.0.1`, `http_port=0`, `security=on` and
  `apps=app,dev,security` (`Instance::start_with_apps` picks others).
  `peer` is left out by default: it opens a P2P listener and LAN
  discovery, and a test instance must never announce itself to real
  instances on the same network.
- **Users.** `users/admin.properties` (group `admin`) and
  `users/tester.properties` (group `testers`, which grants nothing in the
  core libraries), each with a random password held in
  `inst.admin_password` / `inst.user_password`.
- **Start/ready/stop.** Runs the binary Cargo built for this test
  (`CARGO_BIN_EXE_newbound`) with the temp directory as its working
  directory and its output in `newbound.log` there, waits for
  `HTTP TCP listening on port N`, then until `GET /` answers. Startup
  failures panic with the log. Dropping the `Instance` — including when a
  test panics — kills the process, waits for it and deletes the directory.
  Set `NEWBOUND_TEST_KEEP=1` to keep the directory for inspection.
- **One instance per test.** Booting takes a fraction of a second, so
  each test starts its own instance and no test can see another's
  sessions or writes; the tests in a file run in parallel safely.
- **Client.** `inst.client()` is an anonymous visitor; `inst.login_admin()`
  and `inst.login_user()` return clients already logged in. A client is a
  minimal HTTP/1.1 GET client on `std::net::TcpStream` that keeps the
  `sessionid` cookie like a browser. `client.exec(lib, id, args)` calls a
  command through `app.exec`. `Response` has `status`, `header()`,
  `cookie()`, `text()` and `json()` (an ndata `DataObject`). No new
  dependencies.
- **Portable.** `std::path` joins only, no shell, no `/tmp` literal, no
  Unix-only APIs, so the same code runs on Linux, NixOS, macOS, Windows
  and Raspberry Pi.

`tests/harness.rs` checks the harness itself: the instance boots under the
temp dir, answers, is gone (process, port and directory) after drop, two
instances are independent, and both fixture users can log in.

### CI (`.github/workflows/build.yml`)

The `build` job runs on `ubuntu-latest`, `macos-latest` and
`windows-latest` for every pull request and every push to master. It
caches `~/.cargo` and `target/` (`Swatinem/rust-cache`) and, right after
the release build, runs

```
cargo test --release --features=serde_support --workspace
```

The tests reuse the build's compiled dependencies, so the step adds
little time. A failing test fails the job for that OS.

**Not yet run in CI.** The workflow has not run on GitHub (nothing is
pushed) and `act` was not available on the development machine. What
was checked instead: the workflow file parses, and a fresh clone of the
branch (tracked files only, new target dir) builds and passes the whole
suite on Linux. macOS and Windows will be exercised the first time the
branch runs on GitHub.
