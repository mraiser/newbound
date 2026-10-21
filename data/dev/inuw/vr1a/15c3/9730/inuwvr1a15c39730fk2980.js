// flowview3d — the P1 GATE for the floweditor3d → app-scene-stack conversion.
// A READ-ONLY flow viewer that RIDES app:scenehost (the ONE runtime), proving
// the host can carry the editor before any editing gesture is ported. The flow
// body stays AUTHORITATIVE (decision 4): the scene facet is a DERIVED view,
// regenerated from the parsed flowdoc on every load/deck/drill via
// flowproject.toSceneDoc. Editing is OFF — the four chrome behaviors the gate
// must demonstrate ride the host:
//   decks     — case-chain tabs set the active deck and re-derive the facet
//   selection — tap → host.state.selectedKey + stage.emphasize (the outline)
//   drill     — dblclick a local sub-flow to push it; Esc/back pops
//   camera    — persp / front-ortho (key 2/3) + frame-the-deck ride the stage
//
// ARCHITECTURE (two layers, both on the host):
//   facade  — the projected toSceneDoc facet upserted onto the stage. It is
//             the RENDERED deck (bars, wires, tags, miniatures, receding ghost
//             decks) and the front-ortho parity picture. NOT tapped (picking is
//             routed to instances so the gate exercises behavior dispatch).
//   instances — each op of the active deck is addControl'd as a dev:flownode
//             (decision 1: one instance PER OP; decision 2: one shared
//             kind-parametrized control). Its scene facet is the shape, its
//             me.sceneBehaviors are the (P1 minimal) gestures: render lifts the
//             selected node, click selects via host.state. Taps land HERE.
//
// The gate rail flips as each property is demonstrated, verified headlessly on
// the GL-less Noobscape host via the scenehost null-renderer + me.tap surface.
// The live stage DOES render the facade + instances; the host's null stage is
// only the no-GL fallback — taps are then driven programmatically by the gate.

var me = this;
var ME = document.getElementById(me.UUID);

