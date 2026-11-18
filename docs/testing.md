# Testing Newbound core

Status: **plan** (phase 1 of 5). The harness, smoke tests and CI job are
not written yet; sections marked *planned* describe what they will be.

## Where we start (2026-11-18)

| What | Where | Result |
|---|---|---|
| 9 unit tests: the peer stream framing, chunking, flow control and connection choice | `newbound_core/src/peer/service/listen.rs` (`mod tests`) | all pass |
| 1 in-store `test_*` command, run through flowlang rather than `cargo test` | `app.service` | not run by `cargo test` |
| Everything else: HTTP, sessions, login, security groups, static files, `app`, `dev`, `security` commands | | no tests |

The same 9 tests also appear under `data/peer/…` because the store holds
the command source the Rust is generated from; they are one set, not two.

Two things to know about running them:

- A plain `cargo test` at the root tests only the `newbound` binary crate,
  which has no tests. The 9 tests live in `newbound_core`, so the command is

  ```
  cargo test --release --features=serde_support --workspace
  ```

  (On a machine with several Pythons, set `PYO3_PYTHON` to the one the
  build expects, e.g. `PYO3_PYTHON=/usr/bin/python3.12`.)
- CI (`.github/workflows/build.yml`) builds, regenerates from the store,
  zips, and checks the server answers on `/`. It never runs `cargo test`.

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

## What to test (phase 3)

The smoke suite asserts on status codes and JSON shape only — never on
timing, port numbers, or anything that changes between runs.

| Area | Test | Expect |
|---|---|---|
| Static | `GET /app/` | 200, HTML |
| Static | `GET /app/index.html` | 200, HTML |
| Static | `GET /` | 302 to `/app/index.html` |
| `app.apps` | `GET /app/apps` anonymously | 200, JSON, `status=ok`, the fixture's apps listed |
| Login | `GET /app/login?user=…&pass=…` with the fixture password | `status=ok`; `security/current_user` now reports the fixture user |
| Login | the same with a wrong password | `status=err`, `msg` starts `UNAUTHORIZED`; session stays anonymous |
| Session end | drop the cookie / use a new session id | back to anonymous |
| Security | an admin-only `app` command (e.g. `app/libs`) anonymously | `status=err`, `msg` starts `UNAUTHORIZED` |
| Security | the same command as admin | `status=ok` |
| Security | a non-admin fixture user in a group the command does not list | denied |
| `dev.code` | `list_libraries`, `list_controls`, `list_commands`, `read_command` through `app.exec` as admin | `status=ok`, expected keys/arrays present |
| `dev.code` | the same anonymously | denied |
| 404 | an unknown app, and an unknown command on a known app | 404 |

Core has no logout command; "logout" is covered as the session ending
(dropping the session id), and a real logout test is added when the
command exists.

## How (phases 2–4)

### Harness (*planned*, phase 2)

An integration-test helper at `tests/common/mod.rs` in the root crate,
used by `tests/*.rs`:

- **Disposable instance.** Creates a fresh directory under
  `std::env::temp_dir()` and copies into it only what a core instance
  needs: `data/{app,dev,security}` (and `peer` for tests that need it),
  `html/`, and `runtime/<lib>/{app.properties,src}`. It never runs in, or
  writes to, the checkout or a live instance.
- **Config.** Writes `config.properties` with `headless=true`,
  `http_address=127.0.0.1`, `http_port=0` and `apps=` the libraries under
  test. Peer networking (P2P listener and LAN discovery) is left out
  unless a test asks for it, so test instances never announce themselves
  to real instances on the same network.
- **Users.** Writes `users/admin.properties` and a non-admin fixture user,
  each with a random password the test knows.
- **Start/ready/stop.** Runs the binary from `CARGO_BIN_EXE_newbound` with
  the temp directory as working directory, reads stdout until it prints
  the listening port, then polls `GET /` until it answers. Drop kills the
  child, waits for it, and removes the directory. One instance is shared
  per test binary where tests do not interfere.
- **Client.** A minimal HTTP/1.1 GET client on `std::net::TcpStream`
  (cookie in, `Set-Cookie` out) and `ndata::DataObject::from_string` for
  JSON — no new dependencies.
- **Portable.** `std::path` joins only, no shell, no `/tmp` literal, no
  Unix-only APIs, so the same code runs on Linux, NixOS, macOS, Windows
  and Raspberry Pi.

### CI (*planned*, phase 4)

A `test` job (in `build.yml` or a new `test.yml`) on `ubuntu-latest`,
`macos-latest` and `windows-latest`, caching `~/.cargo` and `target/`,
running

```
cargo test --release --features=serde_support --workspace
```

### Running the suite / adding a test (*planned*, phase 5)

Filled in once the harness exists.
