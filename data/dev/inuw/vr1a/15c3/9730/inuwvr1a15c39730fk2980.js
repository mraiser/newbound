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
  const { parse: parseFlow, FlowDoc: doc } = document.querySelector('[data-control="dev:flowdoc"]').api;
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
  let opDrag = null;           // active op-move: {opIndex, from} (P2)
  let wireDragState = null;    // active wire drag (P2, reserved; commit is tap/keyboard)
  const ACCENT = "#62bd8c";
  const slug = (sid) => String(sid).replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().replace(/^([^a-z])/, "n_$1");

  const activeCase = () => caseChain(current.flow)[activeDeck];
  const nameOf = (c, i) => i === -1 ? "params" : i === -2 ? "return" : (c.cmds[i] && c.cmds[i].name) || `op${i}`;
  const firstKey = (o) => Object.keys(o || {})[0];
  // the input terminal name an op-input ordinal addresses (flownode lays its
  // in<N>/out<N> sockets in Object.keys order — see the seed in renderInstances)
  const inTermOf = (c, opIdx, ord) => Object.keys((c.cmds[opIdx] && c.cmds[opIdx].in) || {})[ord];

  // ── P2 wiring engine (rides host.state; I-1/I-2 enforced by flowdoc.canWire) ─
  // A wire SOURCE is {idx,term} — an op output ordinal (srcOrdinal 0-based into
  // the op's `out` keys) or the params bar. A wire DEST is {idx,term} — an op
  // input terminal or the return bar. The flow body stays authoritative: every
  // commit is a flowdoc.addWire on the parsed case, then rebuild() re-derives
  // the scene facet + instances from the mutated body.
  function setWireSrc(s) { if (hostApi) hostApi.setState("wireSrc", s); status(s ? `wire from ${s.label} — tap a green-lit input (I-1/I-2), Esc cancels` : "ready"); }

  // the legal targets for the current wire source: [{opIndex, ord, key, dest}]
  function legalTargets() {
    const st = hostApi && hostApi.state, src = st && st.wireSrc;
    if (!src) return [];
    const c = activeCase(); if (!c) return [];
    const out = [];
    for (const inst of instances) {
      const d = inst.data || {};
      (d.inTerms || []).forEach((t, ord) => {
        const dest = [d.opIndex, t];
        if (doc.canWire(c, [src.idx, src.term], dest).ok) out.push({ opIndex: d.opIndex, ord, key: inst.key, dest });
      });
    }
    // the return bar is a dest (its input terminals); not an instance — surface
    // it via keyboard only (§5.6 candidates). Pointer targets are op inputs.
    return out;
  }

  function commitWire(dest /* [idx,term] */) {
    const st = hostApi && hostApi.state, src = st && st.wireSrc;
    if (!src) return false;
    const c = activeCase(); if (!c) return false;
    const cmd = doc.addWire(c, { src: [src.idx, src.term], dest: [dest[0], dest[1]] });
    if (cmd.error) { status(`wire refused: ${cmd.error}`, "bad"); setWireSrc(null); return false; }
    setWireSrc(null);
    status(`wired ${src.label} → ${nameOf(c, dest[0])}.${dest[1]}`, "ok");
    gate(".fv-g-wire", true, `${src.label} → ${nameOf(c, dest[0])}.${dest[1]}`);
    rebuild();               // the derived facet re-projects with the new wire
    return true;
  }

  // socket tap from a flownode behavior (click on in<N>/out<N>)
  function onSocketTap(p) {
    const c = activeCase(); if (!c) return;
    const op = c.cmds[p.opIndex];
    const st = hostApi.state || (hostApi.state = {});
    if (p.which === "out") {
      const term = Object.keys((op && op.out) || {})[p.ord];
      if (term === undefined) return;
      setWireSrc({ idx: p.opIndex, term, srcOrdinal: p.ord, label: `${nameOf(c, p.opIndex)}.${term}`, key: p.key });
      renderLegalGlow();
    } else {
      const term = inTermOf(c, p.opIndex, p.ord);
      if (term === undefined) return;
      if (st.wireSrc) {
        const chk = doc.canWire(c, [st.wireSrc.idx, st.wireSrc.term], [p.opIndex, term]);
        if (chk.ok) commitWire([p.opIndex, term]);
        else { status(`✗ ${chk.reason}`, "bad"); flashIllegal(p.key); }
      } else {
        status(`${nameOf(c, p.opIndex)}.${term} — tap an output to start a wire`, "");
      }
    }
  }

  // op/socket drag from a flownode behavior
  function onOpDrag(p) {
    const c = activeCase(); if (!c) return;
    const op = c.cmds[p.opIndex]; if (!op) return;
    const inst = instances.find((i) => i.key === p.key);
    if (p.phase === "start") {
      if (p.which === "out") {           // grab an output → arm the wire source
        const term = Object.keys(op.out || {})[p.ord];
        if (term !== undefined) { setWireSrc({ idx: p.opIndex, term, srcOrdinal: p.ord, label: `${nameOf(c, p.opIndex)}.${term}`, key: p.key }); renderLegalGlow(); }
        wireDragState = { key: p.key };
        return;
      }
      if (p.which === "in") return;      // input drags don't start gestures (tap wires)
      opDrag = { opIndex: p.opIndex, key: p.key, from: { x: op.pos.x, y: op.pos.y, z: op.pos.z } };
      return;
    }
    if (opDrag && p.key === opDrag.key && inst) {
      if (p.phase === "move") {
        const e = p.evt || {};
        if (typeof e.x === "number") { inst.rig.pos.x = e.x; op.pos.x = Math.round(e.x / 0.05) * 0.05; }
        if (typeof e.y === "number") { inst.rig.pos.y = e.y; op.pos.y = Math.round(e.y / 0.05) * 0.05; }
        if (typeof e.z === "number") { inst.rig.pos.z = e.z; op.pos.z = Math.round(e.z / 0.05) * 0.05; }
      } else if (p.phase === "end") { const d = opDrag; opDrag = null; rebuild(); }
      return;
    }
    if (p.phase === "end" && wireDragState && p.key === wireDragState.key) wireDragState = null;
  }

  // legal-target glow (green = legal, red pulse = the refused socket) via setRig
  function renderLegalGlow() {
    const legal = new Set(legalTargets().map((t) => `${t.key}:in${t.ord}`));
    for (const inst of instances) {
      (inst.data.inTerms || []).forEach((t, ord) => {
        const ok = legal.has(`${inst.key}:in${ord}`);
        inst.ctx.setRig(`in${ord}`, "material", { color: ok ? "#2bd97c" : "#f0a63c", emissive: ok });
        inst.ctx.setRig(`in${ord}`, "scale", ok ? { x: 1.5, y: 1.5, z: 1.5 } : { x: 1, y: 1, z: 1 });
      });
    }
  }
  function clearLegalGlow() {
    for (const inst of instances) {
      (inst.data.inTerms || []).forEach((t, ord) => {
        inst.ctx.setRig(`in${ord}`, "material", { color: "#f0a63c", emissive: false });
        inst.ctx.setRig(`in${ord}`, "scale", { x: 1, y: 1, z: 1 });
      });
    }
  }
  function flashIllegal(key) {
    const inst = instances.find((i) => i.key === key); if (!inst) return;
    inst.ctx.setRig("body", "material", { token: "paper", color: "#e05555" });
    setTimeout(() => inst.ctx.setRig("body", "material", { token: "paper", color: null }), 220);
  }

  // ── P2 keyboard wiring (§5.6): W arms the selected op's first output, arrows
  //    walk ONLY the legal targets (canWire-filtered up front), Enter commits. ─
  let wireKb = null;   // {cands:[{opIndex,ord,key,dest}], k}
  function startKeyboardWiring() {
    const st = hostApi.state || {};
    if (!st.wireSrc) { status("no wire source — tap an output socket (or select an op + W)", "bad"); return false; }
    const cands = legalTargets().sort((a, b) => (a.opIndex - b.opIndex) || (a.ord - b.ord));
    if (!cands.length) { status("no legal target for this output (I-1/I-2)", "bad"); return false; }
    wireKb = { cands, k: 0 };
    showWireCandidate();
    return true;
  }
  function showWireCandidate() {
    if (!wireKb) return;
    const { cands, k } = wireKb;
    const t = cands[k];
    clearLegalGlow(); renderLegalGlow();
    const inst = instances.find((i) => i.key === t.key);
    if (inst) inst.ctx.setRig(`in${t.ord}`, "scale", { x: 2.2, y: 2.2, z: 2.2 });
    if (stage && stage.emphasize) stage.emphasize(`${t.key}:in${t.ord}`);
    status(`wire → ${nameOf(activeCase(), t.dest[0])}.${t.dest[1]} · ${k + 1}/${cands.length} · ←→ choose · Enter wires · Esc cancels`, "ok");
  }
  function moveWireCandidate(dir) { if (!wireKb) return; wireKb.k = (wireKb.k + dir + wireKb.cands.length) % wireKb.cands.length; showWireCandidate(); }
  function commitKeyboardWire() {
    if (!wireKb) return;
    const t = wireKb.cands[wireKb.k];
    wireKb = null;
    if (stage && stage.emphasize) stage.emphasize(null);
    commitWire(t.dest);
  }
  function cancelWiring() {
    wireKb = null;
    clearLegalGlow();
    if (stage && stage.emphasize) stage.emphasize(null);
    setWireSrc(null);
  }
  // W on a selected op arms its first output as the wire source (the §5.6 entry)
  function armSelectedOutput() {
    const st = hostApi.state || {};
    const m = st.selectedKey && /^d(\d+)_op(\d+)$/.exec(st.selectedKey);
    if (m) {
      const c = activeCase(); const op = c && c.cmds[+m[2]];
      const term = op && firstKey(op.out);
      if (term !== undefined) {
        setWireSrc({ idx: +m[2], term, srcOrdinal: 0, label: `${nameOf(c, +m[2])}.${term}`, key: st.selectedKey });
        renderLegalGlow(); startKeyboardWiring(); return;
      }
    }
    if (st.wireSrc) startKeyboardWiring();
    else status("select an op (or tap an output) to wire from", "bad");
  }


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
        opIndex: i,
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
    // P2 gesture hooks: flownode behaviors route socket taps + drags here.
    hostApi.setState("onSocketTap", onSocketTap);
    hostApi.setState("onOpDrag", onOpDrag);
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
    opDrag = null; wireDragState = null; wireKb = null;   // drop in-flight gestures
    if (hostApi && hostApi.state) hostApi.setState("wireSrc", null);
    renderFacade();
    await renderInstances();
    frameDeck();
    status(`${deckCount} deck${deckCount === 1 ? "" : "s"} · ${caseChain(current.flow)[activeDeck].cmds.length} ops · editing (P2 wiring)`);
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
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        // keyboard wire mode owns arrows/Enter/Esc while it is up (§5.6)
        if (wireKb) {
          if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") { e.preventDefault(); moveWireCandidate(e.shiftKey ? -1 : 1); return; }
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveWireCandidate(-1); return; }
          if (e.key === "Enter") { e.preventDefault(); commitKeyboardWire(); return; }
          if (e.key === "Escape") { e.preventDefault(); cancelWiring(); status("wiring cancelled"); return; }
        }
        if (e.key === "w" || e.key === "W") { e.preventDefault(); armSelectedOutput(); }
        else if (e.key === "Escape") {
          if (hostApi.state && hostApi.state.wireSrc) cancelWiring();
          else if (drillStack.length) drillBack();
          else clearSelection();
        }
        else if (e.key === "2") setProj("front");
        else if (e.key === "3") setProj("persp");
        else if (e.key === "a" || e.key === "A") frameDeck();
        else if (e.key === "[") setActiveDeck((activeDeck - 1 + deckCount) % deckCount);
        else if (e.key === "]") setActiveDeck((activeDeck + 1) % deckCount);
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
