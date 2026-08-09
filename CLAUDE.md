# Newbound — Session Primer

Newbound is a peer-to-peer web platform: one live, journaled, secured,
distributed object graph in which code is data. Commands, flows, scenes,
assets, and memories are all records with attachments in the `data/`
store; flowlang executes them; the IDE (the `dev` library) edits them.
The flowlang and ndata crate READMEs are accurate and current — read
them for the execution model and the data model (ndata's README includes
an LLM-ready system prompt for writing code against it).

## Rules

- **Branches always; nothing merges to master without the owner's
  express permission** (his rule, 2026-08-09).
- **Never edit `data/*` files by hand** — it is a content-addressed
  store. Edits go through the `dev.code` commands; `.mcp.json` attaches
  `newbound mcp` so they're native tools in a coding session
  (`lib-control-command`; every declared param required).
- Mutating experiments run against a disposable copy of the checkout,
  never a live instance.

## Layout

- `src/main.rs` — entry point; subcommands `exec`, `rebuild`, `mcp`.
- `newbound_core/` — platform code: the `app`/`dev`/`peer`/`security`/
  `flow` libraries' generated Rust plus core mechanics (`src/api.rs`).
- `data/<lib>/` — the store: the source of truth the Rust is generated
  from. `newbound rebuild` regenerates; commit store + generated src
  together.
- `cmd/` — generated, gitignored; if absent, the agent repo's
  `tools/gen-cmd-crate.py` writes the empty scaffold so the manifest
  resolves.

## The agent overlay (optional by design)

The LLM harness — `agent`, `kb`, `scratch` libraries and their dylib
crates — lives in **`mraiser/newbound-agent`** and overlays this
checkout via its `tools/overlay.sh` symlinks. The working process for
agent-driven development is that repo's `docs/interim-process.md`, and
the kb library's memory facets (`kb.doctrine`, `kb.workflow`,
`kb.platform-api`) are the accumulated understanding — sessions read
them at start and deposit into them (`dev-code-remember`) at end.
Without the overlay this repo builds and runs standalone
(`cargo build --release --features=serde_support`); the regenerated
initializer that knows the FFI crates is overlay-local state and stays
uncommitted here.
