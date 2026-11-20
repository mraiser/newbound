# Testing Newbound core

The core has three kinds of automated test, all run by one command and by
CI on Linux, macOS and Windows:

- **Unit tests** inside `newbound_core` (`#[cfg(test)] mod tests`).
- **Integration tests** (`tests/*.rs`) that boot disposable instances and
  drive them over HTTP and WebSocket.
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
- The suite takes about six seconds once built (session expiry waits
  for the server's sweep; everything else is well under a second). It never touches the
  checkout's `data/` or a running instance, so it is safe to run on a
  machine where Newbound is running.

## Adding a test

An HTTP-level test goes in the `tests/<area>.rs` file for its area, or in
a new one that starts with `mod common;`:

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
- Need a config switch? `Instance::start_with_config(&[("basicauth",
  "true")])`.
- Bodies: `client.post_json`, `post_form`, `post_multipart`,
  `post_chunked_json`, or `client.raw(bytes)` for hand-made framing.
  WebSocket: `client.websocket()` then `ws.command(app, cmd, params, pid)`.
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

## What the tests cover

Each test starts its own instance and asserts on status codes and JSON
shape only — never on timing, ports, or anything that changes between runs.

### `tests/smoke.rs` — the main paths

| Test | Checks |
|---|---|
| `root_redirects_to_the_default_app` | `GET /` is a 302 to `/app/index.html` |
| `app_pages_are_served` | `/app/` and `/app/index.html` are the same 200 HTML page; `dev` and `security` index pages are 200 HTML; `/favicon.ico` comes from `html/` |
| `app_apps_lists_the_loaded_apps` | anonymous `app/apps` is `status=ok` with exactly the configured apps, each with `id`, `name`, `active` |
| `a_new_visitor_is_anonymous_and_gets_a_session_cookie` | first request sets `sessionid`; `security/current_user` is anonymous with no groups |
| `login_with_the_right_password` | `app/login` succeeds for the fixture user and admin; `current_user` then shows the user and their groups |
| `login_with_a_wrong_password_or_unknown_user_fails` | wrong password, empty password, unknown user: `status=err`, `msg` starts `UNAUTHORIZED`, session stays anonymous |
| `a_session_ends_with_its_cookie` | a client without the cookie is anonymous; the logged-in session is unaffected |
| `admin_only_commands_are_denied_to_anonymous_and_plain_users` | `app/libs`, `app/settings`, `security/users`, `security/groups`: denied (`status=err`, `UNAUTHORIZED`, no `data`) to anonymous and to the non-admin user, `status=ok` for admin |
| `dev_code_read_commands` | through `app.exec` as admin: `list_libraries`, `list_controls`, `list_commands`, `read_command` return the expected arrays/objects and keys; all four are denied to anonymous and the non-admin user |
| `unknown_paths_are_404` | unknown app, unknown command, unknown file: 404 |

### `tests/writes.rs` — commands that change data

| Test | Checks |
|---|---|
| `admin_creates_and_deletes_a_user` | `security/setuser` writes `users/<id>.properties` in the instance (not the checkout), the user appears in `security/users` and can log in; `security/deleteuser` removes the file and the login |
| `only_admin_manages_users` | `setuser` / `deleteuser` are denied to anonymous and the plain user, and change nothing |
| `records_obey_their_reader_groups` | `app/write` stores a record in the instance's store only; `app/read` serves a record with `anonymous` readers to everyone and one with no readers only to admin |
| `only_admin_writes_records` | `app/write` is denied to anonymous and the plain user, and no record appears |
| `dev_code_asset_write_list_delete` | `dev.code.write_asset` / `list_assets` / `delete_asset` work for admin and are denied (with no file written or removed) to everyone else |

### `tests/http_bodies.rs` — request bodies

| Test | Checks |
|---|---|
| `post_bodies_deliver_parameters` | `app/login` parameters arrive by JSON, url-encoded form, multipart form and chunked JSON (split mid-value) POST |
| `post_bodies_with_a_wrong_password_fail` | the same four with a wrong password stay anonymous |
| `malformed_framing_gets_an_http_error` | bad chunk size → 400, unsupported `Transfer-Encoding` → 501, `Content-Length` over 64 MiB → 413, non-numeric `Content-Length` → 400; the server keeps serving |

### `tests/basic_auth.rs` — HTTP Basic (`basicauth=true`)

| Test | Checks |
|---|---|
| `valid_credentials_log_in_without_a_cookie` | admin and the plain user are recognised from `Authorization: Basic` alone; repeated cookie-less requests reuse one session |
| `bad_credentials_stay_anonymous` | wrong password, unknown user, empty password, malformed base64 and a non-Basic scheme stay anonymous |
| `basic_auth_is_off_unless_configured` | without `basicauth=true` the header is ignored |

### `tests/session_expiry.rs`

| Test | Checks |
|---|---|
| `idle_sessions_expire_and_active_ones_survive` | with `sessiontimeoutmillis=1000`, an idle logged-in session is swept (seen in the server log) and is anonymous afterwards, while a session making requests stays logged in |

### `tests/websocket.rs` — commands over a WebSocket

| Test | Checks |
|---|---|
| `anonymous_socket_runs_open_commands` | the handshake answers 101 with the RFC 6455 accept value; `cmd` messages run `current_user` and `apps` and echo `pid` |
| `socket_carries_the_logged_in_session` | a socket opened with an admin cookie runs as admin, including admin-only commands |
| `socket_commands_obey_permissions` | admin-only commands over the socket are denied to anonymous and the plain user |
| `unknown_socket_command_is_an_error` | `status=err`, `Unknown command` |
| `replies_are_matched_by_pid` | ten concurrent commands each get exactly one reply with their `pid` |

Core has no logout command; "logout" is covered as the session ending
(dropping the session id). Add a real logout test when the command exists.

Command record ids for `app.exec` are looked up by name from the store
(`common::command_id(lib, ctl, cmd)`), so the tests survive re-ids.

## Not covered yet

- File uploads (multipart parts with a filename).
- Event subscriptions over a WebSocket (`sub` messages).
- The 401/403 answers for protocol-adapter commands (those declaring
  `nn_method`): no core command declares it, so they need a fixture
  command or a library that has one.
- The `peer` library: P2P streams between two instances. Its LAN
  discovery always binds a fixed port on every interface, so a test
  instance would find real instances on the network; it needs a switch
  to turn discovery off first.
- Flows, timers and events; the in-store `test_*` commands, which run
  through flowlang rather than `cargo test`.
- The Python and JavaScript runtimes (`newbound pytest` / `jstest`):
  they need a build with those features, so a separate CI job.
- The browser front end.
- NixOS and Raspberry Pi: CI covers Linux, macOS and Windows on x86-64
  and Apple silicon only.

## Known behaviour the harness works around

- A url-encoded form POST: the server reads the last field up to
  end-of-stream, so a client that keeps the connection open waits for the
  3-second socket timeout before getting an answer. The harness client
  half-closes its side after every request, so tests answer at once.

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
  `apps=app,dev,security` (`Instance::start_with_apps` picks others;
  `Instance::start_with_config` adds or replaces entries).
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
  failures panic with the log. The process's `TMPDIR`/`TMP`/`TEMP`
  point into the instance directory, so its own temp files stay there.
  Dropping the `Instance` — including when a
  test panics — kills the process, waits for it and deletes the directory.
  Set `NEWBOUND_TEST_KEEP=1` to keep the directory for inspection.
- **One instance per test.** Booting takes a fraction of a second, so
  each test starts its own instance and no test can see another's
  sessions or writes; the tests in a file run in parallel safely.
- **Client.** `inst.client()` is an anonymous visitor; `inst.login_admin()`
  and `inst.login_user()` return clients already logged in. A client is a
  minimal HTTP/1.1 client on `std::net::TcpStream` that keeps the
  `sessionid` cookie like a browser: `get`, `request`, the `post_*`
  helpers, `raw`, and `exec(lib, id, args)` for `app.exec`. `Response`
  has `status`, `header()`, `cookie()`, `text()` and `json()` (an ndata
  `DataObject`). `client.websocket()` performs the handshake on the
  client's session and returns a `WebSocket` with `send_text`,
  `recv_text` and `command`. No new dependencies.
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
