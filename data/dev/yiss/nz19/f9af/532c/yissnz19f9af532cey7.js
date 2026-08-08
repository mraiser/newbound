// frame — the persistent chrome: wordmark, two-level breadcrumb, jump slot,
// connection chip, and the hash router that mounts shelf/workbench into the
// stage. Routes: #/shelf · #/shelf/<lib> · #/bench/<lib>/<ctlId>

import { mountControl, ROOT, PLATFORM_LIB } from "../../assets/loader.js";
import { store } from "../../assets/store.js";
import { hasWebGL } from "../../assets/webgl.js";
import { chatctx } from "../../assets/chatctx.js";

export async function init(host) {
  const stage = host.querySelector(".fr-stage");
  const crumb = {
    shelf: host.querySelector(".seg-shelf"),
    sep1: host.querySelector(".sep"),
    lib: host.querySelector(".seg-lib"),
    sep2: host.querySelector(".sep2"),
    ctl: host.querySelector(".seg-ctl"),
  };
  const connBtn = host.querySelector(".fr-conn");
  const dialog = host.querySelector(".fr-connect");

  const toast = await mountControl("toast", host.querySelector(".fr-toast-slot"));

  const nav = {
    openLib: (lib) => { location.hash = `#/shelf/${lib}`; },
    openControl: (lib, id) => { location.hash = `#/bench/${lib}/${id}`; },
  };

  await mountControl("jump", host.querySelector(".fr-jump-slot"), nav);

  // session drawer — mounted lazily on first open
  const sessionBtn = host.querySelector(".fr-session");
  let sessionApi = null;
  sessionBtn.addEventListener("click", async () => {
    if (!sessionApi) {
      sessionApi = await mountControl("session", host.querySelector(".fr-session-slot"), {
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
    if (!store.connected()) return;
    if (stageApi) { stageApi.dispose?.(); stageApi = null; }
    chatctx.unregister("flow");   // re-registered below when a flow mounts
    const [, screen, lib, ctlId] = location.hash.split("/");

    if (location.hash.startsWith("#/player/")) {
      // #/player/<lib>/<ctl> — a scene facet running standalone (design
      // Part X): the sceneplayer full-screen, chrome-free. Made for
      // EMBEDDING — a non-bench app iframes the published bench at this
      // route instead of carrying its own boot shim, and drives live
      // state via postMessage {sceneSet: {field, value}} (the peer app's
      // layout loop). The bench UI stays out of the way.
      shelfApi = null;
      stage.replaceChildren();
      const slot = document.createElement("div");
      slot.style.height = "100%";
      stage.appendChild(slot);
      const ctlName = decodeURIComponent(location.hash.split("/")[3] ?? "");
      const api = await mountControl("sceneplayer", slot, {
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
      // The 3D editor (floweditor3d) is the flow surface in live/platform mode
      // when WebGL is available; the read-only 2D viewer (floweditor) is the
      // no-WebGL / mock-mode / quick-glance fallback (DESIGN: the 2D viewer
      // stays exactly there; flow3d-design: 3D replaces 2D *editing*). Keeping
      // mock on 2D keeps the fixture demo light (no 684KB THREE load) and the
      // existing mock regression untouched.
      const flowControl = (hasWebGL() && store.mode() !== "mock") ? "floweditor3d" : "floweditor";
      // #/flow/sample — the bundled specimen; #/flow/<lib>/<ctl>/<cmd> when
      // real flow commands exist (none in this store yet).
      shelfApi = null;
      stage.replaceChildren();
      const slot = document.createElement("div");
      slot.style.height = "100%";
      stage.appendChild(slot);
      if (lib === "sample") {
        // resolved against ROOT, not this module: in platform mode frame.js
        // is a blob module with no usable base URL. The specimen fixture is
        // repo-only (fixtures are neither code nor media, so the installer
        // doesn't ship it) — platform-served bench says so without probing.
        let fx = null;
        if (!PLATFORM_LIB) {
          try {
            const r = await fetch(
              new URL("harness/fixtures/flow_sample.json", ROOT),
              { cache: "no-cache" });
            if (r.ok) fx = await r.json();
          } catch { /* fall through to the caption */ }
        }
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
        stageApi = await mountControl(flowControl, slot, {
          title: { prefix: "flowlang ▸", name: "sample", suffix: "(crate test data)" },
          graph: fx.response.data,
          source: null, // the bundled specimen isn't a real command — read-only
          onBack: () => { location.hash = "#/shelf"; },
        });
      } else {
        // real flow command: cmd record -> flow body record -> .flow attachment
        const [, , , ctlIdF, cmdIdF] = location.hash.split("/");
        const cmdRec = await store.control(lib, cmdIdF);
        const bodyId = cmdRec instanceof Error ? null : cmdRec.flow;
        const bodyRec = bodyId ? await store.control(lib, bodyId) : null;
        const raw = bodyRec && !(bodyRec instanceof Error) ? bodyRec.flow : null;
        const ctlRecF = await store.control(lib, ctlIdF);
        const ctlName = ctlRecF instanceof Error ? "…" : ctlRecF.name;
        const cmdName = cmdRec instanceof Error ? "…" : cmdRec.name;
        setCrumb(lib, `${ctlName} ▸ ${cmdName}`);
        if (!raw) {
          toast.show("could not load this flow command's graph");
          location.hash = `#/bench/${lib}/${ctlIdF}`;
          return;
        }
        // chat context: the flow body as loaded (in-flight 3D edits aren't
        // reflected until saved — the label says "as saved")
        const graphForChat = typeof raw === "string" ? raw : JSON.stringify(raw);
        chatctx.register("flow", () => ({
          label: `${ctlName} ▸ ${cmdName} flow body (as saved)`,
          fields: { lib, ctl: ctlName, cmdname: cmdName, flow: graphForChat },
        }));
        stageApi = await mountControl(flowControl, slot, {
          title: { prefix: `${lib} ▸ ${ctlName} ▸`, name: cmdName, suffix: "(flowlang)" },
          graph: typeof raw === "string" ? JSON.parse(raw) : raw,
          // names (not ids) — the flow-body pair resolves ctl/cmd by name, like
          // every agent command. Editing engages when the connection is writable
          // and the flow-body API is present (floweditor3d checks).
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
      const wb = await mountControl("workbench", slot, { lib, ctlId, toast });
      stageApi = wb;
      setCrumb(lib, wb.name ?? "…");
    } else {
      if (!shelfApi) {
        stage.replaceChildren();
        const slot = document.createElement("div");
        slot.style.height = "100%";
        stage.appendChild(slot);
        shelfApi = await mountControl("shelf", slot, { ...nav, toast });
      }
      setCrumb(null, null);
      if (lib) {
        setCrumb(lib, null);
        await shelfApi.showFan?.(lib);
      }
    }
  }

  window.addEventListener("hashchange", route);

  // ── connection ────────────────────────────────────────────
  function setConnChip() {
    const mode = store.mode();
    const writableTag = store.writable() ? " · writable" : "";
    connBtn.classList.toggle("ok", store.connected());
    connBtn.querySelector(".conn-text").textContent = mode
      ? (mode === "mock" ? "mock" : `live${writableTag}`)
      : "not connected";
    if (mode === "live") {
      store.user().then((user) => {
        if (user) {
          connBtn.querySelector(".conn-text").textContent =
            `live · ${user.id}${writableTag}`;
        }
      });
    }
  }

  async function connect(cfg) {
    const result = await store.connect(cfg);
    if (result instanceof Error) return result;
    setConnChip();
    store.prefetchControls();
    if (!location.hash.startsWith("#/")) location.hash = "#/shelf";
    shelfApi = null;
    await route();
    toast.show(`connected — ${result.mode} · ${result.libCount} libraries`);
    return result;
  }

  // connect dialog wiring
  const modeBtns = [...dialog.querySelectorAll(".cn-mode")];
  const liveFields = dialog.querySelector(".cn-live");
  const urlInput = dialog.querySelector(".cn-url");
  const sidInput = dialog.querySelector(".cn-sid");
  const writableBtn = dialog.querySelector(".cn-writable");
  const warnEl = dialog.querySelector(".cn-warn");
  const errEl = dialog.querySelector(".cn-err");
  let pickedMode = "mock";
  let pickedWritable = false;

  function setWritable(on) {
    pickedWritable = on;
    writableBtn.classList.toggle("on", on);
    writableBtn.setAttribute("aria-pressed", String(on));
    writableBtn.textContent = on
      ? "saves ON — disposable instance only"
      : "saves off — read-only connection";
    warnEl.hidden = !on;
  }
  writableBtn.addEventListener("click", () => setWritable(!pickedWritable));

  function pickMode(mode) {
    pickedMode = mode;
    for (const btn of modeBtns) {
      btn.classList.toggle("on", btn.dataset.mode === mode);
    }
    liveFields.hidden = mode !== "live";
  }
  for (const btn of modeBtns) {
    btn.addEventListener("click", () => pickMode(btn.dataset.mode));
  }

  connBtn.addEventListener("click", () => {
    const saved = store.savedConfig();
    pickMode(saved?.mode ?? "mock");
    setWritable(Boolean(saved?.writable));
    urlInput.value = saved?.baseUrl ?? "http://localhost:33181";
    sidInput.value = saved?.sessionid ?? "";
    errEl.hidden = true;
    dialog.showModal();
  });

  dialog.querySelector(".cn-go").addEventListener("click", async () => {
    const cfg = pickedMode === "mock"
      ? { mode: "mock" }
      : { mode: "live", baseUrl: urlInput.value.trim(),
          sessionid: sidInput.value.trim(), writable: pickedWritable };
    const result = await connect(cfg);
    if (result instanceof Error) {
      errEl.hidden = false;
      errEl.textContent = result.message;
    } else {
      dialog.close();
    }
  });

  // ── startup ───────────────────────────────────────────────
  if (store.connected()) {
    // platform boot: the loader already connected same-origin to read the
    // frame's own facets — reuse that connection.
    setConnChip();
    store.prefetchControls();
    if (!location.hash.startsWith("#/")) location.hash = "#/shelf";
    await route();
  } else {
    // static boot: saved config, else mock
    const initial = await connect(store.savedConfig() ?? { mode: "mock" });
    if (initial instanceof Error) {
      toast.show(`connect failed (${initial.message}) — falling back to mock`);
      await connect({ mode: "mock" });
    }
  }

  return {};
}
