// frame — the persistent chrome: wordmark, two-level breadcrumb, jump slot,
// connection chip, and the hash router that mounts shelf/workbench into the
// stage. Routes: #/shelf · #/shelf/<lib> · #/bench/<lib>/<ctlId>


var me = this;
var ME = document.getElementById(me.UUID);

var readyP = new Promise(function (res) { me.ready = res; }).then(async () => {
  const { hasWebGL } = window.NB_WEBGL;
  const { viewctx } = window.NB_VIEWCTX;
  const jsonP = (c2, v2) => new Promise((res2) => json(c2, v2, res2));
  const readRec = async (l2, id2) => {
    const r2 = await jsonP("../app/read", "lib=" + encodeURIComponent(l2) + "&id=" + encodeURIComponent(id2));
    return r2.status === "ok" ? r2.data : new Error(r2.msg || "read failed");
  };
  // mount a child control and resolve with its api once it is ready —
  // installControl is the platform's own mounter; waitReady is the
  // convention converted controls expose when their setup is async
  const MOUNT_HOMES = { sceneplayer: "app" };
  function mount(name, el, props) {
    return new Promise(function (res) {
      installControl(el, MOUNT_HOMES[name] || "dev", name, function (api) {
        if (api && api.waitReady) api.waitReady(function () { res(api); });
        else res(api);
      }, props || {});
    });
  }

async function init(host) {
  const stage = host.querySelector(".fr-stage");
  const crumb = {
    shelf: host.querySelector(".seg-shelf"),
    sep1: host.querySelector(".sep"),
    lib: host.querySelector(".seg-lib"),
    sep2: host.querySelector(".sep2"),
    ctl: host.querySelector(".seg-ctl"),
  };
  const connBtn = host.querySelector(".fr-conn");

  const toast = await mount("toast", host.querySelector(".fr-toast-slot"));

  const nav = {
    openLib: (lib) => { location.hash = `#/shelf/${lib}`; },
    openControl: (lib, id) => { location.hash = `#/bench/${lib}/${id}`; },
  };

  await mount("jump", host.querySelector(".fr-jump-slot"), nav);

  // session drawer — mounted lazily on first open
  const sessionBtn = host.querySelector(".fr-session");
  let sessionApi = null;
  sessionBtn.addEventListener("click", async () => {
    if (!sessionApi) {
      sessionApi = await mount("session", host.querySelector(".fr-session-slot"), {
        toast,
        onClose: () => sessionBtn.classList.remove("on"),
      });
    }
    if (sessionApi.isOpen()) {
      sessionApi.close();
      sessionBtn.classList.remove("on");
    } else {
      sessionApi.open();
      sessionBtn.classList.add("on");
    }
    sessionBtn.setAttribute("aria-pressed", String(sessionApi.isOpen()));
  });

  crumb.shelf.addEventListener("click", () => { location.hash = "#/shelf"; });
  crumb.lib.addEventListener("click", () => {
    nav.openLib(crumb.lib.textContent);
  });

  function setCrumb(lib, ctlName) {
    crumb.sep1.hidden = crumb.lib.hidden = !lib;
    crumb.sep2.hidden = crumb.ctl.hidden = !ctlName;
    if (lib) crumb.lib.textContent = lib;
    if (ctlName) crumb.ctl.textContent = ctlName;
    crumb.shelf.classList.toggle("on", !lib);
    crumb.lib.classList.toggle("on", Boolean(lib) && !ctlName);
  }

  // ── routing ───────────────────────────────────────────────
  let shelfApi = null;
  // the currently-mounted flow/bench control, disposed on navigation (the 3D
  // flow editor holds a WebGL stage with window listeners + a render loop —
  // dropping its DOM isn't enough; it must be torn down).
  let stageApi = null;

  async function route() {
    if (stageApi) { stageApi.dispose?.(); stageApi = null; }
    viewctx.unregister("flow");   // re-registered below when a flow mounts
    const [, screen, lib, ctlId] = location.hash.split("/");

    if (location.hash.startsWith("#/player/")) {
      // #/player/<lib>/<ctl> — a scene facet running standalone: the
      // sceneplayer full-screen, chrome-free. Made for EMBEDDING — another
      // app iframes /dev/ at this route and drives live state via
      // postMessage {sceneSet: {field, value}} (the peer app's layout
      // loop). The IDE chrome stays out of the way.
      shelfApi = null;
      stage.replaceChildren();
      const slot = document.createElement("div");
      slot.style.height = "100%";
      stage.appendChild(slot);
      const ctlName = decodeURIComponent(location.hash.split("/")[3] ?? "");
      const api = await mount("sceneplayer", slot, {
        lib: decodeURIComponent(lib ?? ""), ctl: ctlName,
        caption: `${lib} ▸ ${ctlName}`,
        // state changes flow OUT to an embedding parent (the peer app's
        // headsup-open-on-focus case) — the inbound half is sceneSet below
        onState: (prefix, field, value) => {
          if (window.parent !== window) {
            window.parent.postMessage({ sceneState: { prefix, field, value } }, "*");
          }
        },
      });
      const onMsg = (e) => {
        const m = e.data && e.data.sceneSet;
        if (m && typeof m.field === "string") api.setState(m.field, m.value);
      };
      window.addEventListener("message", onMsg);
      stageApi = { dispose() { window.removeEventListener("message", onMsg); api.dispose(); } };
      setCrumb(decodeURIComponent(lib ?? ""), ctlName);
      return;
    }

    if (location.hash.startsWith("#/flow")) {
      // The 3D editor (floweditor3d) is the flow surface when WebGL is
      // available; the read-only 2D viewer (floweditor) is the no-WebGL
      // fallback.
      const flowControl = hasWebGL() ? "floweditor3d" : "floweditor";
      // #/flow/sample — the bundled specimen; #/flow/<lib>/<ctl>/<cmd> when
      // real flow commands exist (none in this store yet).
      shelfApi = null;
      stage.replaceChildren();
      const slot = document.createElement("div");
      slot.style.height = "100%";
      stage.appendChild(slot);
      if (lib === "sample") {
        // the specimen fixture shipped with the repo-era static bench; the
        // platform-served IDE has no copy — the caption below says so
        const fx = null;
        if (!fx) {
          setCrumb("flowlang", "sample (unavailable here)");
          slot.innerHTML = `<p style="font: 12px var(--mono, monospace);
            color: var(--text-dim, #888); padding: 2rem; max-width: 60ch;">
            The bundled specimen flow ships with the repo, not the installed
            bench — open a real flow command from a control's commands pane
            instead.</p>`;
          return;
        }
        setCrumb("flowlang", "sample ▸ a+b (crate test data)");
        stageApi = await mount(flowControl, slot, {
          title: { prefix: "flowlang ▸", name: "sample", suffix: "(crate test data)" },
          graph: fx.response.data,
          source: null, // the bundled specimen isn't a real command — read-only
          onBack: () => { location.hash = "#/shelf"; },
        });
      } else {
        // real flow command: cmd record -> flow body record -> .flow attachment
        const [, , , ctlIdF, cmdIdF] = location.hash.split("/");
        const cmdRec = await readRec(lib, cmdIdF);
        const bodyId = cmdRec instanceof Error ? null : cmdRec.flow;
        const bodyRec = bodyId ? await readRec(lib, bodyId) : null;
        const raw = bodyRec && !(bodyRec instanceof Error) ? bodyRec.flow : null;
        const ctlRecF = await readRec(lib, ctlIdF);
        const ctlName = ctlRecF instanceof Error ? "…" : ctlRecF.name;
        const cmdName = cmdRec instanceof Error ? "…" : cmdRec.name;
        setCrumb(lib, `${ctlName} ▸ ${cmdName}`);
        if (!raw) {
          toast.show("could not load this flow command's graph");
          location.hash = `#/bench/${lib}/${ctlIdF}`;
          return;
        }
        // view context: the flow body as loaded (in-flight 3D edits aren't
        // reflected until saved — the label says "as saved")
        const graphAsSaved = typeof raw === "string" ? raw : JSON.stringify(raw);
        viewctx.register("flow", () => ({
          label: `${ctlName} ▸ ${cmdName} flow body (as saved)`,
          fields: { lib, ctl: ctlName, cmdname: cmdName, flow: graphAsSaved },
        }));
        stageApi = await mount(flowControl, slot, {
          title: { prefix: `${lib} ▸ ${ctlName} ▸`, name: cmdName, suffix: "(flowlang)" },
          graph: typeof raw === "string" ? JSON.parse(raw) : raw,
          // names (not ids) — the flow-body pair resolves ctl/cmd by name,
          // like the rest of dev.code. floweditor3d enables editing once it
          // reads the body back.
          source: { lib, ctl: ctlName, cmd: cmdName },
          onBack: () => { location.hash = `#/bench/${lib}/${ctlIdF}`; },
        });
      }
    } else if (screen === "#bench" || location.hash.startsWith("#/bench")) {
      shelfApi = null;
      stage.replaceChildren();
      const slot = document.createElement("div");
      slot.style.height = "100%";
      stage.appendChild(slot);
      setCrumb(lib, "…");
      const wb = await mount("workbench", slot, { lib, ctlId, toast });
      stageApi = wb;
      setCrumb(lib, wb.name ?? "…");
    } else {
      if (!shelfApi) {
        stage.replaceChildren();
        const slot = document.createElement("div");
        slot.style.height = "100%";
        stage.appendChild(slot);
        shelfApi = await mount("shelf", slot, { ...nav, toast });
      }
      setCrumb(null, null);
      if (lib) {
        setCrumb(lib, null);
        await shelfApi.showFan?.(lib);
      }
    }
  }

  window.addEventListener("hashchange", route);

  // ── the identity chip (a readout — the platform serves this page) ──
  jsonP("../security/current_user", null).then((r2) => {
    if (r2.status === "ok" && r2.data) {
      connBtn.querySelector(".conn-text").textContent = r2.data.id;
      connBtn.classList.add("ok");
    }
  });

  // ── startup ───────────────────────────────────────────────
  if (!location.hash.startsWith("#/")) location.hash = "#/shelf";
  await route();

  return {};
}

  return init(ME, ME.DATA || {});
}).catch(function (e) {
  console.log("frame failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
