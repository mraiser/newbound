// loader.js — mounts bench controls. Two sources, one control shape:
//
//  · static mode (this repo served as plain files): fetches
//    controls/<name>/<name>.html|css|js — the authoring layout.
//  · platform mode (the published bench app at /<lib>/): the bench
//    control's boot facet builds the shared modules as blob URLs from
//    their module controls' facets and sets globalThis.__benchPlatform
//    BEFORE importing this module — so here, platform mode means "that
//    global exists". Controls mount from their html/css/js FACETS via
//    app/read. Code lives in controls (the owner's rule, 2026-07-25);
//    _ASSETS carries only media and the vendored bundles, which keep
//    real URLs under /app/asset/<lib>/vendor/.
//
// In platform mode a control's js facet is imported as a Blob module after
// rewriting its imports: "../../assets/<module>" specifiers become the
// boot's blob URLs (same URL string = same module instance), and any other
// "../../" specifier (the vendored bundles) becomes an absolute asset URL —
// blob modules cannot resolve relative specifiers.
//
// Controls resolve CROSS-LIBRARY through the boot's union directory
// (__benchPlatform.controls: name -> {lib, id}) — the Great Refactoring's
// R-1, where the IDE's controls may live in ANY library while the boot stays
// behind /<lib>/. A boot that didn't build the directory falls back to the
// boot library's own index.

const P = globalThis.__benchPlatform ?? null;
export const PLATFORM_LIB = P ? P.lib : null;
export const ROOT = P
  ? new URL(`/app/asset/${P.lib}/`, location.origin)  // vendor + media base
  : new URL("../", import.meta.url);

const defs = new Map();

// ── the plugin pass (dev.plugins, the owner's mechanism — revived) ─────────
// runtime/dev/plugins.json entries: {target_lib, target_ctl, plugin_lib,
// plugin_ctl, selector}. Stock hosts keep the classic `dev:plugins` div
// idiom; BENCH-dialect hosts get the same semantics here — after a control
// mounts, every entry targeting it installs at its selector via the
// platform's own installControl (module clusters mount headless; stock UI
// plugins render into the slot). Fetched once per page, fire-and-forget.
let pluginsP = null;
function pluginEntries(store) {
  // store.invoke wraps the reply as {envelope, ms} (or an Error value) —
  // unwrap before reading status, or the registry always reads as empty.
  pluginsP ??= store.invoke("dev", "plugins", "list_plugins", {})
    .then((r) => {
      const env = (r && !(r instanceof Error)) ? r.envelope : null;
      return (env && env.status === "ok" && env.data) ? env.data : {};
    })
    .catch(() => ({}));
  return pluginsP;
}

async function pluginPass(name, home) {
  if (!P || typeof installControl !== "function") return;
  const { store } = await import(P.moduleUrls["assets/store.js"]);
  const entries = await pluginEntries(store);
  for (const key of Object.keys(entries)) {
    const e = entries[key] || {};
    if (e.target_ctl !== name) continue;
    if (e.target_lib && home && e.target_lib !== home.lib) continue;
    const el = e.selector ? document.querySelector(e.selector) : null;
    if (!el || el.dataset.nbPlugin) continue;   // slot gone, or already filled
    el.dataset.nbPlugin = key;
    installControl(el, e.plugin_lib, e.plugin_ctl, null,
      { lib: home ? home.lib : P.lib, name, id: home ? home.id : null });
  }
}

async function ensureConnected(store) {
  if (store.connected()) return;
  // Platform boot: same origin, session from the cookie (nb.js omits the
  // session_id param when empty). A saved same-origin live config wins so
  // the "saves ON" toggle survives reloads.
  const saved = store.savedConfig();
  const cfg = saved?.mode === "live" && saved.baseUrl === location.origin
    ? saved
    : { mode: "live", baseUrl: location.origin, sessionid: "", writable: false };
  const result = await store.connect(cfg);
  if (result instanceof Error) {
    throw new Error(
      `cannot read the platform this bench is served from: ${result.message}`);
  }
}

async function loadStatic(name) {
  const base = new URL(`controls/${name}/`, ROOT);
  const [html, css, mod] = await Promise.all([
    fetch(new URL(`${name}.html`, base), { cache: "no-cache" }).then((r) => r.text()),
    fetch(new URL(`${name}.css`, base), { cache: "no-cache" }).then((r) => r.text()),
    import(new URL(`${name}.js`, base).href),
  ]);
  return { html, css, mod };
}

async function loadFacets(name) {
  const { store } = await import(P.moduleUrls["assets/store.js"]);
  await ensureConnected(store);
  let home = P.controls ? P.controls[name] : null;
  if (!home) {
    const controls = await store.controls(PLATFORM_LIB);
    if (controls instanceof Error) throw controls;
    const entry = controls.find((c) => c.name === name);
    if (!entry) throw new Error(`no control "${name}" in library "${PLATFORM_LIB}"`);
    home = { lib: PLATFORM_LIB, id: entry.id };
  }
  const record = await store.control(home.lib, home.id);
  if (record instanceof Error) throw record;
  defs.get("__home:" + name) ?? defs.set("__home:" + name, home);
  let src = record.js ?? "";
  for (const [path, url] of Object.entries(P.moduleUrls)) {
    src = src.split(`"../../${path}"`).join(`"${url}"`);
  }
  // Vendored bundles live in per-vendor libraries (the boot's VENDORS map,
  // exposed as assetRoots) — rewrite those first; anything left falls back
  // to the boot library's asset base.
  for (const [prefix, base] of Object.entries(P.assetRoots ?? {})) {
    src = src.split(`from "../../${prefix}/`)
             .join(`from "${new URL(base, location.origin).href}${prefix}/`);
  }
  src = src.replace(/from "\.\.\/\.\.\//g, `from "${ROOT.href}`);
  const blobUrl = URL.createObjectURL(
    new Blob([src], { type: "text/javascript" }));
  try {
    const mod = await import(blobUrl);
    return { html: record.html ?? "", css: record.css ?? "", mod };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export async function mountControl(name, host, props = {}) {
  let def = defs.get(name);
  if (!def) {
    def = PLATFORM_LIB ? await loadFacets(name) : await loadStatic(name);
    defs.set(name, def);
  }
  if (!document.querySelector(`style[data-control="${name}"]`)) {
    const style = document.createElement("style");
    style.dataset.control = name;
    style.textContent = def.css;
    document.head.appendChild(style);
  }
  host.innerHTML = def.html;
  const out = def.mod.init(host, props);
  pluginPass(name, defs.get("__home:" + name)).catch(() => {});
  return out;
}
