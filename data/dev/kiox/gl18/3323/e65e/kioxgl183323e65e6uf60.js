// dev — the Development app's boot (the R-2 flip: this control's facets ARE
// the app the platform serves at /dev/; its commands — compile, rebuild_lib,
// lib_archive… — predate the boot and stay). It runs under the STOCK mount,
// so this is CLASSIC-script code: no import/export statements.
//
// There is no module world to assemble: shared code lives in LIBRARY
// controls (idempotent window.NB_* globals), and every control's own html
// declares its libraries as hidden child divs — the platform's nested-
// composition idiom. The boot's whole job is the boot-level plugin pass
// and mounting the frame.

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
    // 1. THE PLUGIN PASS (boot level): registry entries targeting dev.dev
    //    install now, before the frame. Boot-level plugins are HEADLESS by
    //    nature: the boot wipes the host before mounting the frame.
    //    Per-control plugins ride the classic dev:plugins div in each host
    //    control's own html instead.
    const pluginHolder = document.createElement("div");
    pluginHolder.id = "devpluginholder";
    pluginHolder.hidden = true;
    host.appendChild(pluginHolder);
    try {
      const r = await new Promise((res) =>
        invokeCommand("dev", "plugins", "list_plugins", {}, res));
      const entries = (r && r.status === "ok" && r.data) ? r.data : {};
      const mounts = [];
      for (const key of Object.keys(entries)) {
        const e = entries[key] || {};
        if (e.target_lib !== "dev" || e.target_ctl !== "dev") continue;
        const slot = (e.selector && document.querySelector(e.selector)) || pluginHolder;
        mounts.push(new Promise((res) => installControl(slot, e.plugin_lib, e.plugin_ctl, res)));
      }
      await Promise.all(mounts);
    } catch (e) { /* no plugin registry on this instance — nothing to mount */ }

    // 2. the frame — a stock mount like any other control
    host.innerHTML = "";
    const frameEl = document.createElement("div");
    frameEl.style.height = "100%";
    host.appendChild(frameEl);
    await new Promise((res) => installControl(frameEl, "dev", "frame", res));
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
})();
