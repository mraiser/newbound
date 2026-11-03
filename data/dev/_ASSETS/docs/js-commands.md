# JavaScript and TypeScript commands

How to write, run, check and test JavaScript and TypeScript commands.
Requires a build with the JavaScript runtime, against a flowlang that has the
rebuilt engine (the release after 0.3.42):
`cargo build --release --features=serde_support,javascript_runtime`.
Commands run in one embedded V8 isolate (deno_core) - no Node - with the web
platform APIs (`fetch`, `URL`, ...) built in, and npm packages bundled in by
esbuild.

## Writing a command

A command is a function body. The platform makes the function around it from
the command's declared parameters, so the parameters are in scope as
variables. A body that uses `await` is an `async` function:

    // body (word_stats(text: String, top: Integer) -> JSONObject)
    const counts = {};
    for (const w of text.toLowerCase().split(/\s+/).filter(Boolean)) {
      counts[w] = (counts[w] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return { words: sorted.reduce((n, [, c]) => n + c, 0), top: sorted.slice(0, top) };

The command record's language is `javascript` (`dev.code.upsert_command`
with `lang: "javascript"`; flowlang also accepts `js`). Parameter names must
be JavaScript identifiers. A declared parameter missing from a call is an
error (`missing required parameter: x`), as for a Rust command.

| Declared | Argument arrives as | Return may be |
|---|---|---|
| String / Integer, Float, Double / Boolean | `string` / `number` / `boolean` | the same |
| JSONObject | a handle on the caller's ndata object | an object or handle |
| JSONArray | a handle on the caller's ndata array | an array or handle |
| InputStream | a `Uint8Array` | a `Uint8Array` (or any typed array / `ArrayBuffer`) |
| FLAT | - | an object: the whole response |
| Any | any of the above | any of the above |

A command written in TypeScript has the language `typescript`; its
parameters are typed from the declarations (String→`string`, Integer→`number`,
JSONObject→`Record<string, any>`, ...), and the rest is as below. TypeScript
commands need esbuild (see *Imports and npm packages*), which compiles them;
`dev.code.check_js` type-checks them (strictly).

Objects and arrays are live, as in Python: an argument is a handle on the
caller's own ndata, not a copy - change it and the caller, and any Rust or
Python command holding it, sees the change. Every object or array read from
a handle is a handle too. Handles behave like plain objects and arrays:
`o.key`, `in`, `delete`, `Object.keys`/`entries`, spread, `for...of`,
`JSON.stringify`; and for arrays `Array.isArray`, `length`, indexing, `push`,
`map`, `sort` and the rest. Each read makes a new handle, so compare
contents, not identity (`o.a === o.a` is false when `a` is an object).

Writing a plain object or array into a handle (or returning one) stores new
ndata, as a dict does from Python; writing a handle stores that same object,
and returning a handle returns it. `toJSON` is honoured (a `Date` is stored
as its ISO string), `undefined` removes an object's key, `NaN` and the
infinities are null, and numbers beyond 2^53 lose precision (JavaScript
numbers are doubles). A function, symbol, BigInt, `Map`, `Set`, Promise or a
cyclic structure cannot be stored: a TypeError names it - convert explicitly
(`Object.fromEntries(map)`, `[...set]`, `String(big)`).

The global `ndata` has `ndata.isHandle(x)`, `ndata.toJS(x)` (a plain deep
copy), and `ndata.object()` / `ndata.array()` (new, empty ndata).

## Web APIs

`fetch` (with `Headers`, `Request`, `Response`, `AbortController` /
`AbortSignal.timeout`), `URL` / `URLSearchParams`, `TextEncoder` /
`TextDecoder` (UTF-8), `atob` / `btoa`, `crypto.getRandomValues` /
`crypto.randomUUID`, `structuredClone`, `performance.now`, `EventTarget`,
`Event` and `DOMException` behave as in a browser:

    // body (weather(city: String) -> JSONObject)
    const url = new URL("https://api.example.com/v1/weather");
    url.searchParams.set("q", city);
    const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`weather service: ${r.status} ${r.statusText}`);
    return await r.json();

A request runs off the engine's thread, so other commands keep running while
it is in flight. TLS is verified against Mozilla's root certificates - or,
when `SSL_CERT_FILE` is set, against the certificates in that file instead
(for a private CA or an intercepting proxy); `HTTPS_PROXY` / `HTTP_PROXY` /
`NO_PROXY` are honoured. An HTTP error status is a `Response` (check `ok`); a
network failure rejects with a `TypeError`. Bodies are read whole (up to
256 MiB) and are not decompressed - there are no streams, `Blob` or
`FormData` - and the call's time limit covers the request. This is client
side only, and the HTTP client is interim: outbound requests are to move
into a newbound control.

Node's built-ins are not there: no `require`, `process`, `Buffer`, `fs` or
`http`. For files and processes, write the command (or a helper command) in
Rust or Python and call it with `flowlang.call`.

## Imports and npm packages

A command's `imports` field holds ES `import` statements. Packages resolve
from `node_modules` next to `data/` - run `npm install <package>` there -
CommonJS and ESM alike:

    // imports
    import { z } from "zod";
    import groupBy from "lodash/groupBy.js";

    // body (summarize(rows: JSONArray) -> JSONObject)
    const Row = z.object({ team: z.string(), points: z.number() });
    const parsed = z.array(Row).parse(rows);
    return groupBy(parsed, (r) => r.team);

