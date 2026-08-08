# nb_codemirror — vendored CodeMirror 6 bundle

`cm6.js` is a one-time build: the packages below (fetched from the npm
registry) bundled into a single self-contained ESM file so the app needs no
node toolchain and every extension shares one @codemirror/state instance.

- Built: 2026-08-01 (rebundled to add @codemirror/search — CM6 virtualizes
  the viewport, so browser find-in-page cannot see off-screen text; the
  editor's own ⌘F panel is the supported fix)
- Command: `npx esbuild entry.js --bundle --format=esm --outfile=cm6.js --minify` (esbuild 0.28.1)
- sha256(cm6.js): `f19d747c5d5d35a343e9d2de228965355b52498089dc0efaa501cf17b6e333a0`
- Only `controls/editor/editor.js` may import this file (DESIGN.md §7.2).

| Package | Version |
|---|---|
| @codemirror/autocomplete | 6.20.3 |
| @codemirror/commands | 6.10.4 |
| @codemirror/lang-css | 6.3.1 |
| @codemirror/lang-html | 6.4.11 |
| @codemirror/lang-javascript | 6.2.5 |
| @codemirror/lang-json | 6.0.2 |
| @codemirror/language | 6.12.4 |
| @codemirror/search | 6.7.1 |
| @codemirror/state | 6.7.1 |
| @codemirror/view | 6.43.6 |
| @lezer/common | 1.5.2 |
| @lezer/css | 1.3.4 |
| @lezer/highlight | 1.2.3 |
| @lezer/html | 1.3.13 |
| @lezer/javascript | 1.5.4 |
| @lezer/json | 1.0.3 |
| @lezer/lr | 1.4.10 |
| @marijn/find-cluster-break | 1.0.3 |
| crelt | 1.0.7 |
| style-mod | 4.1.3 |
| w3c-keyname | 2.2.8 |