var readyP = new Promise(function (res) { me.ready = res; }).then(async () => {
  const { parse: parseFlow } = document.querySelector('[data-control="dev:flowdoc"]').api;
  const { toSceneDoc, frontOrtho, GEO } = document.querySelector('[data-control="dev:flowproject"]').api;

  const $ = (s) => ME.querySelector(s);
  const status = (t) => { const el = $(".fv-status"); if (el) el.textContent = t; };
  const gate = (cls, ok, note) => {
    const li = ME.querySelector(cls); if (!li) return;
    li.classList.toggle("pass", !!ok); li.classList.toggle("fail", ok === false);
    const b = li.querySelector("b"); if (b) b.textContent = (ok ? "pass" : "fail") + (note ? ` — ${note}` : "");
  };

  // ── specimen flow: two decks (a nextcase chain), a drillable local sub-flow,
  //    constants, a persistent, and wires — exercises bars, terminals, wires,
  //    deck chain, and the drill path the gate must carry. ─────────────────────
  const SPECIMEN = {
    input:  { a: { mode: "in", type: "int", x: -0.6 }, b: { mode: "in", type: "int", x: 0.6 } },
    output: { r: { mode: "out", type: "int", x: 0 } },
    cmds: [
      { name: "scale", type: "local", pos: { x: 0, y: 1.4, z: 0 }, width: 1,
        in:  { v: { mode: "in", type: "int", x: 0 } },
        out: { r: { mode: "out", type: "int", x: 0 } },
        localdata: {
          input:  { v: { mode: "in", type: "int", x: 0 } },
          output: { r: { mode: "out", type: "int", x: 0 } },
          cmds: [
            { name: "k", type: "constant", ctype: "int", pos: { x: -0.4, y: 0.5, z: 0 }, width: 1,
              in: {}, out: { v: { mode: "out", type: "int", x: 0 } } },
            { name: "mul", type: "primitive", pos: { x: 0.2, y: -0.5, z: 0 }, width: 1,
              in:  { a: { mode: "in", type: "int", x: -0.2 }, b: { mode: "in", type: "int", x: 0.2 } },
              out: { r: { mode: "out", type: "int", x: 0 } } },
          ],
          cons: [ { src: [-1, "v"], dest: [1, "a"] }, { src: [0, "v"], dest: [1, "b"] }, { src: [1, "r"], dest: [-2, "r"] } ],
        } },
      { name: "bias", type: "constant", ctype: "int", pos: { x: -1.2, y: 0.2, z: 0 }, width: 1,
        in: {}, out: { v: { mode: "out", type: "int", x: 0 } } },
      { name: "sum", type: "primitive", pos: { x: 0, y: -1.2, z: 0 }, width: 1,
        in:  { x: { mode: "in", type: "int", x: -0.2 }, y: { mode: "in", type: "int", x: 0.2 } },
        out: { r: { mode: "out", type: "int", x: 0 } } },
      { name: "acc", type: "persistent", pos: { x: 1.4, y: -1.2, z: 0 }, width: 0.6,
        in:  { v: { mode: "in", type: "int", x: 0 } }, out: { v: { mode: "out", type: "int", x: 0 } } },
    ],
    cons: [
      { src: [-1, "a"], dest: [0, "v"] },
      { src: [0, "r"],  dest: [2, "x"] },
      { src: [1, "v"],  dest: [2, "y"] },
      { src: [2, "r"],  dest: [-2, "r"] },
      { src: [2, "r"],  dest: [3, "v"] },
    ],
    nextcase: {
      input:  { r: { mode: "in", type: "int", x: 0 } },
      output: { r: { mode: "out", type: "int", x: 0 } },
      cmds: [
        { name: "dbl", type: "primitive", pos: { x: 0, y: 0.4, z: 0 }, width: 1,
          in:  { v: { mode: "in", type: "int", x: 0 } }, out: { r: { mode: "out", type: "int", x: 0 } } },
      ],
      cons: [ { src: [-1, "r"], dest: [0, "v"] }, { src: [0, "r"], dest: [-2, "r"] } ],
    },
  };

  // ── viewer state ─────────────────────────────────────────────────────────
  let hostApi = null;          // the scenehost
  let stage = null;            // host.stage (GL scenestage, or the null stage)
  let activeDeck = 0;
  let drillStack = [];         // [{flow, title, deck}] — the breadcrumb trail
  let current = null;          // { flow, title } the flow being viewed
  let deckCount = 0;
  let instances = [];          // live flownode instances for the active deck
  let projMode = "persp";      // "persp" | "front"
  const slug = (sid) => String(sid).replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().replace(/^([^a-z])/, "n_$1");

  // chain the active deck's cases (a FlowDoc Case linked by nextcase)
  function caseChain(rootCase) { const o = []; let c = rootCase; while (c) { o.push(c); c = c.nextcase; } return o; }

  // ── facade: project the derived scene facet onto the stage ───────────────
  // The facade is the rendered deck picture (parity with the 2D viewer). It is
  // NOT the tap surface — instances carry selection so the gate exercises the
  // host's behavior dispatch. Facade spec ids are prefixed `fx_` and their
  // tap/hover affordances are stripped so stage raycast ignores them; the
  // underlying scenedoc nodes keep their ids for scenedoc diagnostics.
  function renderFacade() {
    const sceneDoc = toSceneDoc(current.flow, { editable: false, activeDeck });
    const specs = sceneDoc.nodes.map((n) => {
      const s = { ...n, id: "fx_" + n.id };
      if (n.parent !== undefined) s.parent = "fx_" + n.parent;
      if (n.kind === "link") { s.from = "fx_" + n.from; s.to = "fx_" + n.to; }
      delete s.affordances;                       // facade is scenery, not picked
      s.params = n.params || (n.text ? n.text : undefined);
      return s;
    });
    stage.setScene(specs, { lights: "default", grid: true, camera: null });
    return sceneDoc;
  }

  // ── instances: host each op of the ACTIVE deck as a flownode ─────────────
  async function renderInstances() {
    // drop prior instances
    for (const inst of instances) { try { hostApi.removeControl(inst.key); } catch (e) {} }
    instances = [];
    const chain = caseChain(current.flow);
    const c = chain[activeDeck]; if (!c) return;
    for (let i = 0; i < c.cmds.length; i++) {
      const op = c.cmds[i];
      const key = `d${activeDeck}_op${i}`;
      const inst = await hostApi.addControl("dev", "flownode", {
        opType: op.type, name: op.name, width: op.width, pos: op.pos,
        inTerms: Object.keys(op.in || {}), outTerms: Object.keys(op.out || {}),
        phase: i * 0.7,
      }, key);
      instances.push(inst);
      // seat the instance's rig at the op's projected position so the clickable
      // body sits on the facade op (decision 1: per-op grouping via the rig).
      if (inst && inst.rig) { inst.rig.pos.x = op.pos.x; inst.rig.pos.y = op.pos.y; inst.rig.pos.z = op.pos.z; }
    }
    // host state the behaviors read (decision 1: shared per-deck state)
    hostApi.setState("activeDeck", activeDeck);
    hostApi.setState("deckCount", deckCount);
  }

  // ── chrome: decks / crumbs / title / status ──────────────────────────────
  function renderChrome() {
    const chain = caseChain(current.flow);
    deckCount = chain.length;
    $(".fv-title").textContent = current.title;
    // breadcrumbs = drill stack + current
    const crumbs = drillStack.map((d, k) => `<span class="fv-crumb" data-k="${k}">${d.title}</span>`).concat([`<span>${current.title}</span>`]);
    $(".fv-crumbs").innerHTML = crumbs.join(" › ");
    $(".fv-crumbs").querySelectorAll(".fv-crumb").forEach((el) => el.addEventListener("click", () => drillTo(+el.dataset.k)));
    // deck tabs
    const decks = $(".fv-decks"); decks.innerHTML = "";
    chain.forEach((_, k) => {
      const b = document.createElement("button");
      b.className = "fv-deck-tab"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", k === activeDeck ? "true" : "false");
      b.textContent = k === 0 ? "case" : "next".repeat(k) || "case";
      if (k > 0) b.textContent = "." + "next".repeat(k);
      b.addEventListener("click", () => setActiveDeck(k));
      decks.appendChild(b);
    });
    $(".fv-back").style.visibility = drillStack.length ? "visible" : "hidden";
  }

  function setActiveDeck(k) {
    if (k === activeDeck || k < 0 || k >= deckCount) return;
    activeDeck = k;
    clearSelection();
    renderChrome();
    rebuild();
  }

  // drill into a local sub-flow (or pop to a breadcrumb level)
  function drillInto(op) {
    if (!op || op.type !== "local" || !op.localdata) return;
    drillStack.push({ flow: current.flow, title: current.title, deck: activeDeck });
    current = { flow: parseFlow(op.localdata).root, title: op.name };
    activeDeck = 0;
    clearSelection();
    renderChrome();
    rebuild();
    gate(".fv-g-drill", true, `drilled into "${op.name}" (${drillStack.length} deep)`);
  }
  function drillTo(k) {           // pop to breadcrumb index k
    while (drillStack.length > k + 1) drillStack.pop();
    const d = drillStack.pop(); if (!d) return;
    current = { flow: d.flow, title: d.title };
    activeDeck = d.deck;
    clearSelection();
    renderChrome();
    rebuild();
  }
  function drillBack() { if (drillStack.length) drillTo(drillStack.length - 1); }

  // ── selection (rides host.state + the stage's emphasis outline) ──────────
  function clearSelection() {
    if (hostApi) hostApi.setState("selectedKey", null);
    if (stage && stage.emphasize) stage.emphasize(null);
    renderInspector(null);
  }
  function watchSelection() {
    // flownode.click sets host.state.selectedKey; mirror it to the stage
    // emphasis outline + the inspector. Polled (headless has no event hook).
    let last = undefined;
    setInterval(() => {
      const sel = hostApi && hostApi.state && hostApi.state.selectedKey;
      if (sel === last) return; last = sel;
      if (sel && stage && stage.emphasize) stage.emphasize(`${sel}:body`);
      else if (stage && stage.emphasize) stage.emphasize(null);
      renderInspector(sel);
      if (sel) gate(".fv-g-select", true, `node "${sel}" emphasized`);
    }, 140);
  }
  function renderInspector(key) {
    const body = $(".fv-inspect-body");
    if (!key) { body.innerHTML = `<p class="fv-empty">Select an element. Local sub-flows drill in on double-click — you are inside the program, not looking at a picture of it.</p>`; return; }
    const chain = caseChain(current.flow); const c = chain[activeDeck];
    const m = /^d(\d+)_op(\d+)$/.exec(key);
    const op = m ? c.cmds[+m[2]] : null;
    if (!op) { body.innerHTML = `<p class="fv-empty">—</p>`; return; }
    const rows = [
      ["name", op.name], ["kind", op.type],
      ["in", Object.keys(op.in || {}).join(", ") || "—"],
      ["out", Object.keys(op.out || {}).join(", ") || "—"],
      ["pos", `(${op.pos.x}, ${op.pos.y}, ${op.pos.z})`],
    ];
    if (op.type === "local") rows.push(["drill", "double-click to enter"]);
    body.innerHTML = rows.map(([k, v]) => `<div class="fv-row"><span>${k}</span><b>${v}</b></div>`).join("");
  }

  // ── camera toolbar (rides the stage) ─────────────────────────────────────
  function setProj(mode2) {
    projMode = mode2;
    const btn = $(".fv-proj");
    btn.setAttribute("aria-pressed", mode2 === "front" ? "true" : "false");
    btn.textContent = mode2 === "front" ? "front" : "persp";
    if (stage && stage.setCameraMode) stage.setCameraMode(mode2);
    gate(".fv-g-camera", true, `${mode2} mode`);
  }
  function frameDeck() { if (stage && stage.frameAll) stage.frameAll(); }

  // ── rebuild the whole view (deck / drill / load) ─────────────────────────
  async function rebuild() {
    renderFacade();
    await renderInstances();
    frameDeck();
    status(`${deckCount} deck${deckCount === 1 ? "" : "s"} · ${caseChain(current.flow)[activeDeck].cmds.length} ops · read-only`);
  }

  // ── boot: mount the host, then build ──────────────────────────────────────
  function init() {
    const hostEl = $(".fv-host");
    return new Promise((res) => hostEl.api.waitReady(() => res(hostEl.api))).then(async (scenehost) => {
      hostApi = scenehost; stage = scenehost.stage;
      if (!hostApi || !hostApi.addControl) { gate(".fv-g-host", false, "no addControl"); return null; }
      gate(".fv-g-host", true, scenehost.headless ? "headless (no WebGL)" : "webgl");

      current = { flow: parseFlow(SPECIMEN).root, title: "specimen" };
      renderChrome();
      await rebuild();
      gate(".fv-g-deck", true, `${deckCount} decks projected`);
      watchSelection();

      // headless tap surface: the null stage has no raycaster, so the gate
      // drives the same tap dispatch the GL stage fires. Click anywhere on the
      // host to select the first op; double-click to drill the local.
      if (scenehost.headless) {
        hostEl.addEventListener("click", () => { if (instances[0] && scenehost.tap) scenehost.tap(`${instances[0].key}:body`); });
        hostEl.addEventListener("dblclick", () => { const c = caseChain(current.flow)[activeDeck]; if (c) drillInto(c.cmds[0]); });
        status("headless — click the stage to select, dblclick to drill");
      } else {
        // GL: a real tap raycasts to the instance body; dblclick drills the local.
        hostEl.addEventListener("dblclick", () => {
          const sel = hostApi.state && hostApi.state.selectedKey;
          const m = sel && /^d(\d+)_op(\d+)$/.exec(sel);
          const c = caseChain(current.flow)[activeDeck];
          if (m && c) drillInto(c.cmds[+m[2]]);
        });
      }

      // toolbar + keys
      $(".fv-proj").addEventListener("click", () => setProj(projMode === "front" ? "persp" : "front"));
      $(".fv-frame").addEventListener("click", frameDeck);
      $(".fv-back").addEventListener("click", drillBack);
      ME.addEventListener("keydown", (e) => {
        if (e.key === "2") setProj("front");
        else if (e.key === "3") setProj("persp");
        else if (e.key === "a" || e.key === "A") frameDeck();
        else if (e.key === "[") setActiveDeck((activeDeck - 1 + deckCount) % deckCount);
        else if (e.key === "]") setActiveDeck((activeDeck + 1) % deckCount);
        else if (e.key === "Escape") { if (drillStack.length) drillBack(); else clearSelection(); }
      });

      return { dispose() {} };
    }).catch((e) => { status("boot failed: " + (e && e.message ? e.message : e)); return null; });
  }

  return init();
}).catch(function (e) {
  console.log("flowview3d failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
