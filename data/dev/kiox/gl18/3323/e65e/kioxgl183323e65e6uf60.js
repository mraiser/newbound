// dev — the Development app's boot (the R-2 flip: this control's facets
// ARE the app the platform serves at /dev/; its commands — compile,
// rebuild_lib, lib_archive… — predate the boot and stay). It runs under
// the STOCK mount: the shell's body is a data-control that
// activateControls wraps as `el.api = new function(){ ...this facet... }`,
// so this file is CLASSIC-script code — no import/export statements;
// dynamic import() only.
//
// The module world (2026-07-30, the owner's design — first-class in
// api.js): shared ES modules are MODULE CONTROLS — ordinary controls whose
// record carries `module: true` (agent.code.set_module_flag). Installing a
// flagged control registers its js facet as a named ES module on the page
// (api.js: promise registry, order-free, css facets inject once) instead
// of mounting UI. So this boot simply INSTALLS the two cluster controls —
// app.modules and dev.devmodules, whose html facets list module divs (the
// platform's own nested-composition idiom) — try-installs the OPTIONAL
// agent add-on, then hands the loader the union control directory. There
// is no manifest anywhere: what a page installs IS its module world. The
// static entry (index.html, repo-only) never runs this — it imports
// ./assets/loader.js off real files.

(async () => {
  const host = document.querySelector(".nb-bench-boot") || document.body;
  const fail = (msg) => {
    host.innerHTML = "";
    const p = document.createElement("p");
    p.className = "nb-boot-err";
    p.textContent = "development failed to boot: " + msg +
      "\n\nIf this is a session problem, sign in via the instance's own UI " +
      "(the sessionid cookie) and reload. If modules are missing, rerun " +
      "tools/install-bench.py against this instance.";
    host.appendChild(p);
  };
  try {
    // The shell's body carries {"lib","id"} — this boot control's own library.
    let lib = "dev";
    try {
      const dc = JSON.parse(document.body.dataset.control);
      if (dc && dc.lib) lib = dc.lib;
    } catch (e) { /* not the published shell — keep the default */ }

    const read = async (l, id) => {
      const r = await fetch("/app/read?lib=" + encodeURIComponent(l) +
                            "&id=" + encodeURIComponent(id));
      const j = await r.json();
      if (j.status !== "ok") throw new Error(j.msg || "app/read failed");
      return j;
    };

    // 0. declare the platform environment BEFORE the module world builds:
    //    a module may read it at import time (the loader's module-level
    //    ROOT), and imports run as installs complete — so the object must
    //    exist first and is FILLED IN PLACE below.
    const bench = globalThis.__benchPlatform = {
      lib, moduleUrls: {}, controls: {},
      assetRoots: { "vendor/nb_three": "/app/asset/app/",
                    "vendor/nb_codemirror": "/app/asset/dev/" },
    };

    // 1. the module world: install the cluster controls — controls
    //    installing controls; each flagged child registers itself with
    //    api.js, and the registry resolves inter-module imports whenever
    //    each arrives (order-free)
    const install = (l, n, el) => new Promise((res) => installControl(el || null, l, n, res));
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
      install(lib, "devmodules", clusterEl()),
    ]);

    // 2. the union control directory (cross-library mounts, R-1): one
    //    index read per library the IDE spans; first library wins a name.
    //    Optional add-ons (the agent library) are consulted only when the
    //    instance's library list says they are installed — a plugin that
    //    isn't there costs no failed call and no server-side complaint.
    let installed = null;
    try {
      const lr = await fetch("/app/libs");
      const lj = await lr.json();
      if (Array.isArray(lj.data)) installed = new Set(lj.data.map((x) => x.id));
    } catch (e) { /* list unavailable — fall back to probing each library */ }
    const libs = [lib, "app", "agent"].filter((l) => !installed || installed.has(l));
    for (const l of libs) {
      try {
        const idx = await read(l, "controls");
        for (const c of (idx.data.list || [])) {
          if (!bench.controls[c.name]) bench.controls[c.name] = { lib: l, id: c.id };
        }
      } catch (e) { /* a library may be absent (the agent add-on) */ }
    }

    // 3. THE PLUGIN PASS (the owner's mechanism, revived): entries in
    //    runtime/dev/plugins.json targeting THIS control (dev.dev) install
    //    now, before the frame — so a plugin's module cluster (the agent
    //    notebook) is registered by the time anything checks for it.
    //    Boot-level plugins are HEADLESS by nature: the boot wipes the host
    //    before mounting the frame, so UI plugins should target bench
    //    surfaces instead (the loader runs this same pass per mount).
    try {
      const pid = (bench.controls["plugins"] || {}).id;
      if (pid) {
        const prec = await read("dev", pid);
        const pcmd = (prec.data.cmd || []).find((c) => c.name === "list_plugins");
        if (pcmd) {
          const pr = await fetch("/app/exec?lib=dev&id=" + encodeURIComponent(pcmd.id) +
                                 "&args=" + encodeURIComponent("{}"));
          const pj = await pr.json();
          const entries = (pj && pj.status === "ok" && pj.data) ? pj.data : {};
          const mounts = [];
          for (const key of Object.keys(entries)) {
            const e = entries[key] || {};
            if (e.target_lib !== lib || e.target_ctl !== lib) continue;
            const slot = (e.selector && document.querySelector(e.selector)) || pluginHolder;
            mounts.push(new Promise((res) => installControl(slot, e.plugin_lib, e.plugin_ctl, res)));
          }
          await Promise.all(mounts);
        }
      }
    } catch (e) { /* no plugin registry on this instance — nothing to mount */ }

    // 4. what the loader consumes: module urls straight from the page's
    //    REGISTRY (api.js NB_MODULES) — filled into the declared object
    for (const n of Object.keys(NB_MODULES)) {
      if (NB_MODULES[n].url) bench.moduleUrls["assets/" + n + ".js"] = NB_MODULES[n].url;
    }

    const loader = await requireModule("loader");
    host.innerHTML = "";
    await loader.mountControl("frame", host);
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
})();
