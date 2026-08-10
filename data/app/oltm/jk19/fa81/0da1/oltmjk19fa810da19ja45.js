// sceneplayer — a scene facet running standalone (scene-facet-design Part X,
// SC-Q5's first half): the runtime + stage in affordant mode, no editor
// chrome. DATA: {lib, ctl} to load a control's scene facet through the
// store, or {doc} (a raw facet object) to run one directly — embedders like
// the peer thread hold their own doc and drive state via the api. Optional
// {caption, onState}.
//
// api: { setState(field, value), stateOf(), runtime, dispose, waitReady(cb) }.
// Loading is async — setState/dispose queue behind it; waitReady(cb) fires
// once the runtime is up (or the scene turned out empty).

var me = this;
var ME = document.getElementById(me.UUID);

var dark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
var reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

var rt = null;
var stage = null;
var watchdog = null;

me.runtime = null;
me.setState = function (field, value) { readyP.then(function () { if (rt) rt.setState(field, value); }); };
me.stateOf = function () { return rt ? rt.stateOf() : {}; };
me.dispose = function () { readyP.then(disposeNow); };
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };

function disposeNow() {
  clearInterval(watchdog);
  if (rt) { rt.dispose(); rt = null; me.runtime = null; }
  if (stage) { stage.dispose(); stage = null; }
}

var readyP = new Promise(function (res2) { me.ready = res2; }).then(async () => {
  const canvasEl = ME.querySelector(".sp-canvas");
  const footEl = ME.querySelector(".sp-foot");
  const capEl = ME.querySelector(".sp-cap");
  const diagEl = ME.querySelector(".sp-diag");

  const { hasWebGL } = window.NB_WEBGL;
  const { parse: parseScene } = window.NB_SCENEDOC;
  const { createRuntime } = window.NB_SCENERUN;
  const jsonP = (c2, v2) => new Promise((res2) => json(c2, v2, res2));
  const invokeP = (l2, c2, m2, a2) => new Promise((res2) => invokeCommand(l2, c2, m2, a2, res2));
  const code = (m2, a2) => invokeP("dev", "code", m2, a2);
  const readRec = async (l2, id2) => {
    const r2 = await jsonP("../app/read", "lib=" + encodeURIComponent(l2) + "&id=" + encodeURIComponent(id2));
    return r2.status === "ok" ? r2.data : new Error(r2.msg || "read failed");
  };
  const controlsOf = async (l2) => {
    const d2 = await readRec(l2, "controls");
    return d2 instanceof Error ? d2 : (d2.list ?? []);
  };

  if (!hasWebGL()) {
    canvasEl.innerHTML = `<p style="padding:14px" class="sp-cap">no WebGL here — this scene cannot render</p>`;
    return;
  }

  async function loadSceneDoc(lib, ctl) {
    {
      const r = await code("read_control_scene", { lib, ctl });
      if (r.status === "ok" && r.exists) return parseScene(r.scene);
      if (r.status === "ok") return null;
    }
    const controls = await controlsOf(lib);
    if (controls instanceof Error) return null;
    const entry = controls.find((c) => c.name === ctl);
    if (!entry) return null;
    const rec = await readRec(lib, entry.id);
    if (rec instanceof Error || rec.scene === undefined) return null;
    return parseScene(rec.scene);
  }

  const doc = ME.DATA.doc !== undefined
    ? parseScene(ME.DATA.doc)
    : await loadSceneDoc(ME.DATA.lib, ME.DATA.ctl);
  if (!doc) {
    canvasEl.innerHTML = "";
    footEl.hidden = false;
    capEl.textContent = `${ME.DATA.lib} ▸ ${ME.DATA.ctl} has no scene facet`;
    return;
  }

  if (ME.DATA.caption) { footEl.hidden = false; capEl.textContent = ME.DATA.caption; }

  // the vendored stage, off its real asset URL — page-relative so a
  // tunneled mount (/peer/remote/UUID/local/…) resolves inside the tunnel
  const { mountScene } = await import("../app/asset/app/vendor/nb_three/scenestage.js");

  let diagCount = 0;
  stage = mountScene(canvasEl, {
    pickMode: "affordant",
    showSlots: false,
    onTap: (id) => rt.handleTap(id),
    onHover: (id) => {
      if (id !== hoverLast) {
        if (hoverLast) rt.handleHover(hoverLast, false);
        if (id) rt.handleHover(id, true);
        hoverLast = id;
      }
      canvasEl.style.cursor = id ? "pointer" : "";
    },
    onDrag: (evt) => rt.handleDrag(evt),
  });
  let hoverLast = null;

  rt = createRuntime({
    doc,
    stage,
    theme: dark() ? "dark" : "light",
    reduced: reducedMotion(),
    loadDoc: loadSceneDoc,
    invoke: async (ilib, ictl, icmd, args) => {
      const r = await invokeP(ilib, ictl, icmd, args);
      if (r.status !== "ok") return new Error(r.msg || "invoke failed");
      return r.data ?? r.msg ?? r;
    },
    onDiag: () => {
      diagCount++;
      footEl.hidden = false;
      diagEl.hidden = false;
      diagEl.textContent = `△ ${diagCount}`;
      diagEl.title = rt.diags.slice(-8).join("\n");
    },
    onState: ME.DATA.onState,
  });
  me.runtime = rt;
  await rt.start();

  // outlive-proofing: the host may vanish without a dispose call
  watchdog = setInterval(() => {
    if (!ME.isConnected) disposeNow();
  }, 2000);
}).catch((e) => {
  console.log("sceneplayer failed to start: " + (e && e.message ? e.message : e));
});
