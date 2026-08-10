// store.js — connection state and cached reads over the wire client (nb.js).
// Every control reads platform data through this module; nothing else caches.

import { MockClient, NewboundClient, ok, payload } from "./nb.js";

const CONFIG_KEY = "bench.connection";
// Fixtures ride the repo (static/mock dev mode). Platform-served bench
// loads this module as a BLOB (no resolvable base URL) — mock mode is
// unavailable there, and connect() says so instead of throwing here.
const FIXTURES = (() => {
  try {
    return new URL("../harness/fixtures/", import.meta.url).href;
  } catch {
    return null;
  }
})();

let client = null;
let config = null;
const cache = new Map();

function cached(key, fetcher) {
  if (!cache.has(key)) {
    cache.set(key, fetcher().then((value) => {
      if (value instanceof Error) cache.delete(key);
      return value;
    }));
  }
  return cache.get(key);
}

/** Unwrap an envelope or return an Error (never throws — callers branch). */
function unwrap(envelope) {
  return ok(envelope) ? payload(envelope) : new Error(envelope.msg || "request failed");
}

export const store = {
  /** cfg: {mode:"mock"} or {mode:"live", baseUrl, sessionid}. Persisted. */
  async connect(cfg) {
    if (cfg.mode === "mock" && !FIXTURES) {
      return new Error("mock mode is unavailable in the platform-served bench "
        + "(fixtures ship with the repo)");
    }
    client = cfg.mode === "mock"
      ? await MockClient.load(FIXTURES)
      : new NewboundClient(cfg);
    config = cfg;
    cache.clear();
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    const probe = await this.libs();
    if (probe instanceof Error) {
      client = null;
      config = null;
      return probe;
    }
    return { mode: cfg.mode, libCount: probe.length };
  },

  savedConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY));
    } catch {
      return null;
    }
  },

  connected() {
    return client !== null;
  },

  mode() {
    return config?.mode ?? null;
  },

  /** All libraries (library meta objects, from app/libs). */
  libs() {
    return cached("libs", async () => unwrap(await client.libs()));
  },

  /** A library's control index: [{ctl, db, id, lib, name}]. Checks the
      (cached) library list first: an uninstalled library answers an
      Error without a wire call, so an absent optional library costs no
      request and no server noise. */
  controls(lib) {
    return cached(`controls:${lib}`, async () => {
      const libs = await this.libs();
      if (Array.isArray(libs) && !libs.some((l) => l.id === lib)) {
        return new Error(`library "${lib}" is not installed on this instance`);
      }
      const data = unwrap(await client.read(lib, "controls"));
      return data instanceof Error ? data : (data.list ?? []);
    });
  },

  /** A control record with facets inlined (html/css/js/data/three/cmd). */
  control(lib, id) {
    return cached(`control:${lib}:${id}`, async () =>
      unwrap(await client.read(lib, id)));
  },

  /** The full read envelope — app/read is FLAT, so record-level fields
      (readers, writers, time) sit beside `data`. The write adapter needs them. */
  controlEnvelope(lib, id) {
    return client.read(lib, id);
  },

  /** True when this connection may save (live + explicitly enabled). */
  writable() {
    return Boolean(config?.mode === "live" && config?.writable);
  },

  /** Drop a control from the cache (after a save). */
  invalidateControl(lib, id) {
    cache.delete(`control:${lib}:${id}`);
  },

  /** Drop a library's control index (after adding/removing a control) —
      without this a new control stays invisible until a page reload. */
  invalidateControls(lib) {
    cache.delete(`controls:${lib}`);
  },

  /** Drop the library list (after adding a library). */
  invalidateLibs() {
    cache.delete("libs");
  },

  // ── the write adapter ────────────────────────────────────
  // One save path: dev.editcontrol.save_control invoked by id via app/exec.
  // Validated on a disposable instance (CONTRACT §2.6): the command reads the
  // existing record, so full current state must be passed — all three ui
  // facets, groups/desc verbatim, readers from the record, and inline_data
  // rebuilt from the record's data refs (or they would be dropped).

  async saveCommandId() {
    return cached("cmdid:save_control", async () => {
      const controls = await this.controls("dev");
      if (controls instanceof Error) return controls;
      const editcontrol = controls.find((c) => c.name === "editcontrol");
      if (!editcontrol) return new Error("dev.editcontrol not found");
      const record = await this.control("dev", editcontrol.id);
      if (record instanceof Error) return record;
      const cmd = record.cmd?.find((c) => c.name === "save_control");
      return cmd ? cmd.id : new Error("save_control not found on dev.editcontrol");
    });
  },

  /** Save one ui facet (html|css|js). Returns {ok:true} or Error. */
  async saveControlFacet(lib, ctlId, facet, source) {
    if (!this.writable()) return new Error("this connection is read-only");
    const cmdId = await this.saveCommandId();
    if (cmdId instanceof Error) return cmdId;

    const envelope = await this.controlEnvelope(lib, ctlId);
    if (!ok(envelope)) return new Error(envelope.msg || "read failed");
    const record = envelope.data;

    const inlineData = {};
    for (const ref of record.data ?? []) {
      const sub = await client.read(lib, ref.id);
      if (!ok(sub)) return new Error(`could not read data record ${ref.name}`);
      inlineData[ref.name] = sub.data;
    }

    const args = {
      lib,
      id: ctlId,
      html: facet === "html" ? source : record.html ?? "",
      css: facet === "css" ? source : record.css ?? "",
      js: facet === "js" ? source : record.js ?? "",
      groups: record.groups ?? "",
      desc: record.desc ?? "",
      inline_data: inlineData,
      readers: envelope.readers ?? [],
    };
    const result = await client.exec("dev", cmdId, args);
    if (!ok(result)) return new Error(result.msg || "save failed");
    this.invalidateControl(lib, ctlId);
    return { ok: true };
  },

  /** Invoke a command by names (lib ▸ ctl ▸ cmd), resolving its id via the
      cached indexes. Returns {envelope, ms} or Error. Powers the session. */
  async invoke(lib, ctlName, cmdName, args = {}) {
    const controls = await this.controls(lib);
    if (controls instanceof Error) return controls;
    const ctl = controls.find((c) => c.name === ctlName);
    if (!ctl) return new Error(`no control "${ctlName}" in ${lib}`);
    const record = await this.control(lib, ctl.id);
    if (record instanceof Error) return record;
    const cmd = record.cmd?.find((c) => c.name === cmdName);
    if (!cmd) return new Error(`no command "${cmdName}" on ${lib} ▸ ${ctlName}`);
    const started = performance.now();
    const envelope = await client.exec(lib, cmd.id, args);
    return { envelope, ms: Math.round(performance.now() - started) };
  },

  // ── the dev.code write API (CONTRACT §6, [live]) ─────────
  // The command family on dev.code, exec'd by id like everything else.
  // FLAT returns: fields sit top-level on the envelope; err envelopes carry
  // msg (and current_hash for stale_base). codeCall never throws and never
  // returns Error — always an envelope, so callers branch on status only.

  codeCmdIds() {
    return cached("code:cmdids", async () => {
      const controls = await this.controls("dev");
      if (controls instanceof Error) return controls;
      const code = controls.find((c) => c.name === "code");
      if (!code) return new Error("dev.code not found");
      const record = await this.control("dev", code.id);
      if (record instanceof Error) return record;
      return Object.fromEntries((record.cmd ?? []).map((c) => [c.name, c.id]));
    });
  },

  /** True when the CONTRACT §6 write API is resolvable on this connection
      (live mode + the instance carries the new commands). */
  async patchApi() {
    if (this.mode() !== "live") return false;
    const ids = await this.codeCmdIds();
    return !(ids instanceof Error) && Boolean(ids.patch_control_facet);
  },

  async codeCall(name, args) {
    const ids = await this.codeCmdIds();
    if (ids instanceof Error) return { status: "err", msg: ids.message };
    if (!ids[name]) {
      return { status: "err", msg: `dev.code.${name} not found — is the write API built on this instance?` };
    }
    return client.exec("dev", ids[name], args);
  },

  readFacet(lib, ctl, facet) {
    return this.codeCall("read_control_facet", { lib, ctl, facet });
  },

  /** One exact-match edit; empty oldSnippet creates/replaces the whole
      facet. author is this bench's user — other callers send their own. */
  async patchFacet(lib, ctl, facet, { oldSnippet, newSnippet, base = "", label = "" }) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    return this.codeCall("patch_control_facet", {
      lib, ctl, facet,
      old_snippet: oldSnippet, new_snippet: newSnippet,
      base, label, author: user?.displayname || user?.id || "bench",
    });
  },

  listPatches(lib, ctl, limit = 0) {
    return this.codeCall("list_control_patches", { lib, ctl, limit });
  },

  /** desc/groups setters. Empty string = leave untouched (v1 cannot clear
      a field — CONTRACT §6); send "" for anything unchanged. */
  setControlMeta(lib, ctl, desc, groups) {
    if (!this.writable()) return Promise.resolve({ status: "err", msg: "this connection is read-only" });
    return this.codeCall("set_control_meta", { lib, ctl, desc, groups });
  },

  setCommandMeta(lib, ctl, cmd, desc, groups) {
    if (!this.writable()) return Promise.resolve({ status: "err", msg: "this connection is read-only" });
    return this.codeCall("set_command_meta", { lib, ctl, cmd, desc, groups });
  },

  setLibraryMeta(lib, desc, groups) {
    if (!this.writable()) return Promise.resolve({ status: "err", msg: "this connection is read-only" });
    return this.codeCall("set_library_meta", { lib, desc, groups });
  },

  /** Comma-delimited CATEGORIZATION tags at any level — ctl=""/cmd="" step
      up to library/control. Explicit replace: "" clears (CONTRACT §6.8).
      Tags carry no permission meaning; the security field is groups. */
  async setTags(lib, ctl, cmd, tags) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    return this.codeCall("set_tags", {
      lib, ctl, cmd, tags, author: user?.displayname || user?.id || "bench",
    });
  },

  /** The SECURITY-group string, explicitly (CONTRACT §6.8, "" clears) — the
      deliberate permission act. The platform derives the ENFORCED readers
      arrays from this string (set_groups writes both, at every level), so
      this is the one write that changes who can see and run things. Empty
      string clears the field: admin-only. */
  async setGroups(lib, ctl, cmd, groups) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    return this.codeCall("set_groups", {
      lib, ctl, cmd, groups, author: user?.displayname || user?.id || "bench",
    });
  },

  /** Known security groups (the union across users, plus anonymous), for
      pickers. security/groups is admin-gated server-side; anything but an
      ok array — mock mode, a non-admin session — answers []. */
  async securityGroups() {
    try {
      const r = await client.call("security", "groups", {});
      return r?.status === "ok" && Array.isArray(r.data) ? r.data : [];
    } catch { return []; }
  },

  // ── the flow-body pair (CONTRACT §6, [live] 2026-07-25) ───────────────────
  // Whole-Case reads/writes for the 3D flow editor. ctl/cmd are NAMES (like
  // every write-API command). `body` travels as a JSON object inside the exec args
  // (the command receives the Case; it re-derives params/returntype from the
  // bars). FLAT returns: fields sit top-level on the envelope.

  /** {status, body, hash, exists} — the Case graph as JSON + concurrency hash. */
  readFlowBody(lib, ctl, cmd) {
    return this.codeCall("read_flow_body", { lib, ctl, cmd });
  },

  /** Whole-Case write. base = the hash from the last read (empty = unguarded);
      stale base ⇒ {status:"err", msg:"stale_base", current_hash}. Creates the
      flow command when absent (created:true). */
  async writeFlowBody(lib, ctl, cmd, body, { base = "", label = "" } = {}) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    return this.codeCall("write_flow_body", {
      lib, ctl, cmd, body, base, label,
      author: user?.displayname || user?.id || "bench",
    });
  },

  /** True when the flow-body pair is resolvable on this connection.
      Gates the 3D editor's editing mode. */
  async flowApi() {
    if (this.mode() !== "live") return false;
    const ids = await this.codeCmdIds();
    return !(ids instanceof Error) && Boolean(ids.write_flow_body);
  },

  // ── the scene pair (CONTRACT §6 [proposed] — scene-facet-design Part VI) ──
  // Whole-object reads/writes of the control's `scene` facet, the flow-body
  // idiom verbatim: content hash on read, hash-guarded create-when-absent
  // write, journaled on the control's _patches with facet:"scene". There is
  // NO fallback path (dev.save_control preserves but cannot write `scene`) —
  // without this pair the scene pane is view/play only.

  /** {status, scene, hash, exists} — the facet as JSON + concurrency hash. */
  readControlScene(lib, ctl) {
    return this.codeCall("read_control_scene", { lib, ctl });
  },

  /** Whole-object write. base = the hash from the last read (empty =
      unguarded); stale ⇒ {status:"err", msg:"stale_base", current_hash}.
      Creates the facet when absent (created:true). Never touches any other
      record key — legacy `three` included. */
  async writeControlScene(lib, ctl, scene, { base = "", label = "" } = {}) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    const r = await this.codeCall("write_control_scene", {
      lib, ctl, scene, base, label,
      author: user?.displayname || user?.id || "bench",
    });
    if (r.status === "ok") {
      const controls = await this.controls(lib);
      const entry = (controls instanceof Error ? [] : controls).find((c) => c.name === ctl);
      if (entry) this.invalidateControl(lib, entry.id);
    }
    return r;
  },

  /** True when the scene pair is resolvable on this connection.
      Gates the scene editor's save affordance. */
  async sceneApi() {
    if (this.mode() !== "live") return false;
    const ids = await this.codeCmdIds();
    return !(ids instanceof Error) && Boolean(ids.write_control_scene);
  },

  /** Execute a command via dev.code.invoke_command (the validator's door —
      it EXECUTES the flow). The 3D editor's run affordance; kept behind the
      writable gate: running arbitrary flows is a disposable-instance
      activity, same posture as saves. */
  invokeCommand(lib, ctl, cmd, args = {}) {
    if (!this.writable()) return Promise.resolve({ status: "err", msg: "this connection is read-only" });
    return this.codeCall("invoke_command", { lib, ctl, cmd, args });
  },

  /** Create an empty control in a library (the record + its index entry);
      its facets are then created by saving them (patch_control_facet with
      an empty old_snippet). Existing name ⇒ the platform errs. */
  async addControl(lib, ctl) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const r = await this.codeCall("add_control", { lib, ctl });
    if (r.status === "ok") this.invalidateControls(lib);
    return r;
  },

  /** Create or replace a TEXT command (rust/python/…) — writes the records
      and compiles, so an err with kind "compile_error" means "stored, did
      not build". params: [{name, type}] in flowlang types. */
  async upsertCommand(lib, ctl, cmd, { lang, returnType, params = [], imports = "", codeBody = "" }) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const r = await this.codeCall("upsert_command", {
      lib, ctl, cmd, lang, return_type: returnType, params,
      imports, code_body: codeBody,
    });
    if (r.status === "ok" || r.kind === "compile_error") this.invalidateControls(lib);
    return r;
  },

  /** Create an empty library. */
  async addLibrary(lib) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const r = await this.codeCall("add_library", { lib });
    if (r.status === "ok") {
      this.invalidateLibs();
      this.invalidateControls(lib);
    }
    return r;
  },

  // ── deletion (CONTRACT §6.1) ─────────────────────────────
  // The create surface's inverse, with three different history stories:
  // delete_command journals on the control's _patches (old = both records,
  // so a revert re-authors from the entry); delete_control is TERMINAL for
  // that journal — it dies with the control, git is the remaining history;
  // delete_library has rmdir semantics — it refuses while any control
  // remains, so each control deletion stays an explicit act.

  async deleteCommand(lib, ctl, cmd) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    const r = await this.codeCall("delete_command", {
      lib, ctl, cmd, author: user?.displayname || user?.id || "bench",
    });
    if (r.status === "ok") this.invalidateControls(lib);
    return r;
  },

  async deleteControl(lib, ctl) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    const r = await this.codeCall("delete_control", {
      lib, ctl, author: user?.displayname || user?.id || "bench",
    });
    if (r.status === "ok") this.invalidateControls(lib);
    return r;
  },

  async deleteLibrary(lib) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    const r = await this.codeCall("delete_library", {
      lib, author: user?.displayname || user?.id || "bench",
    });
    if (r.status === "ok") {
      this.invalidateLibs();
      this.invalidateControls(lib);
    }
    return r;
  },

  // ── assets (P1 commands; CONTRACT §6) ────────────────────
  listAssets(lib) {
    return this.codeCall("list_assets", { lib });
  },

  /** Create/replace one asset. Inline `content` for UTF-8 text; `tempfile`
      is a server-side path the platform copies in (works when the bench's
      instance shares the caller's machine — CONTRACT §6 upload caveat). */
  writeAsset(lib, name, content, tempfile = "") {
    if (!this.writable()) return Promise.resolve({ status: "err", msg: "this connection is read-only" });
    return this.codeCall("write_asset", { lib, name, content, tempfile });
  },

  renameAsset(lib, from, to) {
    if (!this.writable()) return Promise.resolve({ status: "err", msg: "this connection is read-only" });
    return this.codeCall("rename_asset", { lib, from, to });
  },

  deleteAsset(lib, name) {
    if (!this.writable()) return Promise.resolve({ status: "err", msg: "this connection is read-only" });
    return this.codeCall("delete_asset", { lib, name });
  },

  /** A command's implementation record (code under its ext key — `rs` for
      rust — plus import/params/returntype/type/desc). read_command returns
      an Object envelope, so the payload sits under `data` (CONTRACT §6
      envelope note); flatten it for callers. */
  async readCommand(lib, ctl, cmd) {
    const r = await this.codeCall("read_command", { lib, ctl, cmd });
    if (r.status !== "ok") return r;
    return { status: "ok", ...(r.data && typeof r.data === "object" ? r.data : {}) };
  },

  /** One exact-match edit to a TEXT command body (rust/js/python) —
      patch_command_body recompiles on success. Never call for flow
      commands (their body is an object; use writeFlowBody). No base-hash
      concurrency exists on this pre-existing command: exact-match is the
      only guard. */
  patchCommandBody(lib, ctl, cmd, oldSnippet, newSnippet) {
    if (!this.writable()) return Promise.resolve({ status: "err", msg: "this connection is read-only" });
    return this.codeCall("patch_command_body", {
      lib, ctl, cmd, old_snippet: oldSnippet, new_snippet: newSnippet,
    });
  },

  /** Replace a text command's file-level `use`/import block (the impl
      record's import field) — the one section patch_command_body cannot
      reach. set_command_imports recompiles; flow commands are refused. */
  setCommandImports(lib, ctl, cmd, imports) {
    if (!this.writable()) return Promise.resolve({ status: "err", msg: "this connection is read-only" });
    return this.codeCall("set_command_imports", { lib, ctl, cmd, imports });
  },

  // ── timers/events (P2 commands; CONTRACT §6) ─────────────
  // Replace-only (Q7): a set_* wholly replaces the named binding's
  // component record — no partial patching. Registration is live (the dev
  // editor's timeron/eventon), so a set timer FIRES for real: saves stay
  // pointed at disposable instances, same as every other write.

  async setTimer(lib, ctl, { name, cmd, start, startunit, interval, intervalunit, repeat }) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    return this.codeCall("set_timer", {
      lib, ctl, name, cmd, start, startunit, interval, intervalunit, repeat,
      author: user?.displayname || user?.id || "bench",
    });
  },

  async removeTimer(lib, ctl, name) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    return this.codeCall("remove_timer", {
      lib, ctl, name, author: user?.displayname || user?.id || "bench",
    });
  },

  async setEventHandler(lib, ctl, { name, bot, event, cmd }) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    return this.codeCall("set_event_handler", {
      lib, ctl, name, bot, event, cmd,
      author: user?.displayname || user?.id || "bench",
    });
  },

  async removeEventHandler(lib, ctl, name) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    return this.codeCall("remove_event_handler", {
      lib, ctl, name, author: user?.displayname || user?.id || "bench",
    });
  },

  // ── add-on backends ──────────────────────────────────────
  // The store carries NO add-on-specific API. An optional library's
  // provider module (installed through the plugin registry) makes its
  // own calls with the generic surface above — controls()/control()/
  // invoke() — and owns its library and command names itself.

  /** Current server-side source of one facet — the conflict check. */
  // ── R-2 gap bar + ports (great-refactoring.md) ───────────

  /** The app-command GET url (/<app>/<command>?k=v) — the ONLY route that
      honors a File return by streaming the file (app/exec answers with the
      server-side PATH as JSON instead — verified). dev.dev.lib_archive's
      download link is this; same-origin, the session rides the cookie. */
  appCmdUrl(app, cmdName, params = {}) {
    const qs = Object.entries(params).map(([k, v]) =>
      `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
    return `${client.baseUrl}/${app}/${cmdName}${qs ? "?" + qs : ""}`;
  },

  /** The instance's meta identity (runtime/metaidentity) — publishing signs
      libraries with it, and publishapp panics while the record is absent
      (its known FIXME); the publish panel's form creates it. Read through
      the API pair: /app/read cannot serve the runtime lib (it answers 500 —
      store-only, never app-loaded). */
  metaIdentity() {
    return this.codeCall("get_meta_identity", {});
  },

  setMetaIdentity(displayname, organization) {
    const user = this.user();
    return this.codeCall("set_meta_identity", {
      displayname, organization,
      author: user?.displayname || user?.id || "bench",
    });
  },

  // ── the plugins registry (dev.plugins, CONTRACT §6.7) ─────
  // runtime/dev/plugins.json: when the TARGET control is on a page, the
  // PLUGIN control mounts at SELECTOR. Reads go through the mechanism's
  // own dev.plugins.list_plugins; writes are the Q7-style setters on
  // dev.code. Per-instance runtime state — unjournaled, applies on the
  // next reload.
  async listPlugins() {
    const got = await this.invoke("dev", "plugins", "list_plugins", {});
    if (got instanceof Error) return got;
    if (got.envelope.status !== "ok") {
      return new Error(got.envelope.msg ?? "list_plugins failed");
    }
    return got.envelope.data ?? {};
  },

  async setPlugin(name, entry) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    return this.codeCall("set_plugin", {
      name,
      target_lib: entry.target_lib, target_ctl: entry.target_ctl,
      plugin_lib: entry.plugin_lib, plugin_ctl: entry.plugin_ctl,
      selector: entry.selector,
      author: user?.displayname || user?.id || "bench",
    });
  },

  async removePlugin(name) {
    if (!this.writable()) return { status: "err", msg: "this connection is read-only" };
    const user = await this.user();
    return this.codeCall("remove_plugin", {
      name, author: user?.displayname || user?.id || "bench",
    });
  },

  async facetOnServer(lib, ctlId, facet) {
    const envelope = await client.read(lib, ctlId);
    if (!ok(envelope)) return new Error(envelope.msg || "read failed");
    return envelope.data[facet] ?? "";
  },

  /** Signed-in user, or null when unavailable (mock mode / anonymous). */
  user() {
    return cached("user", async () => {
      const data = unwrap(await client.currentUser());
      return data instanceof Error ? null : data;
    });
  },

  /** Warm the controls cache for every library — powers jump's index. */
  async prefetchControls() {
    const libs = await this.libs();
    if (libs instanceof Error) return;
    await Promise.all(libs.map((lib) =>
      this.controls(lib.id).catch(() => null)));
  },

  /** Everything jump can search: libraries and loaded controls. */
  async searchIndex() {
    const libs = await this.libs();
    if (libs instanceof Error) return [];
    const rows = libs.map((lib) => ({ kind: "lib", name: lib.id, lib: lib.id }));
    for (const lib of libs) {
      const key = `controls:${lib.id}`;
      if (!cache.has(key)) continue;
      const controls = await cache.get(key);
      if (controls instanceof Error) continue;
      for (const ctl of controls) {
        rows.push({ kind: "ctl", name: ctl.name, lib: lib.id, id: ctl.id });
      }
    }
    return rows;
  },
};
