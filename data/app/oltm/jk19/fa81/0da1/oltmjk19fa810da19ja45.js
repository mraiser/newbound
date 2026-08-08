// sceneplayer — a scene facet running standalone (scene-facet-design Part X,
// SC-Q5's first half): the runtime + stage in affordant mode, no editor
// chrome. Props: {lib, ctl} to load a control's scene facet through the
// store, or {doc} (a raw facet object) to run one directly — embedders like
// the peer thread hold their own doc and drive state via the returned api.
//
// api: { setState(field, value), stateOf(), runtime, dispose }.

import { mountScene } from "../../vendor/nb_three/scenestage.js";
import { store } from "../../assets/store.js";
import { parse as parseScene } from "../../assets/scenedoc.js";
import { createRuntime } from "../../assets/scenerun.js";
import { hasWebGL } from "../../assets/webgl.js";

const dark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

async function loadSceneDoc(lib, ctl) {
  if (await store.sceneApi()) {
    const r = await store.readControlScene(lib, ctl);
    if (r.status === "ok" && r.exists) return parseScene(r.scene);
    if (r.status === "ok") return null;
  }
  const controls = await store.controls(lib);
  if (controls instanceof Error) return null;
  const entry = controls.find((c) => c.name === ctl);
  if (!entry) return null;
  const rec = await store.control(lib, entry.id);
  if (rec instanceof Error || rec.scene === undefined) return null;
  return parseScene(rec.scene);
}

export async function init(host, { lib, ctl, doc: rawDoc, caption, onState }) {
  const canvasEl = host.querySelector(".sp-canvas");
  const footEl = host.querySelector(".sp-foot");
  const capEl = host.querySelector(".sp-cap");
  const diagEl = host.querySelector(".sp-diag");

  if (!hasWebGL()) {
    canvasEl.innerHTML = `<p style="padding:14px" class="sp-cap">no WebGL here — this scene cannot render</p>`;
    return { dispose() {}, setState() {}, stateOf: () => ({}) };
  }

  const doc = rawDoc !== undefined
    ? parseScene(rawDoc)
    : await loadSceneDoc(lib, ctl);
  if (!doc) {
    canvasEl.innerHTML = "";
    footEl.hidden = false;
    capEl.textContent = `${lib} ▸ ${ctl} has no scene facet`;
    return { dispose() {}, setState() {}, stateOf: () => ({}) };
  }

  if (caption) { footEl.hidden = false; capEl.textContent = caption; }

  let diagCount = 0;
  const stage = mountScene(canvasEl, {
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

  const rt = createRuntime({
    doc,
    stage,
    theme: dark() ? "dark" : "light",
    reduced: reducedMotion(),
    loadDoc: loadSceneDoc,
    // the run ▸ posture (design §3.5): invoke only on a writable live connection
    invoke: store.writable() && store.mode() === "live"
      ? async (ilib, ictl, icmd, args) => {
          const r = await store.invokeCommand(ilib, ictl, icmd, args);
          if (r.status !== "ok") return new Error(r.msg || "invoke failed");
          return r.data ?? r.msg ?? r;
        }
      : undefined,
    onDiag: () => {
      diagCount++;
      footEl.hidden = false;
      diagEl.hidden = false;
      diagEl.textContent = `△ ${diagCount}`;
      diagEl.title = rt.diags.slice(-8).join("\n");
    },
    onState,
  });
  await rt.start();

  // outlive-proofing: the host may vanish without a dispose call
  const watchdog = setInterval(() => {
    if (!host.isConnected) dispose();
  }, 2000);

  function dispose() {
    clearInterval(watchdog);
    rt.dispose();
    stage.dispose();
  }

  return {
    setState: (field, value) => rt.setState(field, value),
    stateOf: () => rt.stateOf(),
    runtime: rt,
    dispose,
  };
}
