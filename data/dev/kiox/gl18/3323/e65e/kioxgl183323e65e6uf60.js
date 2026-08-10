// dev — the Development app's boot (the R-2 flip: this control's facets ARE
// the app the platform serves at /dev/; its commands — compile, rebuild_lib,
// lib_archive… — predate the boot and stay). It runs under the STOCK mount,
// so this is CLASSIC-script code: no import/export statements; dynamic
// import() only.
//
// The module world (2026-07-30, the owner's design — first-class in api.js):
// shared ES modules are MODULE CONTROLS — ordinary controls whose record
// carries `module: true` (dev.code.set_module_flag). Installing the two
// cluster controls (app.modules, dev.devmodules) registers every flagged
// module on the page, order-free. What a page installs IS its module world —
// no manifest, no environment object, no union directory: every control
// mounts by (lib, name) through installControl, the platform's own mounter.

var me = this;
var ME = document.getElementById(me.UUID);

(async () => {
  const host = ME.querySelector(".nb-bench-boot") || ME;
  const fail = (msg) => {
    host.innerHTML = "";
    const p = document.createElement("p");
    p.className = "nb-boot-err";
    p.textContent = "development failed to boot: " + msg +
      "\n\nIf this is a session problem, sign in via the instance's own UI " +
      "(the sessionid cookie) and reload.";
    host.appendChild(p);
  };
  try {
    // 1. the module world: install the cluster controls — controls
    //    installing controls; each flagged child registers itself with
    //    api.js, and the registry resolves inter-module imports whenever
    //    each arrives (order-free)
    const install = (l, n, el) => new Promise((res) => installControl(el, l, n, res));
    const holder = document.createElement("div");
    holder.hidden = true;
    host.appendChild(holder);
    const clusterEl = () => {
      const d = document.createElement("div");
      holder.appendChild(d);
      return d;
    };
    const pluginHolder = document.createElement("div");
    pluginHolder.id = "devpluginholder";
    pluginHolder.hidden = true;
    holder.appendChild(pluginHolder);
    await Promise.all([
      install("app", "modules", clusterEl()),
      install("dev", "devmodules", clusterEl()),
    ]);

    // 2. THE PLUGIN PASS (boot level): registry entries targeting dev.dev
    //    install now, before the frame — so a plugin's module cluster is
    //    registered by the time anything checks for it. Boot-level plugins
    //    are HEADLESS by nature: the boot wipes the host before mounting
    //    the frame. Per-control plugins ride the classic dev:plugins div
    //    in each host control's own html instead.
    try {
      const { store } = await requireModule("store", "dev-boot");
      await store.ensureConnected();
      const r = await store.invoke("dev", "plugins", "list_plugins", {});
      const env = (r && !(r instanceof Error)) ? r.envelope : null;
      const entries = (env && env.status === "ok" && env.data) ? env.data : {};
      const mounts = [];
      for (const key of Object.keys(entries)) {
        const e = entries[key] || {};
        if (e.target_lib !== "dev" || e.target_ctl !== "dev") continue;
        const slot = (e.selector && document.querySelector(e.selector)) || pluginHolder;
        mounts.push(new Promise((res) => installControl(slot, e.plugin_lib, e.plugin_ctl, res)));
      }
      await Promise.all(mounts);
    } catch (e) { /* no plugin registry on this instance — nothing to mount */ }

    // 3. the frame — a stock mount like any other control
    host.innerHTML = "";
    const frameEl = document.createElement("div");
    frameEl.style.height = "100%";
    host.appendChild(frameEl);
    await new Promise((res) => installControl(frameEl, "dev", "frame", res));
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
})();