Such a command (and every TypeScript command) runs from a bundle made by
esbuild, which must be installed: `npm install esbuild` next to `data/` (or
on the PATH, or `FLOWLANG_ESBUILD`). The build writes the command as
`<lib>/<ctl>/<cmd>.js` (`.ts`) in the library's crate `src/` - its imports,
then the body as the module's default export - and bundles it into
`<cmd>.bundle.js`, rebuilt when the command, its imports or the npm lockfile
change (the first call after a change builds it if the build did not). A
missing package, or one that needs Node's built-ins, is reported at its
imports line when the command is saved. At run time, errors point into your
code through the bundle's source map - `(body line 2)`,
`flowlang:mylib/myctl/cmd.js:9:7` - and into packages as `npm:<path>`.

## Async, timers and time limits

A command may `await`, or return a Promise: it answers with what the promise
resolves to, and a rejection is its error. `setTimeout`, `setInterval`,
`clearTimeout`, `clearInterval` and `queueMicrotask` are available.

The engine works like Node's event loop. A call's synchronous part runs to
completion; a call that awaits leaves the engine free for other calls while
it waits, so many awaiting calls make progress together. Timers and promises
a command leaves behind keep running between calls. A promise that can never
settle (nothing left that could resolve it) is an error, not a hang.

Every call has a time limit: 30 s, or `FLOWLANG_JS_TIMEOUT_MS` (`0`: none).
It covers the synchronous part and the awaiting alike. A call past its limit
is answered as timed out, and JavaScript still running at the limit is
stopped. Stopping JavaScript discards the microtasks V8 had queued behind it,
which may belong to other awaiting calls; one that can then never settle says
its work was lost to the stop.

## Calling other commands

`flowlang` is a global, mirroring Python's `flowlang` module:

    const total = flowlang.call("testflow", "testflow", "test_add", { a: 300, b: 120 });
    const same = flowlang.api.testflow.testflow.test_add(300, 120);   // positional
    const later = await flowlang.api.mylib.myctl.some_async_js_command(1);

Both run any command - Rust, Python, flow or JavaScript - with the arguments
cast to its declared parameter types, and return its value (a flow's single
output, or all of its outputs as an object). Names with `-` are written with
`_` under `flowlang.api`. A JavaScript callee runs in the same isolate and
returns its value as is - a Promise when it is async. Failures throw:
`ReferenceError` for an unknown command, `TypeError` for arguments that do
not fit, `flowlang.CommandError` when the command fails (raises, panics, or
returns an error envelope).

A Rust, Python or flow command called this way runs on a worker thread
while the JavaScript caller waits, so it can call JavaScript commands in
turn - JavaScript -> Rust -> JavaScript, to any depth. The inner command
runs in the same engine as the outer one (same globals), its exception
reaches the outer command as the middle command's `CommandError`, and the
outer call's time limit covers the whole chain. The inner command has to
finish without the event loop, because the middle command is waiting for
it: one that awaits fails with a message saying so (it can still be called
from JavaScript directly, where its Promise is returned).

## Errors and output

An exception's report names the exception, its line in the command's own
body, and the stack, whose line numbers are the body's own:

    Uncaught TypeError: Cannot read properties of undefined (reading 'y') (body line 2)
        at Object.cmd [as mylib:myctl:cmd] (flowlang:mylib/myctl/cmd.js:2:12)

A syntax error is reported on every call until the body is fixed - the old
code never runs silently - and `dev.dev.compile` (every upsert/patch) reports
it as a compile error. `console.log`/`info`/`debug` write to stdout (stderr
under `newbound mcp`), `console.warn`/`error`/`trace` to stderr, as complete
lines labelled with the command: `[js mylib:myctl:cmd] message`.

Global state persists between calls, as with Python. A panic inside the
engine restarts it with fresh state.

## Checking and testing

- `dev.dev.compile` (run by every upsert/patch) compiles the body in V8 -
  or, for a command with imports or in TypeScript, bundles it with esbuild,
  resolving its imports - and reports problems at body and imports lines,
  without running it.
- `dev.code.check_js(lib, ctl, cmd)` adds a TypeScript type check when `tsc`
  is found (`$FLOWLANG_TSC`, `node_modules/.bin/tsc` next to `data/`, or `tsc`
  on the PATH): `npm install typescript` next to `data/` is enough. A
  JavaScript body is checked as `// @ts-check` JavaScript with JSDoc types
  from the declared parameters and return type, a TypeScript one strictly,
  both against `flowlang.d.ts` and the packages' own types - so names the
  engine does not provide (`require`, `process`, `Buffer`) are errors, and
  `flowlang.api` calls are checked against the callee's declared parameters.
  Problems come back at body lines; `clean` is false on any error.
- The build writes `<lib>/<ctl>/<cmd>.js` / `.ts` (the command as a typed
  module) and `flowlang.d.ts` into the library's crate `src/`, so editors
  complete and check command bodies. They are generated: edit the command,
  not the file.
- `newbound jstest [files or directories]` runs `*.test.js` files in the same
  engine, so tests call any command:

      test("adds", () => {
        assert.equal(flowlang.api.testflow.testflow.test_add(1, 2), "1+2=3");
      });
      test("awaits", async () => {
        await assert.rejects(flowlang.api.mylib.myctl.fails(), flowlang.CommandError);
      });
      test.skip("later", () => {});

  `assert(cond)`, `assert.equal` (`Object.is`), `notEqual`, `deepEqual`,
  `throws` and `rejects` (matching an error class, a RegExp or a substring).
  Directories are searched recursively, skipping `node_modules`, `target` and
  hidden directories. Exit status: 0 all passed, 1 a failure, 2 nothing ran.

## Not yet

Test files cannot `import` (they reach packages through the commands they
call); there are no streaming bodies, `Blob` or `FormData`; and a JavaScript
command called back through a Rust, Python or flow command cannot await
(above).
