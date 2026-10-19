// sceneeditor — the scene facet's pane in the workbench. Canvas
// (scenestage) + right rail (nodes/state/bind/wires/mounts), BUILD mode
// (gestures + forms mutate the doc through scenedoc's inverse-carrying
// mutations; composed undo) and PLAY mode (the control hosted live in a
// scenehost — the ONE scene runtime). Saves are whole-object writes
// through write_control_scene with the base hash.


var me = this;
var ME = document.getElementById(me.UUID);

var readyP = new Promise(function (res) { me.ready = res; }).then(async () => {
  const {
    parse: parseScene, KINDS, MATERIAL_KINDS, LIGHT_MODES,
    bindablePaths, MOUNT_BIND, NODE_EVENTS, STATE_TYPES,
  } = document.querySelector('[data-control="app:scenedoc"]').api;
  const { parse: parseExpr } = document.querySelector('[data-control="app:sceneexpr"]').api;
  const { TOKEN_NAMES } = document.querySelector('[data-control="app:scenetokens"]').api;
  const { project, envOf } = document.querySelector('[data-control="app:sceneproject"]').api;
  const { hasWebGL } = document.querySelector('[data-control="app:webgl"]').api;
  const viewctx = document.querySelector(".nb-viewctx").api;
  // the vendored stage off its real asset URL — page-relative for tunneling
  const { mountScene } = await import("../app/asset/app/vendor/nb_three/scenestage.js");
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
  const libsOf = async () => {
    const r2 = await jsonP("../app/libs", null);
    return r2.status === "ok" ? (r2.data ?? []) : new Error(r2.msg || "libs failed");
  };
  const readControlScene = (l2, c2) => code("read_control_scene", { lib: l2, ctl: c2 });
  const writeControlScene = (l2, c2, sc2, { base = "", label = "" } = {}) =>
    code("write_control_scene", { lib: l2, ctl: c2, scene: sc2, base, label, author: "" });

const dark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

async function init(host, { lib, name, record, toast, onSaved }) {
  const root = host.querySelector(".nb-sceneeditor");
  const canvasEl = root.querySelector(".se-canvas");
  const panelEl = root.querySelector(".se-panel");
  const capEl = root.querySelector(".se-cap");
  const modeBtn = root.querySelector(".se-mode");
  const addSel = root.querySelector(".se-add");
  const undoBtn = root.querySelector(".se-undo");
  const redoBtn = root.querySelector(".se-redo");
  const diagBtn = root.querySelector(".se-diagbtn");
  const saveBtn = root.querySelector(".se-save");
  const labelIn = root.querySelector(".se-label");
  const conflictEl = root.querySelector(".se-conflict");

  // ── behaviors: the control's OWN js facet is the behavior source ──────────
  // A control's OWN js facet is the behavior source — real JS with full access
  // to the control's functions and `me` (no cage). We boot the control in a
  // hidden div and read its LIVE api. The ONE behavior model is per-instance:
  // me.animate / me.render / me.click on the control — the control IS a 3D
  // object hosted by app:scenehost, and its scene facet is its SHAPE. We detect
  // those and PLAY hosts the control live in a scenehost (a preview instance).
  let controlApi = null;
  async function loadControlApi() {
    return new Promise((resolve) => {
      const host2 = document.createElement("div");
      host2.style.display = "none";
      root.appendChild(host2);
      try { installControl(host2, lib, name, (api) => resolve(api || null)); }
      catch (e) { resolve(null); }
    });
  }
  controlApi = await loadControlApi();
  const sceneBehaviors = (controlApi && controlApi.sceneBehaviors) || {};
  // a component control: declares per-instance behaviors on its own api
  const isComponent = !!(controlApi && (
    typeof controlApi.render === "function" ||
    typeof controlApi.animate === "function" ||
    typeof controlApi.click === "function"));

  if (!hasWebGL()) {
    canvasEl.innerHTML = `<p class="se-note" style="padding:14px">no WebGL here —
      the scene facet renders as raw JSON:</p><pre style="padding:0 14px;
      white-space:pre-wrap"></pre>`;
    canvasEl.querySelector("pre").textContent = JSON.stringify(record.scene ?? {}, null, 1);
    root.querySelector(".se-rail").hidden = true;
    return { dispose() {} };
  }

  // ── the doc + the save gate ───────────────────────────────────────────────
  // The editor always loads through dev.code.read_control_scene (the journaled
  // store read with a base hash); record.scene is only the fallback if that
  // call ever fails. sceneApi gates that preference.
  const sceneApi = true;
  const canSave = true;
  let hash = "";
  let doc, absent;

  async function loadDoc() {
    if (sceneApi) {
      const r = await readControlScene(lib, name);
      if (r.status === "ok") {
        absent = !r.exists;
        hash = r.hash || "";
        doc = parseScene(r.exists ? r.scene : {});
        return;
      }
    }
    absent = record.scene === undefined;
    doc = parseScene(record.scene ?? {});
  }
  await loadDoc();
  let baseline = JSON.stringify(doc.serialize());

  capEl.textContent = isComponent ? "component — shape + per-instance behaviors (play hosts it)" : "";
  if (isComponent) modeBtn.title = "host this component in a scenehost";
  saveBtn.hidden = labelIn.hidden = !canSave;

  // ── stage ─────────────────────────────────────────────────────────────────
  const undoStack = [], redoStack = [];
  let selected = null;
  let mode = "build";
  let dragCtx = null;
  let gone = false;

  const stage = mountScene(canvasEl, {
    pickMode: "all",
    showSlots: true,
    onTap: (id) => { if (mode === "play") return; select(id); },
    onHover: (id) => { canvasEl.style.cursor = id ? "pointer" : ""; },
    onDrag: (evt) => { if (mode === "play") return; buildDrag(evt); },
  });
  let hoverLast = null;

  // Build-mode drag: live stage deltas during the gesture, ONE movePos
  // mutation at the end (one undo step, one label). World deltas are applied
  // to the local pos — fine while ancestors are unrotated (DEVIATIONS notes
  // the general case).
  function buildDrag(evt) {
    const hit = doc.byId(evt.id);
    if (!hit) return;
    if (evt.type === "start") {
      dragCtx = { id: evt.id, from: {
        x: doc.read(evt.id, "pos.x"), y: doc.read(evt.id, "pos.y"), z: doc.read(evt.id, "pos.z") } };
    } else if (dragCtx && dragCtx.id === evt.id) {
      const snap = (v) => Math.round(v * 20) / 20; // 0.05 grid, the flow editor's idiom
      const to = { x: snap(dragCtx.from.x + evt.dx), y: snap(dragCtx.from.y + evt.dy), z: snap(dragCtx.from.z + evt.dz) };
      if (evt.type === "move") {
        for (const a of ["x", "y", "z"]) stage.applyDelta(evt.id, `pos.${a}`, to[a]);
      } else {
        const same = to.x === dragCtx.from.x && to.y === dragCtx.from.y && to.z === dragCtx.from.z;
        if (!same) mutate(doc.movePos(evt.id, to));
        else refresh();
        dragCtx = null;
      }
    }
  }

  // ── refresh + mutation plumbing ───────────────────────────────────────────
  function projectNow() {
    // build view: each-templates render as ghost gizmos (instantiation is a
    // runtime behavior — press play to see the collection live)
    stage.setScene(project(doc, { theme: dark() ? "dark" : "light", templates: "gizmo" }), envOf(doc));
    stage.emphasize(selected);
  }

  function diagChip() {
    const diags = doc.diagnostics();
    const errs = diags.filter((d) => d.severity === "error").length;
    const warns = diags.filter((d) => d.severity === "warn").length;
    diagBtn.classList.toggle("bad", errs > 0);
    diagBtn.classList.toggle("warn", !errs && warns > 0);
    diagBtn.textContent = errs ? `✗ ${errs}` : warns ? `△ ${warns}` : "✓";
    diagBtn.title = `${errs} errors, ${warns} warnings — click for the list`;
  }

  function dirty() { return JSON.stringify(doc.serialize()) !== baseline; }

  function refreshChrome() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
    if (canSave) saveBtn.disabled = !dirty();
    diagChip();
  }

  function refresh() {
    if (mode === "build") projectNow();
    renderPanel();
    refreshChrome();
  }

  function mutate(m) {
    if (!m || m.error) {
      if (toast && m) toast.show(m.error);
      return false;
    }
    undoStack.push(m);
    redoStack.length = 0;
    refresh();
    return true;
  }

  function undo() {
    const m = undoStack.pop();
    if (!m) return;
    m.undo();
    redoStack.push(m);
    if (selected && !doc.byId(selected)) selected = null;
    refresh();
  }
  function redo() {
    const m = redoStack.pop();
    if (!m) return;
    m.redo();
    refresh();
  }

  function select(id) {
    selected = id;
    stage.emphasize(id);
    if (id && !["nodes", "mounts"].includes(activeTab)) setTab("nodes");
    else renderPanel();
  }

  // ── play mode ─────────────────────────────────────────────────────────────
  let compHost = null;   // the scenehost, in component preview
  let compOverlay = null;
  async function enterPlay() {
    mode = "play";
    modeBtn.textContent = "◂ build";
    modeBtn.classList.add("playing");
    addSel.disabled = true;
    stage.setPickMode("affordant");
    stage.setShowSlots(false);
    stage.emphasize(null);

    // PLAY hosts the control live in a scenehost — the ONE scene runtime. The
    // edited control IS the 3D object: its scene facet is its shape, its js
    // per-instance me.animate/render/click run there. (A control with no own-js
    // behaviors still shows its shape.) Overlay on top of the paused build
    // canvas — don't destroy it.
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute;inset:0;z-index:2;background:var(--panel,#1f242a)";
    canvasEl.style.position = canvasEl.style.position || "relative";
    canvasEl.appendChild(overlay);
    compOverlay = overlay;
    installControl(overlay, "app", "scenehost", async function (host3) {
      compHost = host3;
      host3.waitReady(async () => {
        host3.hostData = host3.hostData || {};
        // a few instances so sibling forces / per-instance behavior is visible
        const seeds = (record.data && Array.isArray(record.data.instances))
          ? record.data.instances : [{ id: "a" }, { id: "b" }, { id: "c" }];
        for (const s of seeds) await host3.addControl(lib, name, s);
        host3.frameAll();
      });
    }, { env: (doc && doc.env) || {} });
    renderPanel();
  }
  const playDiags = [];

  function exitPlay() {
    mode = "build";
    modeBtn.textContent = "play ▸";
    modeBtn.classList.remove("playing");
    addSel.disabled = false;
    if (compHost) {
      try { if (compHost.dispose) compHost.dispose(); } catch (e) {}
      compHost = null;
    }
    if (compOverlay) { compOverlay.remove(); compOverlay = null; }
    playDiags.length = 0;
    stage.setPickMode("all");
    stage.setShowSlots(true);
    refresh();
  }

  modeBtn.addEventListener("click", () => (mode === "build" ? enterPlay() : exitPlay()));

  // ── saving ────────────────────────────────────────────────────────────────
  function composedLabel() {
    if (labelIn.value.trim()) return labelIn.value.trim();
    const labels = [];
    for (const m of undoStack) if (m.label && !labels.includes(m.label)) labels.push(m.label);
    return labels.slice(-4).join(" · ") || "scene edit";
  }

  async function save(overwrite = false) {
    if (!canSave || !dirty()) return;
    const r = await writeControlScene(lib, name, doc.serialize(), {
      base: overwrite ? "" : hash, label: composedLabel(),
    });
    if (r.status === "ok") {
      hash = r.hash || "";
      baseline = JSON.stringify(doc.serialize());
      absent = false;
      conflictEl.hidden = true;
      labelIn.value = "";
      if (toast) toast.show(r.created ? "scene facet created" : "scene saved");
      if (onSaved) onSaved(doc.serialize());
      refreshChrome();
    } else if (r.msg === "stale_base") {
      conflictEl.hidden = false;
    } else if (toast) {
      toast.show(`save failed: ${r.msg || "unknown error"}`);
    }
  }
  saveBtn.addEventListener("click", () => save());
  conflictEl.querySelector(".se-mine").addEventListener("click", () => { conflictEl.hidden = true; save(true); });
  conflictEl.querySelector(".se-theirs").addEventListener("click", async () => {
    conflictEl.hidden = true;
    await loadDoc();
    baseline = JSON.stringify(doc.serialize());
    undoStack.length = redoStack.length = 0;
    selected = null;
    if (mode === "play") exitPlay(); else refresh();
    if (toast) toast.show("loaded their version — your edits were discarded");
  });

  // ── the palette ───────────────────────────────────────────────────────────
  for (const kind of Object.keys(KINDS)) {
    const o = document.createElement("option");
    o.value = kind;
    o.textContent = `+ ${kind}`;
    addSel.appendChild(o);
  }
  addSel.addEventListener("change", () => {
    const kind = addSel.value;
    addSel.value = "";
    if (!kind) return;
    const raw = { id: doc.newId(kind), kind, pos: { x: 0, y: 0.5, z: 0 } };
    const sel = selected && doc.byId(selected);
    if (sel && sel.type === "node") raw.parent = selected;
    if (MATERIAL_KINDS.has(kind)) raw.material = { token: "surface" };
    if (kind === "text") raw.text = "text";
    const m = doc.addNode(raw);
    if (mutate(m)) select(raw.id);
  });

  // ── the rail ──────────────────────────────────────────────────────────────
  let activeTab = "nodes";
  const tabs = root.querySelectorAll(".se-tabs button");
  for (const b of tabs) b.addEventListener("click", () => setTab(b.dataset.tab));
  function setTab(tab) {
    activeTab = tab;
    for (const b of tabs) b.classList.toggle("on", b.dataset.tab === tab);
    renderPanel();
  }
  diagBtn.addEventListener("click", () => setTab("diag"));

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const numIn = (value, onSet, opts = {}) => {
    const i = el("input", "num");
    i.type = "number";
    i.step = opts.step ?? "0.1";
    i.value = String(value);
    if (opts.disabled) { i.disabled = true; i.title = opts.disabled; }
    i.addEventListener("change", () => {
      if (!i.isConnected) return; // a re-render detached it; blur still fires
      const v = Number(i.value);
      if (isFinite(v)) onSet(v);
    });
    return i;
  };

  // Re-entrancy guard: a mutation's re-render can detach a focused input,
  // whose native blur/change fires ANOTHER mutation mid-replaceChildren.
  let rendering = false, renderQueued = false;
  function renderPanel() {
    if (rendering) { renderQueued = true; return; }
    rendering = true;
    try {
      panelEl.replaceChildren();
      if (activeTab === "nodes") renderNodes();
      else if (activeTab === "state") renderState();
      else if (activeTab === "bind") renderBind();
      else if (activeTab === "wires") renderWires();
      else if (activeTab === "mounts") renderMounts();
      else if (activeTab === "behaviors") renderBehaviors();
      else if (activeTab === "diag") renderDiag();
    } finally {
      rendering = false;
      if (renderQueued) { renderQueued = false; queueMicrotask(renderPanel); }
    }
  }

  function renderDiag() {
    panelEl.appendChild(el("h4", null, "diagnostics"));
    const list = el("ul", "se-diag-list");
    const diags = doc.diagnostics();
    if (!diags.length && !playDiags.length) panelEl.appendChild(el("p", "se-note", "clean — no diagnostics"));
    for (const d of diags) list.appendChild(el("li", d.severity, `${d.code} ${d.path}: ${d.message}`));
    for (const m of playDiags) list.appendChild(el("li", "warn", `runtime: ${m}`));
    panelEl.appendChild(list);
  }

  // nodes: env strip + tree + inspector
  function renderNodes() {
    if (absent && !dirty()) {
      panelEl.appendChild(el("p", "se-note", canSave
        ? "no scene facet yet — add nodes and save to create it"
        : "no scene facet on this control"));
    }
    // env
    const env = envOf(doc);
    const envRow = el("div", "se-form");
    const lightsSel = el("select");
    for (const v of ["default", "none"]) {
      const o = el("option", null, `lights: ${v}`);
      o.value = v;
      lightsSel.appendChild(o);
    }
    lightsSel.value = env.lights;
    lightsSel.addEventListener("change", () => mutate(doc.setEnv("lights", lightsSel.value === "default" ? null : "none")));
    const gridLbl = el("label");
    const gridCb = el("input");
    gridCb.type = "checkbox";
    gridCb.checked = env.grid;
    gridCb.addEventListener("change", () => mutate(doc.setEnv("grid", gridCb.checked ? null : false)));
    gridLbl.append(gridCb, " grid");
    envRow.append(lightsSel, gridLbl);
    panelEl.appendChild(envRow);

    // tree
    panelEl.appendChild(el("h4", null, "scene tree"));
    const renderEntryRow = (entry, type, depth) => {
      const row = el("div", "se-row" + (selected === entry.id ? " sel" : ""));
      row.style.paddingLeft = `${4 + depth * 12}px`;
      const label = el("span", "grow", entry.id ?? "(no id)");
      row.appendChild(label);
      const kind = type === "mount" ? `⊕ ${entry.lib}.${entry.ctl}` : entry.kind;
      row.appendChild(el("span", "se-kind",
        entry.each !== undefined ? `${kind} ×each(${entry.each})` : kind));
      row.addEventListener("click", () => select(entry.id));
      panelEl.appendChild(row);
    };
    const walk = (parentId, depth) => {
      const { nodes, mounts } = doc.childrenOf(parentId);
      for (const n of nodes) { renderEntryRow(n, "node", depth); walk(n.id, depth + 1); }
      for (const m of mounts) renderEntryRow(m, "mount", depth);
    };
    walk(null, 0);
    if (!doc.nodes().length && !doc.mounts().length) {
      panelEl.appendChild(el("p", "se-note", "empty scene — use “+ node…” to start"));
    }

    // inspector — handlers close over the RENDER-TIME selection (a stale
    // blur-change after switching rows must never write onto the new row)
    const sel = selected;
    const hit = sel && doc.byId(sel);
    if (!hit) return;
    panelEl.appendChild(el("h4", null, hit.type === "mount" ? "mount" : `${hit.entry.kind} node`));
    const bound = doc.boundTargets();
    const boundTitle = (path) => bound.has(`${sel}.${path}`) ? "bound to an expression — edit it in the bind tab" : null;

    // id (rename)
    const idForm = el("div", "se-form");
    const idIn = el("input");
    idIn.value = sel;
    idIn.addEventListener("change", () => {
      if (!idIn.isConnected || idIn.value === sel) return;
      const m = doc.renameId(sel, idIn.value);
      if (m.error) { idIn.value = sel; if (toast) toast.show(m.error); return; }
      undoStack.push(m); redoStack.length = 0;
      selected = idIn.value;
      refresh();
    });
    idForm.append(el("span", "se-note", "id"), idIn);
    panelEl.appendChild(idForm);

    // transforms
    const grid = el("div", "se-grid3");
    for (const t of ["pos", "rot", "scale"]) {
      grid.appendChild(el("span", "se-note", t));
      for (const a of ["x", "y", "z"]) {
        const path = `${t}.${a}`;
        grid.appendChild(numIn(doc.read(sel, path), (v) => mutate(doc.setProp(sel, path, v)),
          { disabled: boundTitle(path) }));
      }
    }
    panelEl.appendChild(grid);

    if (hit.type === "node") {
      const kind = hit.entry.kind;
      // kind params
      const params = Object.keys(KINDS[kind].params);
      if (params.length) {
        const pf = el("div", "se-form");
        for (const p of params) {
          pf.appendChild(el("span", "se-note", p));
          const cur = doc.read(sel, p);
          if (typeof KINDS[kind].params[p] === "string") {
            const i = el("input");
            i.value = String(cur);
            const b = boundTitle(p);
            if (b) { i.disabled = true; i.title = b; }
            i.addEventListener("change", () => { if (i.isConnected) mutate(doc.setProp(sel, p, i.value)); });
            pf.appendChild(i);
          } else {
            pf.appendChild(numIn(cur, (v) => mutate(doc.setProp(sel, p, v)), { disabled: boundTitle(p) }));
          }
        }
        panelEl.appendChild(pf);
      }
      // material
      if (MATERIAL_KINDS.has(kind)) {
        const mf = el("div", "se-form");
        mf.appendChild(el("span", "se-note", "material"));
        const tokSel = el("select");
        for (const t of TOKEN_NAMES) { const o = el("option", null, t); o.value = t; tokSel.appendChild(o); }
        tokSel.value = doc.read(sel, "material.token");
        const bt = boundTitle("material.token");
        if (bt) { tokSel.disabled = true; tokSel.title = bt; }
        tokSel.addEventListener("change", () => mutate(doc.setProp(sel, "material.token", tokSel.value)));
        mf.append(tokSel);
        mf.append(el("span", "se-note", "opacity"),
          numIn(doc.read(sel, "material.opacity"), (v) => mutate(doc.setProp(sel, "material.opacity", v)),
            { disabled: boundTitle("material.opacity") }));
        panelEl.appendChild(mf);
      }
      if (kind === "link") {
        const lkf = el("div", "se-form");
        for (const end of ["from", "to"]) {
          lkf.appendChild(el("span", "se-note", end));
          const i = el("input");
          i.value = String(hit.entry[end] ?? "");
          i.placeholder = "entry id";
          const b = boundTitle(end);
          if (b) { i.disabled = true; i.title = b; }
          i.addEventListener("change", () => { if (i.isConnected) mutate(doc.setProp(sel, end, i.value)); });
          lkf.appendChild(i);
        }
        panelEl.appendChild(lkf);
      }
      if (kind === "light") {
        const lf = el("div", "se-form");
        const modeSel = el("select");
        for (const m of LIGHT_MODES) { const o = el("option", null, m); o.value = m; modeSel.appendChild(o); }
        modeSel.value = doc.read(sel, "mode");
        modeSel.addEventListener("change", () => mutate(doc.setProp(sel, "mode", modeSel.value)));
        lf.append(el("span", "se-note", "mode"), modeSel,
          el("span", "se-note", "intensity"),
          numIn(doc.read(sel, "intensity"), (v) => mutate(doc.setProp(sel, "intensity", v)),
            { disabled: boundTitle("intensity") }));
        panelEl.appendChild(lf);
      }
      // affordances
      const af = el("div", "se-form");
      af.appendChild(el("span", "se-note", "affords"));
      for (const key of ["tap", "hover"]) {
        const lbl = el("label");
        const cb = el("input");
        cb.type = "checkbox";
        cb.checked = Boolean(hit.entry.affordances?.[key]);
        cb.addEventListener("change", () => mutate(doc.setAffordance(sel, key, cb.checked ? true : null)));
        lbl.append(cb, ` ${key}`);
        af.appendChild(lbl);
      }
      const dragSel = el("select");
      for (const v of ["no drag", "xz", "xy", "yz"]) { const o = el("option", null, v === "no drag" ? v : `drag ${v}`); o.value = v; dragSel.appendChild(o); }
      dragSel.value = hit.entry.affordances?.drag?.plane ?? "no drag";
      dragSel.addEventListener("change", () =>
        mutate(doc.setAffordance(sel, "drag", dragSel.value === "no drag" ? null : { plane: dragSel.value })));
      af.appendChild(dragSel);
      panelEl.appendChild(af);
      // behavior — the impl (in this control's js facet) whose event/render
      // methods fire for this node
      const bf = el("div", "se-form");
      bf.appendChild(el("span", "se-note", "behavior"));
      const bIn = el("input");
      bIn.placeholder = "impl name (js facet)";
      bIn.value = hit.entry.behavior ?? "";
      bIn.setAttribute("list", "se-impls-" + me.UUID);
      bIn.addEventListener("change", () => mutate(doc.setNodeBehavior(sel, bIn.value.trim() || null)));
      const bList = el("datalist");
      bList.id = "se-impls-" + me.UUID;
      for (const nm of Object.keys(sceneBehaviors || {})) { const o = el("option"); o.value = nm; bList.appendChild(o); }
      bf.append(bIn, bList);
      if (bIn.value.trim() && !Object.keys(sceneBehaviors || {}).includes(bIn.value.trim())) {
        bf.appendChild(el("span", "se-note", "✗ no impl")).style.color = "var(--danger, #c15a5a)";
      }
      panelEl.appendChild(bf);
      // parent
      const paf = el("div", "se-form");
      paf.appendChild(el("span", "se-note", "parent"));
      const pSel = el("select");
      const rootOpt = el("option", null, "(root)");
      rootOpt.value = "";
      pSel.appendChild(rootOpt);
      for (const n of doc.nodes()) if (n.id !== sel) { const o = el("option", null, n.id); o.value = n.id; pSel.appendChild(o); }
      pSel.value = hit.entry.parent ?? "";
      pSel.addEventListener("change", () => mutate(doc.setParent(sel, pSel.value || null)));
      paf.appendChild(pSel);
      panelEl.appendChild(paf);
    } else {
      // mount fields
      const mf = el("div", "se-form");
      mf.append(el("span", "se-note", `${hit.entry.lib}.${hit.entry.ctl}`));
      const atSel = el("select");
      const rootOpt = el("option", null, "at (root)");
      rootOpt.value = "";
      atSel.appendChild(rootOpt);
      for (const n of doc.nodes()) { const o = el("option", null, `at ${n.id}`); o.value = n.id; atSel.appendChild(o); }
      atSel.value = hit.entry.at ?? "";
      atSel.addEventListener("change", () => mutate(doc.setMountField(sel, "at", atSel.value || null)));
      mf.appendChild(atSel);
      panelEl.appendChild(mf);
      // overrides
      panelEl.appendChild(el("h4", null, "state overrides (props-down)"));
      const st = hit.entry.state && typeof hit.entry.state === "object" ? hit.entry.state : {};
      for (const [field, expr] of Object.entries(st)) {
        const row = el("div", "se-row");
        row.appendChild(el("span", "se-note", field));
        const ei = el("input", "grow se-expr");
        ei.value = expr;
        ei.addEventListener("change", () => { if (ei.isConnected) mutate(doc.setMountOverride(sel, field, ei.value)); });
        const x = el("button", null, "×");
        x.addEventListener("click", () => mutate(doc.setMountOverride(sel, field, null)));
        row.append(ei, x);
        panelEl.appendChild(row);
      }
      const of = el("div", "se-form");
      const fIn = el("input");
      fIn.placeholder = "child field";
      const eIn = el("input");
      eIn.placeholder = "expr over MY state";
      const add = el("button", null, "set");
      add.addEventListener("click", () => {
        if (fIn.value && eIn.value) mutate(doc.setMountOverride(sel, fIn.value, eIn.value));
      });
      of.append(fIn, eIn, add);
      panelEl.appendChild(of);
    }

    // delete
    const refs = doc.referencesTo(sel);
    const del = el("button", null, refs.length ? `delete (blocked: ${refs.length} refs)` : "delete");
    del.disabled = refs.length > 0;
    del.title = refs.length ? refs.join(", ") : "remove from the scene";
    del.addEventListener("click", () => {
      const m = hit.type === "mount" ? doc.removeMount(sel) : doc.removeNode(sel);
      if (mutate(m)) { if (selected === sel) selected = null; refresh(); }
    });
    const df = el("div", "se-form");
    df.appendChild(del);
    panelEl.appendChild(df);
  }

  function renderState() {
    panelEl.appendChild(el("h4", null, mode === "play" ? "state (live)" : "state (defaults)"));
    const live = mode === "play" && compHost ? compHost.state : null;
    for (const f of doc.stateFields()) {
      const row = el("div", "se-row");
      row.appendChild(el("span", "grow", f.name));
      row.appendChild(el("span", "se-kind", f.type));
      if (live) {
        const vi = el("input", "num se-live");
        vi.value = typeof live[f.name] === "object" ? JSON.stringify(live[f.name]) : String(live[f.name]);
        vi.addEventListener("change", () => {
          let v = vi.value;
          if (f.type === "number") v = Number(v);
          else if (f.type === "boolean") v = v === "true";
          else if (f.type === "json") { try { v = JSON.parse(vi.value); } catch { return; } }
          rt.setState(f.name, v);
        });
        row.appendChild(vi);
      } else {
        const di = el("input", "num");
        di.value = typeof f.value === "object" ? JSON.stringify(f.value) : String(f.value);
        di.addEventListener("change", () => {
          let v = di.value;
          if (f.type === "number") { v = Number(v); if (!isFinite(v)) return; }
          else if (f.type === "boolean") v = di.value === "true";
          else if (f.type === "json") { try { v = JSON.parse(di.value); } catch { return; } }
          mutate(doc.setStateDefault(f.name, v));
        });
        const x = el("button", null, "×");
        x.title = "remove this field";
        x.addEventListener("click", () => mutate(doc.removeState(f.name)));
        row.append(di, x);
      }
      panelEl.appendChild(row);
    }
    if (mode !== "play") {
      const form = el("div", "se-form");
      const nIn = el("input");
      nIn.placeholder = "name";
      const tSel = el("select");
      for (const t of STATE_TYPES) { const o = el("option", null, t); o.value = t; tSel.appendChild(o); }
      const vIn = el("input");
      vIn.placeholder = "default";
      const add = el("button", null, "+ field");
      add.addEventListener("click", () => {
        let v = vIn.value;
        if (tSel.value === "number") { v = Number(v || 0); if (!isFinite(v)) v = 0; }
        else if (tSel.value === "boolean") v = vIn.value === "true";
        else if (tSel.value === "json") { try { v = JSON.parse(vIn.value || "null"); } catch { v = null; } }
        if (mutate(doc.addState({ name: nIn.value, type: tSel.value, value: v }))) { nIn.value = vIn.value = ""; }
      });
      form.append(nIn, tSel, vIn, add);
      panelEl.appendChild(form);
    } else {
      panelEl.appendChild(el("p", "se-note", "edit values to poke the running scene — wires and bindings react"));
    }
  }

  function renderBind() {
    panelEl.appendChild(el("h4", null, "bindings — state → properties"));
    doc.bindings().forEach((b) => {
      const row = el("div", "se-row");
      row.appendChild(el("span", "se-note", b.target));
      const ei = el("input", "grow se-expr");
      ei.value = b.expr;
      ei.addEventListener("change", () => {
        const p = parseExpr(ei.value);
        ei.classList.toggle("bad", !p.ok);
        if (p.ok) mutate(doc.setBinding(b.target, ei.value, b.ease));
      });
      const x = el("button", null, "×");
      x.addEventListener("click", () => mutate(doc.removeBinding(b.target)));
      row.append(ei, x);
      panelEl.appendChild(row);
      if (b.ease) panelEl.appendChild(el("p", "se-note", `  ease ${b.ease.ms}ms ${b.ease.curve || "linear"}`));
    });
    // add form
    const form = el("div", "se-form");
    const entrySel = el("select");
    // each-templates take per-instance `props`, not bindings (SD-5)
    for (const n of doc.nodes()) if (n.each === undefined) { const o = el("option", null, n.id); o.value = `n:${n.id}`; entrySel.appendChild(o); }
    for (const m of doc.mounts()) if (m.each === undefined) { const o = el("option", null, m.id); o.value = `m:${m.id}`; entrySel.appendChild(o); }
    const pathSel = el("select");
    const fillPaths = () => {
      pathSel.replaceChildren();
      const v = entrySel.value;
      if (!v) return;
      const [t, id] = [v[0], v.slice(2)];
      const hit = doc.byId(id);
      const paths = t === "m" ? MOUNT_BIND : hit ? bindablePaths(hit.entry.kind) : [];
      for (const p of paths) { const o = el("option", null, p); o.value = p; pathSel.appendChild(o); }
    };
    fillPaths();
    entrySel.addEventListener("change", fillPaths);
    const exprIn = el("input", "se-expr");
    exprIn.placeholder = "expression — state, t, PI, sin(), clamp()…";
    exprIn.style.width = "150px";
    const easeIn = el("input", "num");
    easeIn.placeholder = "ease ms";
    const add = el("button", null, "bind");
    add.addEventListener("click", () => {
      const v = entrySel.value;
      if (!v || !exprIn.value) return;
      const id = v.slice(2);
      const ease = Number(easeIn.value) > 0 ? { ms: Number(easeIn.value), curve: "ease" } : undefined;
      if (mutate(doc.setBinding(`${id}.${pathSel.value}`, exprIn.value, ease))) { exprIn.value = easeIn.value = ""; }
    });
    form.append(entrySel, pathSel, exprIn, easeIn, add);
    panelEl.appendChild(form);
    if (!doc.nodes().length && !doc.mounts().length) form.hidden = true;
  }

  function actionSummary(a) {
    if (!a || typeof a !== "object") return "?";
    if (a.set) return `set ${a.set} = ${a.to}`;
    if (a.invoke) return `invoke ${a.invoke}`;
    if (a.emit) return `emit ${a.emit}`;
    return "?";
  }

  function renderWires() {
    panelEl.appendChild(el("h4", null, "wires — events → actions"));
    doc.wires().forEach((w, i) => {
      const row = el("div", "se-row");
      row.appendChild(el("span", "grow", `${w.on} → ${(Array.isArray(w.do) ? w.do : []).map(actionSummary).join("; ")}`));
      const x = el("button", null, "×");
      x.addEventListener("click", () => mutate(doc.removeWire(i)));
      row.appendChild(x);
      panelEl.appendChild(row);
    });
    // add form — one action per wire here (the doc supports action lists;
    // authoring those is a JSON edit for now — DEVIATIONS)
    const form = el("div", "se-form");
    const onSel = el("select");
    for (const n of doc.nodes()) for (const ev of NODE_EVENTS) {
      const o = el("option", null, `${n.id}.${ev}`);
      o.value = `${n.id}.${ev}`;
      onSel.appendChild(o);
    }
    for (const m of doc.mounts()) {
      const o = el("option", null, `${m.id}.<emit>`);
      o.value = `${m.id}.`;
      onSel.appendChild(o);
    }
    const kindSel = el("select");
    for (const k of ["set", "emit", "invoke"]) { const o = el("option", null, k); o.value = k; kindSel.appendChild(o); }
    const aIn = el("input");
    aIn.placeholder = "state field / emit name / lib.ctl.cmd";
    const toIn = el("input", "se-expr");
    toIn.placeholder = "to-expression (for set)";
    toIn.style.width = "130px";
    const add = el("button", null, "wire");
    add.addEventListener("click", () => {
      let on = onSel.value;
      if (on.endsWith(".")) {
        const emitName = prompt("child emit name:");
        if (!emitName) return;
        on += emitName;
      }
      let action;
      if (kindSel.value === "set") action = { set: aIn.value, to: toIn.value || "0" };
      else if (kindSel.value === "emit") action = { emit: aIn.value };
      else action = { invoke: aIn.value, args: {} };
      if (mutate(doc.addWire({ on, do: [action] }))) { aIn.value = toIn.value = ""; }
    });
    form.append(onSel, kindSel, aIn, toIn, add);
    panelEl.appendChild(form);
    panelEl.appendChild(el("p", "se-note",
      "events need the matching affordance on the node (tap/drag/hover — see the node inspector)"));
  }

  function renderBehaviors() {
    const impls = Object.keys(sceneBehaviors || {});
    const hasImpl = (ref) => {
      if (typeof ref !== "string") return false;
      const dot = ref.indexOf(".");
      return impls.includes(dot < 0 ? ref : ref.slice(0, dot));
    };
    const refRow = (label, ref, onClear) => {
      const row = el("div", "se-row");
      const ok = hasImpl(ref);
      row.appendChild(el("span", "grow", `${label} → ${ref}`));
      const tag = el("span", "se-note", ok ? "✓" : "✗ no impl");
      if (!ok) tag.style.color = "var(--danger, #c15a5a)";
      row.appendChild(tag);
      if (onClear) {
        const x = el("button", null, "×");
        x.addEventListener("click", onClear);
        row.appendChild(x);
      }
      return row;
    };

    panelEl.appendChild(el("h4", null, "behaviors — js on this control"));

    // ── component dialect: per-instance methods on the control's own api ────
    if (isComponent) {
      const methods = ["animate", "render", "click", "drag"].filter((m) => controlApi && typeof controlApi[m] === "function");
      panelEl.appendChild(el("p", "se-note",
        `COMPONENT — this control IS a 3D object (hosted by app:scenehost). Its scene facet is its SHAPE; these per-instance methods run for every instance:`));
      const row = el("div", "se-row");
      row.appendChild(el("span", "grow", methods.length ? methods.join(" · ") : "(none)"));
      row.appendChild(el("span", "se-note", "per-instance"));
      panelEl.appendChild(row);
      panelEl.appendChild(el("p", "se-note",
        "the host calls addControl per instance; each runs animate(ctx) once, render(ctx, dt) each frame, click(ctx) on tap. Press play to host it."));
    } else {
      panelEl.appendChild(el("p", "se-note",
        "impls live in this control's js facet as me.sceneBehaviors = { name → {animate, render, …} }. " +
        "The scene references them by NAME — the code never travels in the facet JSON."));
    }

    // ── top-level lifecycle refs (behaviors.animate / render / customs) ──
    const block = doc.behaviors();
    const blockKeys = Object.keys(block);
    if (!blockKeys.length) panelEl.appendChild(el("p", "se-note", "no top-level behavior refs yet"));
    for (const k of blockKeys) {
      panelEl.appendChild(refRow(k, block[k], () => mutate(doc.setBehaviorRef(k, null))));
    }

    // add a top-level ref
    const form = el("div", "se-form");
    const nameIn = el("input");
    nameIn.placeholder = "hook (animate / render)";
    nameIn.style.width = "110px";
    const refIn = el("input");
    refIn.placeholder = "impl name in js facet";
    refIn.style.width = "120px";
    const add = el("button", null, "set");
    add.addEventListener("click", () => {
      if (!nameIn.value.trim() || !refIn.value.trim()) return;
      if (mutate(doc.setBehaviorRef(nameIn.value.trim(), refIn.value.trim()))) { nameIn.value = refIn.value = ""; }
    });
    form.append(nameIn, refIn, add);
    panelEl.appendChild(form);

    // ── per-node behavior refs ──────────────────────────────────────────
    panelEl.appendChild(el("h4", null, "node behaviors"));
    let anyNode = false;
    for (const n of doc.nodes()) {
      if (n && typeof n.behavior === "string") {
        anyNode = true;
        panelEl.appendChild(refRow(n.id, n.behavior, () => mutate(doc.setNodeBehavior(n.id, null))));
      }
    }
    if (!anyNode) panelEl.appendChild(el("p", "se-note", "none — set one in a node's inspector"));

    // ── the impls this control's js facet provides ──────────────────────
    panelEl.appendChild(el("h4", null, `impls found in js facet (${impls.length})`));
    if (!impls.length) {
      panelEl.appendChild(el("p", "se-note",
        "none — add me.sceneBehaviors = { … } to the js facet to give this scene behavior"));
    }
    for (const name of impls) {
      const impl = sceneBehaviors[name] || {};
      const hooks = ["animate", "render"].filter((h) => typeof impl[h] === "function");
      const methods = Object.keys(impl).filter((k) => typeof impl[k] === "function" && !["animate", "render"].includes(k));
      const row = el("div", "se-row");
      row.appendChild(el("span", "grow", name));
      row.appendChild(el("span", "se-note",
        (hooks.length ? hooks.join(",") : "") + (methods.length ? (hooks.length ? " · " : "") + methods.join(",") : "")));
      panelEl.appendChild(row);
    }

    // ── live per-instance inspector (PLAY) ──────────────────────────────
    if (mode === "play" && rt) {
      panelEl.appendChild(el("h4", null, "live instances"));
      for (const [prefix, inst] of rt.instances) {
        const row = el("div", "se-row");
        const label = prefix === "" ? "(root)" : prefix.replace(/:$/, "");
        const data = inst.behaviorData || {};
        const keys = Object.keys(data).filter((k) => typeof data[k] !== "object" || data[k] === null);
        row.appendChild(el("span", "grow", label));
        row.appendChild(el("span", "se-note",
          keys.slice(0, 4).map((k) => `${k}=${typeof data[k] === "number" ? +data[k].toFixed(3) : data[k]}`).join(" ")));
        panelEl.appendChild(row);
      }
      panelEl.appendChild(el("p", "se-note", "per-instance behavior scratch (ctx.data) — refreshes with this tab"));
    }
  }

  async function renderMounts() {
    panelEl.appendChild(el("h4", null, "mounts — child scenes"));
    for (const m of doc.mounts()) {
      const row = el("div", "se-row" + (selected === m.id ? " sel" : ""));
      row.appendChild(el("span", "grow", `${m.id} ⊕ ${m.lib}.${m.ctl}${m.at ? ` at ${m.at}` : ""}`));
      row.addEventListener("click", () => select(m.id));
      panelEl.appendChild(row);
    }
    const form = el("div", "se-form");
    const libSel = el("select");
    const libs = await libsOf();
    if (!(libs instanceof Error)) for (const l of libs) {
      const o = el("option", null, l.name ?? l);
      o.value = l.name ?? l;
      libSel.appendChild(o);
    }
    const ctlSel = el("select");
    const fillCtls = async () => {
      ctlSel.replaceChildren();
      const controls = await controlsOf(libSel.value);
      if (controls instanceof Error) return;
      for (const c of controls) { const o = el("option", null, c.name); o.value = c.name; ctlSel.appendChild(o); }
    };
    if (libSel.value) await fillCtls();
    libSel.addEventListener("change", fillCtls);
    const atSel = el("select");
    const rootOpt = el("option", null, "at (root)");
    rootOpt.value = "";
    atSel.appendChild(rootOpt);
    for (const n of doc.nodes()) if (n.kind === "slot") { const o = el("option", null, `at ${n.id}`); o.value = n.id; atSel.appendChild(o); }
    const add = el("button", null, "+ mount");
    add.addEventListener("click", () => {
      if (!libSel.value || !ctlSel.value) return;
      const raw = { id: doc.newId(ctlSel.value), lib: libSel.value, ctl: ctlSel.value };
      if (atSel.value) raw.at = atSel.value;
      if (mutate(doc.addMount(raw))) select(raw.id);
    });
    form.append(libSel, ctlSel, atSel, add);
    panelEl.appendChild(form);
    panelEl.appendChild(el("p", "se-note",
      "a mount renders the child control's scene facet here; overrides in the mount inspector push MY state down as expressions"));
  }

  // ── keyboard ──────────────────────────────────────────────────────────────
  root.tabIndex = 0;
  root.addEventListener("keydown", (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key === "s") { e.preventDefault(); save(); }
    else if (meta && e.key === "z" && !e.shiftKey && mode === "build") { e.preventDefault(); undo(); }
    else if (meta && (e.key === "Z" || (e.key === "z" && e.shiftKey)) && mode === "build") { e.preventDefault(); redo(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && mode === "build" && selected
             && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? "")) {
      e.preventDefault();
      const hit = doc.byId(selected);
      if (!hit) return;
      const m = hit.type === "mount" ? doc.removeMount(selected) : doc.removeNode(selected);
      if (mutate(m)) selected = null;
    }
  });
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);

  // ── view context (consumers see the open scene) ───────────────────────────
  const unregCtx = viewctx.register("scene", () => ({
    label: `scene facet — ${lib} ▸ ${name}`,
    fields: {
      [`${lib}:${name}.scene`]: JSON.stringify(doc.serialize()),
      ...(selected ? { "scene.selected": selected } : {}),
    },
  }));

  // The workbench never disposes its panes — watch for DOM removal so the
  // play runtime and stage don't outlive the pane.
  const watchdog = setInterval(() => {
    if (!host.isConnected && !gone) {
      gone = true;
      clearInterval(watchdog);
      dispose();
    }
  }, 2000);

  function dispose() {
    if (rt) { rt.dispose(); rt = null; }
    stage.dispose();
    unregCtx();
    clearInterval(watchdog);
  }

  refresh();
  return { dispose };
}

  return init(ME, ME.DATA || {});
}).catch(function (e) {
  console.log("sceneeditor failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
