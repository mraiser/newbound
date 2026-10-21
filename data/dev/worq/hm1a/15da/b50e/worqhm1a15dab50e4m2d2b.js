// flowedit3d — the P2 GATE for the floweditor3d → app-scene-stack conversion:
// WIRING GESTURES ported onto app:scenehost. Building on flowview3d (the P1
// read-only gate), this adds the editing gestures as flownode behaviors +
// editor chrome, with the FLOW BODY authoritative (decision 4): every wire is
// a FlowDoc mutation (addWire/removeWire/canWire — I-1/I-2 enforced there),
// and the scene facet is a DERIVED view re-projected from the doc on each
// mutation. Nothing here writes a second source of truth.
//
// Gestures ported (design §5.4, pointer AND keyboard):
//   port tap   — tap an output socket to arm a wire; tap a legal input to
//                commit. Taps dispatch to flownode.click → host.state.onPortTap.
//   drag ghost — dragging from an output socket rides a REAL hang link whose
//                tip tracks the pointer; legal input targets preview (I-1/I-2).
//   keyboard   — W arms wiring from the selection; ←→ cycle the legal targets
//                (reading order, nearest-first); Enter commits; Esc cancels.
//   delete     — Del unwires the selected wire (frees its input, I-1).
//   undo       — ⌘Z runs the mutation's inverse (commitApplied's undo stack).
//
// The facade (toSceneDoc) is the rendered picture; the instances are the pick
// surface. The wire ghost lives on the facade as tip+hang-link specs moved via
// flowproject.terminalWorld — the SAME geometry the wires render with.

var me = this;
var ME = document.getElementById(me.UUID);

var readyP = new Promise(function (res) { me.ready = res; }).then(async () => {
  const { parse: parseFlow, propagationRounds, diffFlow } = document.querySelector('[data-control="dev:flowdoc"]').api;
  const { toSceneDoc, terminalWorld, GEO } = document.querySelector('[data-control="dev:flowproject"]').api;
  const { tidy, untangle } = document.querySelector('[data-control="dev:flowlayout"]').api;

  // ── backend plumbing (same ajax idiom as floweditor3d) ────────────────────
  const invokeP = (l2, c2, m2, a2) => new Promise((res2) => invokeCommand(l2, c2, m2, a2, res2));
  const codeCmd = (m2, a2) => invokeP("dev", "code", m2, a2);
  const writeFlowBody = (l2, c2, m2, b2, { base = "", label = "" } = {}) =>
    codeCmd("write_flow_body", { lib: l2, ctl: c2, cmd: m2, body: b2, base, label, author: "", nn_sessionid: "" });
  const readFlowBody = (l2, c2, m2) => codeCmd("read_flow_body", { lib: l2, ctl: c2, cmd: m2 });
  const listPatches = (l2, c2, n2) => codeCmd("list_control_patches", { lib: l2, ctl: c2, limit: n2 || 0 });

  const $ = (s) => ME.querySelector(s);
  const status = (t, cls) => { const el = $(".fe-status"); if (el) { el.textContent = t; el.className = "fe-status " + (cls || ""); } };
  const gate = (cls, ok, note) => {
    const li = ME.querySelector(cls); if (!li) return;
    li.classList.toggle("pass", !!ok); li.classList.toggle("fail", ok === false);
    const b = li.querySelector("b"); if (b) b.textContent = (ok ? "pass" : "fail") + (note ? ` — ${note}` : "");
  };
  const slug = (sid) => String(sid).replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase().replace(/^([^a-z])/, "n_$1");

  // ── specimen flow: two decks (a nextcase chain), a drillable local sub-flow,
  //    constants, a persistent, and wires. ────────────────────────────────────
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
          cons: [ { src: [-1, "v"], dest: [0, "a"] }, { src: [0, "v"], dest: [1, "b"] },
                  { src: [1, "r"], dest: [-2, "r"] } ],
        } },
      { name: "offset", type: "constant", ctype: "int", pos: { x: -1.4, y: 0, z: 0 }, width: 1,
        in: {}, out: { v: { mode: "out", type: "int", x: 0 } } },
      { name: "add", type: "primitive", pos: { x: 0.4, y: -1.2, z: 0 }, width: 1,
        in:  { a: { mode: "in", type: "int", x: -0.2 }, b: { mode: "in", type: "int", x: 0.2 } },
        out: { r: { mode: "out", type: "int", x: 0 } } },
      { name: "stash", type: "persistent", pos: { x: 1.6, y: 0.2, z: 0 }, width: 0.8,
        in:  { v: { mode: "in", type: "int", x: 0 } }, out: { v: { mode: "out", type: "int", x: 0 } } },
    ],
    cons: [ { src: [-1, "a"], dest: [0, "v"] }, { src: [1, "v"], dest: [2, "b"] },
            { src: [0, "r"], dest: [2, "a"] }, { src: [2, "r"], dest: [-2, "r"] } ],
    nextcase: {
      input:  { r: { mode: "in", type: "int", x: 0 } },
      output: { r: { mode: "out", type: "int", x: 0 } },
      cmds: [
        { name: "double", type: "primitive", pos: { x: 0, y: 0.6, z: 0 }, width: 1,
          in:  { v: { mode: "in", type: "int", x: 0 } }, out: { r: { mode: "out", type: "int", x: 0 } } },
      ],
      cons: [ { src: [-1, "r"], dest: [0, "v"] }, { src: [0, "r"], dest: [-2, "r"] } ],
    },
  };

  // ── editor state ──────────────────────────────────────────────────────────
  let hostApi = null, stage = null;
  let activeDeck = 0, drillStack = [], deckCount = 0;
  let doc = null;                 // the FlowDoc (AUTHORITATIVE flow body)
  let current = null;             // { title } display info for the focused flow
  let focusPath = [];             // breadcrumb of {root, title} to the focused case
  let instances = [];             // live flownode instances for the active deck
  let projMode = "persp";
  let undoStack = [];
  let wireMode = null;            // keyboard wiring { src:{idx,term}, cands, k }
  let armSrc = null;              // pointer wiring: the armed output { idx, term, key }
  let ghostIds = [];              // facade ghost specs (tip + hang link)
  let selWire = null;             // a selected wire's cons index (for Del)

  // ── P3: authoring + save state ────────────────────────────────────────────
  let dirty = false, saving = false, baseHash = "", pendingLabels = [];
  let redoStack = [];

  // ── P4: run tokens + journal state ────────────────────────────────────────
  let savedBody = null;           // JSON snapshot of the last loaded/saved body (diff baseline)
  let running = false, runSeq = 0, lastRun = null;
  let journalRows = [];           // the server journal's flow entries for this command
  const snap = () => { const b = doc.serialize(); return typeof b === "string" ? b : JSON.stringify(b); };
  // P5 CUTOVER: the SAME props contract as floweditor3d's init(host, {title,
  // graph, source, onBack}) — dev.frame mounts either control with one call.
  //   graph  — the flow body as loaded (object or JSON string); shown at once
  //   source — {lib, ctl, cmd} by NAME; the body is re-read via read_flow_body
  //            (authoritative, sets baseHash) and saves journal back to it.
  //            null = a read-only view (no save/journal/revert).
  //   title  — {prefix, name, suffix}; onBack — leaving the editor's root.
  // With NO props at all this stays the P2-P4 gate harness: the specimen
  // doubles as the live body and saves exercise scratch.skills.flowedit3d_body.
  const PROPS = ME.DATA || {};
  const harness = !PROPS.graph && !PROPS.source;
  let source = harness ? { lib: "scratch", ctl: "skills", cmd: "flowedit3d_body" } : (PROPS.source || null);
  const PALETTE = [
    { type: "primitive", label: "+ op",  raw: { name: "op", type: "primitive", width: 1, in: { a: { mode: "in", type: "int", x: -0.2 }, b: { mode: "in", type: "int", x: 0.2 } }, out: { r: { mode: "out", type: "int", x: 0 } } } },
    { type: "constant",  label: "const", raw: { name: "k", type: "constant", ctype: "int", width: 1, in: {}, out: { v: { mode: "out", type: "int", x: 0 } } } },
    { type: "match",     label: "match", raw: { name: "m", type: "match", width: 1, in: { v: { mode: "in", type: "int", x: 0 } }, out: {} } },
    { type: "local",     label: "local", raw: { name: "sub", type: "local", width: 1, in: { v: { mode: "in", type: "int", x: 0 } }, out: { r: { mode: "out", type: "int", x: 0 } },
        localdata: { input: { v: { mode: "in", type: "int", x: 0 } }, output: { r: { mode: "out", type: "int", x: 0 } }, cmds: [], cons: [] } } },
  ];

  // chain the focused case's decks
  function focusRoot() { return focusPath.length ? focusPath[focusPath.length - 1].root : doc.root; }
  function caseChain(rootCase) { const o = []; let c = rootCase; while (c) { o.push(c); c = c.nextcase; } return o; }
  function focusedCase() { return caseChain(focusRoot())[activeDeck]; }
  function nameOf(c, idx) { return idx === -1 ? "params" : idx === -2 ? "return" : (c.cmds[idx] ? c.cmds[idx].name : "?"); }

  // ── mutations: apply + record the inverse (the undo stack) ────────────────
  function commitApplied(cmd) {
    if (!cmd || cmd.error) return;
    // a run owns the stage: an edit mid-run would re-project the facade under
    // the tokens — revert it at once (the doc stays exactly as before)
    if (running) { try { cmd.undo(); } catch (e) {} status("running — edit refused until the run delivers", "bad"); return false; }
    // a read-only view (graph without a source command) cannot keep edits
    if (!source) { try { cmd.undo(); } catch (e) {} status("read-only view — no source command to save edits to", "bad"); return false; }
    undoStack.push(cmd);
    redoStack = [];                       // a fresh mutation invalidates redo
    dirty = true; pendingLabels.push(cmd.label || "edit");
    $(".fe-undo").disabled = false;
    pushJournal(cmd.label);
    afterMutation();
    return true;
  }
  function undo() {
    if (running) return;
    const cmd = undoStack.pop(); if (!cmd) return;
    try { cmd.undo(); } catch (e) {}
    redoStack.push(cmd);
    dirty = true;
    $(".fe-undo").disabled = !undoStack.length;
    pushJournal("undo " + (cmd.label || ""));
    afterMutation();
    gate(".fe-g-undo", true, "inverse applied");
  }
  function redo() {
    if (running) return;
    const cmd = redoStack.pop(); if (!cmd) return;
    try { if (cmd.redo) cmd.redo(); } catch (e) {}
    undoStack.push(cmd);
    dirty = true;
    $(".fe-undo").disabled = false;
    pushJournal("redo " + (cmd.label || ""));
    afterMutation();
  }
  function afterMutation() { cancelWireGhost(); renderAll(); refreshSaveUi(); renderChanges(); }

  function pushJournal(text) {
    const ul = $(".fe-journal-list"); if (!ul) return;
    const li = document.createElement("li"); li.textContent = text;
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > 24) ul.removeChild(ul.lastChild);
  }

  // ── facade: project the derived scene facet onto the stage ────────────────
  function renderFacade() {
    const sceneDoc = toSceneDoc(focusRoot(), { editable: true, activeDeck });
    const specs = sceneDoc.nodes.map((n) => {
      const s = { ...n, id: "fx_" + n.id };
      if (n.parent !== undefined) s.parent = "fx_" + n.parent;
      if (n.kind === "link") { s.from = "fx_" + n.from; s.to = "fx_" + n.to; }
      delete s.affordances;                 // facade is scenery; instances are picked
      s.params = n.params || (n.text ? n.text : undefined);
      return s;
    });
    // re-attach the ghost specs if a wire is armed (they ride the facade scene)
    stage.setScene(specs.concat(ghostSpecs()), { lights: "default", grid: true, camera: null });
    return sceneDoc;
  }

  // ── instances: host each op of the ACTIVE deck as a flownode ─────────────
  async function renderInstances() {
    for (const inst of instances) { try { hostApi.removeControl(inst.key); } catch (e) {} }
    instances = [];
    const c = focusedCase(); if (!c) return;
    for (let i = 0; i < c.cmds.length; i++) {
      const op = c.cmds[i];
      const key = `d${activeDeck}_op${i}`;
      const inst = await hostApi.addControl("dev", "flownode", {
        opType: op.type, name: op.name, width: op.width, pos: op.pos, opIndex: i,
        inTerms: Object.keys(op.in || {}), outTerms: Object.keys(op.out || {}), phase: i * 0.7,
      }, key);
      instances.push(inst);
      if (inst && inst.rig) { inst.rig.pos.x = op.pos.x; inst.rig.pos.y = op.pos.y; inst.rig.pos.z = op.pos.z; }
      seatSockets(inst, op, i);
    }
    hostApi.setState("activeDeck", activeDeck);
    hostApi.setState("deckCount", deckCount);
  }

  // position each socket node to its terminal's world pos (relative to the rig)
  // and hide unused pool sockets — so taps land on the real terminal geometry.
  function seatSockets(inst, op, opIndex) {
    if (!inst || !inst.ctx || !inst.ctx.setRig) return;
    const c = focusedCase(); if (!c) return;
    const inT = Object.keys(op.in || {}), outT = Object.keys(op.out || {});
    for (let k = 0; k < 4; k++) {
      const iid = "in" + k, oid = "out" + k;
      if (k < inT.length) {
        const w = terminalWorld(c, opIndex, "in", inT[k]);
        if (w) { inst.ctx.setRig(iid, "pos.x", w.x - op.pos.x); inst.ctx.setRig(iid, "pos.y", w.y - op.pos.y); inst.ctx.setRig(iid, "pos.z", w.z - op.pos.z); }
      } else inst.ctx.setRig(iid, "visible", false);
      if (k < outT.length) {
        const w = terminalWorld(c, opIndex, "out", outT[k]);
        if (w) { inst.ctx.setRig(oid, "pos.x", w.x - op.pos.x); inst.ctx.setRig(oid, "pos.y", w.y - op.pos.y); inst.ctx.setRig(oid, "pos.z", w.z - op.pos.z); }
      } else inst.ctx.setRig(oid, "visible", false);
    }
    if (inst.rig) { /* force a rig sync so setRig overrides apply */ const p = inst.rig.pos; inst.rig.pos = { x: p.x, y: p.y, z: p.z }; }
  }

  // ── wiring: port tap → arm / commit ───────────────────────────────────────
  // A tap on an outN socket arms wiring from that terminal; a tap on a legal
  // inN socket commits via doc.addWire. Taps route here from flownode.click.
  function onPortTap(p) {
    const c = focusedCase(); if (!c) return;
    const m = /^(in|out)(\d+)$/.exec(p.node); if (!m) return;
    const which = m[1], k = +m[2];
    const op = c.cmds[p.opIndex]; if (!op) return;
    const terms = which === "in" ? Object.keys(op.in || {}) : Object.keys(op.out || {});
    const term = terms[k]; if (term === undefined) return;

    if (which === "out") { armWire({ idx: p.opIndex, term, key: p.key }); return; }
    // an INPUT tap: commit the armed wire if legal (I-1/I-2 via canWire)
    if (armSrc) {
      const from = { idx: armSrc.idx, term: armSrc.term };   // capture: commitApplied nulls armSrc
      const chk = doc.canWire(c, [from.idx, from.term], [p.opIndex, term]);
      if (!chk.ok) { status("✗ " + chk.reason, "bad"); gate(".fe-g-i1i2", true, chk.reason); return; }
      const cmd = doc.addWire(c, { src: [from.idx, from.term], dest: [p.opIndex, term] });
      if (cmd.error) return status("wire refused: " + cmd.error, "bad");
      if (!commitApplied(cmd)) return;
      status(`wired ${nameOf(c, from.idx)}.${from.term} → ${nameOf(c, p.opIndex)}.${term} — ⌘Z undoes`, "ok");
      gate(".fe-g-wiretap", true, "port-tap wire committed");
      armSrc = null;
    }
  }

  function armWire(src) {
    armSrc = src; selWire = null;
    const c = focusedCase();
    const from = terminalWorld(c, src.idx, "out", src.term);
    if (from) showGhost(from);
    hostApi.setState("wireSrc", src);
    status(`wiring from ${nameOf(c, src.idx)}.${src.term} — tap a legal input (or Esc)`, "ok");
  }

  // ── the wire ghost: facade tip sphere + hang link tracking the pointer ────
  function ghostSpecs() {
    if (!armSrc && !wireMode) return [];
    const c = focusedCase(); if (!c) return [];
    const src = armSrc || (wireMode && wireMode.src);
    if (!src) return [];
    const fromId = `fx_${slug(`d${activeDeck}/op/${src.idx}/out/${src.term}`)}`;
    const from = terminalWorld(c, src.idx, "out", src.term) || { x: 0, y: 0, z: 0 };
    const tip = ghostTip || from;
    return [
      { id: "fx_ghosttip", kind: "sphere", pos: { x: tip.x, y: tip.y, z: tip.z },
        params: { radius: 0.05 }, material: { color: "#62bd8c", emissive: true } },
      { id: "fx_ghostwire", kind: "link", curve: "hang", from: fromId, to: "fx_ghosttip",
        r: GEO.wireR, material: { color: "#62bd8c", dash: true } },
    ];
  }
  let ghostTip = null;
  function showGhost(at) { ghostTip = at; renderFacade(); }
  function moveGhost(at) { ghostTip = at; if (armSrc || wireMode) renderFacade(); }
  function cancelWireGhost() { armSrc = null; wireMode = null; ghostTip = null; if (hostApi) hostApi.setState("wireSrc", null); }

  // pointer move on the stage tracks the ghost tip + previews legal targets
  function onStageMove(ev) {
    if (!armSrc) return;
    const c = focusedCase(); if (!c) return;
    // convert client px → world via the front-ortho plane (z=0) as the editor
    // does for its wiring ghost; the stage's own raycast is GL-only, so the
    // headless path uses the same plane math as the front view.
    const world = clientToWorld(ev);
    if (world) moveGhost(world);
  }

  // the front-ortho client→world projection (the wiring ghost's plane)
  function clientToWorld(ev) {
    const host = $(".fe-host"); if (!host) return null;
    const r = host.getBoundingClientRect();
    const S = Math.min(r.width, r.height) / 8;      // deck spans ~8 world units
    const x = (ev.clientX - (r.left + r.width / 2)) / S;
    const y = -((ev.clientY - (r.top + r.height / 2)) / S);
    return { x, y, z: 0 };
  }

  // ── keyboard wiring: W arms, ←→ cycle legal targets, Enter commits ────────
  function outTerminalOfSelection() {
    const selKey = hostApi.state && hostApi.state.selectedKey;
    const m = selKey && /^d(\d+)_op(\d+)$/.exec(selKey);
    if (!m) return null;
    const c = focusedCase(); const idx = +m[2]; const op = c.cmds[idx]; if (!op) return null;
    const outs = Object.keys(op.out || {}); if (!outs.length) return null;
    return { idx, term: outs[0] };
  }
  function startKeyboardWiring() {
    const src = outTerminalOfSelection();
    if (!src) return status("select an op with an output to wire from", "bad");
    const c = focusedCase();
    // enumerate legal input targets across ops + the return bar (I-1/I-2)
    const cands = [];
    c.cmds.forEach((op, i) => Object.keys(op.in || {}).forEach((term) => {
      if (doc.canWire(c, [src.idx, src.term], [i, term]).ok) cands.push({ idx: i, term });
    }));
    Object.keys(c.output || {}).forEach((term) => {
      if (doc.canWire(c, [src.idx, src.term], [-2, term]).ok) cands.push({ idx: -2, term });
    });
    if (!cands.length) return status("no legal target for this output (I-1/I-2)", "bad");
    // reading order (top→bottom, left→right), start on the nearest legal target
    const from = terminalWorld(c, src.idx, "out", src.term);
    const w = (t) => terminalWorld(c, t.idx, "in", t.term) || { x: 0, y: 0, z: 0 };
    cands.sort((a, b) => { const wa = w(a), wb = w(b); return (wb.y - wa.y) || (wa.x - wb.x); });
    let k = 0, best = Infinity;
    cands.forEach((t, i) => { const wt = w(t); const d = Math.hypot(wt.x - from.x, wt.y - from.y, wt.z - from.z); if (d < best) { best = d; k = i; } });
    wireMode = { src, cands, k }; armSrc = null;
    hostApi.setState("wireSrc", src);
    showWireCandidate();
  }
  function showWireCandidate() {
    if (!wireMode) return;
    const c = focusedCase(); const { src, cands, k } = wireMode; const t = cands[k];
    const to = terminalWorld(c, t.idx, "in", t.term); if (to) moveGhost(to);
    status(`wire → ${nameOf(c, t.idx)}.${t.term} · ${k + 1}/${cands.length} · ←→ choose · Enter wires · Esc cancels`, "ok");
  }
  function moveWireCandidate(dir) { if (!wireMode) return; wireMode.k = (wireMode.k + dir + wireMode.cands.length) % wireMode.cands.length; showWireCandidate(); }
  function commitKeyboardWire() {
    if (!wireMode) return;
    const c = focusedCase(); const { src, cands, k } = wireMode; const dest = cands[k];
    const cmd = doc.addWire(c, { src: [src.idx, src.term], dest: [dest.idx, dest.term] });
    cancelWireGhost();
    if (cmd.error) return status("wire refused: " + cmd.error, "bad");
    if (!commitApplied(cmd)) return;
    status(`wired → ${nameOf(c, dest.idx)}.${dest.term} — ⌘Z undoes`, "ok");
    gate(".fe-g-kbd", true, "keyboard wire committed");
  }

  // ── delete: Del unwires the selected wire (frees its input, I-1) ─────────
  function deleteSelectedWire() {
    const c = focusedCase(); if (!c) return;
    if (selWire == null) return status("select a wire first (click it)", "bad");
    const cmd = doc.removeWire(c, selWire);
    selWire = null;
    if (cmd.error) return status(cmd.error, "bad");
    if (!commitApplied(cmd)) return;
    status("unwired — ⌘Z undoes", "ok");
  }

  // ── render: facade + instances + chrome ───────────────────────────────────
  function renderAll() { renderFacade(); renderInstances(); renderChrome(); }

  function renderChrome() {
    const chain = caseChain(focusRoot());
    deckCount = chain.length;
    const tEl = $(".fe-title");
    if (current.t) {
      tEl.replaceChildren(document.createTextNode((current.t.prefix || "") + " "));
      const tn = document.createElement("span"); tn.className = "t"; tn.textContent = current.t.name || "flow";
      tEl.append(tn, ` ${current.t.suffix ?? "(flowlang · 3D)"}`);
    } else tEl.textContent = current.title;
    const crumbs = focusPath.slice(0, -1).map((f, k) => `<span class="fe-crumb" data-k="${k}">${f.title}</span>`).join("");
    $(".fe-crumbs").innerHTML = crumbs;
    ME.querySelectorAll(".fe-crumb").forEach((el) => el.addEventListener("click", () => drillTo(+el.dataset.k)));
    const decks = $(".fe-decks"); decks.innerHTML = "";
    chain.forEach((c, k) => {
      const b = document.createElement("button");
      b.textContent = "case " + (k + 1); b.className = k === activeDeck ? "active" : "";
      b.setAttribute("role", "tab"); b.addEventListener("click", () => setActiveDeck(k));
      decks.appendChild(b);
    });
    status(`${deckCount} deck${deckCount === 1 ? "" : "s"} · ${focusedCase() ? focusedCase().cmds.length : 0} ops · ${source ? "editing on" : "read-only (no source command)"}`);
  }

  function setActiveDeck(k) { activeDeck = k; cancelWireGhost(); selWire = null; if (hostApi) hostApi.setState("selectedKey", null); renderAll(); }
  function drillInto(op) { if (op && op.type === "local" && op.localdata) { focusPath.push({ root: parseFlow(op.localdata).root, title: op.name }); activeDeck = 0; cancelWireGhost(); renderAll(); } }
  function drillTo(k) { focusPath = focusPath.slice(0, k + 1); activeDeck = 0; cancelWireGhost(); renderAll(); }
  function drillBack() { if (focusPath.length > 1) { focusPath.pop(); activeDeck = 0; cancelWireGhost(); renderAll(); } }
  function clearSelection() { if (hostApi) hostApi.setState("selectedKey", null); selWire = null; renderInspector(null); }

  function setProj(mode) {
    projMode = mode;
    $(".fe-proj").setAttribute("aria-pressed", mode === "front" ? "true" : "false");
    $(".fe-proj").textContent = mode === "front" ? "front" : "persp";
    if (stage && stage.setCameraMode) stage.setCameraMode(mode === "front" ? "front" : "persp");
    if (stage && stage.frameAll) stage.frameAll();
  }
  function frameDeck() { if (stage && stage.frameAll) stage.frameAll(); }

  function renderInspector(key) {
    const body = $(".fe-inspect-body"); if (!body) return;
    if (selWire != null) {
      const c = focusedCase(); const w = c.cons[selWire];
      body.innerHTML = w ? `<p><b>wire</b> ${nameOf(c, w.src[0])}.${w.src[1]} → ${nameOf(c, w.dest[0])}.${w.dest[1]}</p>` +
        `<p class="fe-empty"><kbd>Del</kbd> unwires · click a palette op to <b>splice</b> it into this wire</p>` : "";
      return;
    }
    const m = key && /^d(\d+)_op(\d+)$/.exec(key);
    const c = focusedCase();
    if (m && c && c.cmds[+m[2]]) {
      const oi = +m[2]; const op = c.cmds[oi];
      body.innerHTML = `<p><b>${op.name || op.type}</b> <span class="lbl">${op.type}</span></p>` +
        `<p>in: ${Object.keys(op.in || {}).join(", ") || "—"}<br>out: ${Object.keys(op.out || {}).join(", ") || "—"}</p>` +
        `<p><button class="fe-ren">rename</button> <button class="fe-del">delete</button></p>` +
        (op.type === "local" ? `<p class="fe-empty">dblclick to drill in</p>` : `<p class="fe-empty"><kbd>W</kbd> wires from its first output · drag body moves</p>`);
      const ren = body.querySelector(".fe-ren"), del = body.querySelector(".fe-del");
      if (ren) ren.addEventListener("click", () => {
        const nn = window.prompt("rename op", op.name || "");
        if (nn && nn !== op.name) { const cmd = doc.renameOp(c, oi, nn); if (cmd && !cmd.error && commitApplied(cmd)) status("renamed → " + nn, "ok"); }
      });
      if (del) del.addEventListener("click", deleteSelectedOp);
    } else body.innerHTML = `<p class="fe-empty">Select an element. Output sockets start wires.</p>`;
  }

  // ── P3: authoring (create / splice / delete op) ───────────────────────────
  // A free spot for a new op: right of the rightmost op on the active deck,
  // at the top layer — the layout proposals (below) tidy it after.
  function freshPos(c) {
    let maxX = -3; for (const op of c.cmds) maxX = Math.max(maxX, (op.pos && op.pos.x) || 0);
    return { x: maxX + 1.8, y: 1.4, z: 0 };
  }
  function addOpFromPalette(entry, opts = {}) {
    const c = focusedCase(); if (!c) return null;
    const raw = JSON.parse(JSON.stringify(entry.raw));
    raw.pos = freshPos(c);
    // de-dupe the name against the deck
    let nm = raw.name, n = 1; while (c.cmds.some((o) => o.name === nm)) nm = raw.name + (++n);
    raw.name = nm;
    const cmd = doc.addOp(c, raw);
    if (cmd.error) { status("add refused: " + cmd.error, "bad"); return cmd; }
    if (!commitApplied(cmd)) return cmd;
    status(`added ${nm} (${entry.type})`, "ok");
    gate(".fe-g-create", true, `add ${entry.type}`);
    return cmd;
  }
  // splice a fresh palette op into the currently-selected wire (I: it takes the
  // wire's source into its first input, its first output to the wire's dest).
  function spliceIntoSelectedWire(entry) {
    const c = focusedCase(); if (!c || selWire == null) { status("select a wire to splice into", "bad"); return null; }
    const add = doc.addOp(c, (() => { const r = JSON.parse(JSON.stringify(entry.raw)); r.pos = freshPos(c); return r; })());
    if (add.error) { status("add refused: " + add.error, "bad"); return add; }
    const sp = doc.spliceIntoWire(c, selWire, add.index);
    if (sp.error) { try { add.undo(); } catch (e) {} status("splice refused: " + sp.error, "bad"); return sp; }
    // compose the two into ONE undo unit (add + splice revert together)
    if (!commitApplied({ label: sp.label,
      undo: () => { sp.undo(); add.undo(); },
      redo: () => { add.redo(); sp.redo(); } })) return null;
    selWire = null;
    status(sp.label, "ok");
    gate(".fe-g-splice", true, "splice into wire");
    return sp;
  }
  // delete the selected op: FlowDoc.removeOp removes it + every wire touching
  // it AND renumbers the surviving wires' op indices — one undoable mutation.
  function deleteSelectedOp() {
    const key = hostApi.state && hostApi.state.selectedKey;
    const m = key && /^d(\d+)_op(\d+)$/.exec(key);
    const c = focusedCase(); if (!m || !c) return;
    const i = +m[2]; const op = c.cmds[i]; if (!op) return;
    const cmd = doc.removeOp(c, i);
    if (cmd.error) { status("delete refused: " + cmd.error, "bad"); return; }
    if (!commitApplied(cmd)) return;
    clearSelection();
    status(`deleted ${op.name || op.type}`, "ok");
    gate(".fe-g-delop", true, "op removed with its wires");
  }

  // ── P3: layout preview → apply as ONE journaled mutation ─────────────────
  function applyLayoutProposal(which) {
    const c = focusedCase(); if (!c) return;
    const prop = which === "untangle" ? untangle(c) : tidy(c);
    if (!prop || !prop.positions || !prop.positions.length) { status("nothing to lay out", "bad"); return; }
    const cmd = doc.applyLayout(c, prop.positions, prop.label || ("auto-layout: " + which));
    if (cmd.error) { status("layout refused: " + cmd.error, "bad"); return; }
    if (!commitApplied(cmd)) return;
    status(prop.label || ("layout: " + which), "ok");
    gate(".fe-g-layout", true, which);
  }

  // ── P3: save via write_flow_body (base-hash → stale_base → conflict) ──────
  function refreshSaveUi() {
    const b = $(".fe-save"); if (b) { b.disabled = !source || !dirty || saving; b.textContent = !source ? "read-only" : saving ? "saving…" : (dirty ? "save*" : "save"); }
  }
  async function saveFlow() {
    if (!source || !dirty || saving) return;
    saving = true; refreshSaveUi();
    const label = pendingLabels.slice(-8).join("; ") || "flow edit";
    const body = doc.serialize();
    const r = await writeFlowBody(source.lib, source.ctl, source.cmd, body, { base: baseHash, label });
    saving = false;
    if (r && r.status === "ok") { baseHash = r.hash || baseHash; dirty = false; pendingLabels = []; savedBody = JSON.stringify(body); status(`saved · ${r.patch_id || "ok"}`, "ok"); pushJournal("saved"); gate(".fe-g-save", true, "write_flow_body ok"); renderChanges(); refreshJournal(); }
    else if (r && r.msg === "stale_base") { showConflict(); gate(".fe-g-save", true, "stale_base → conflict ui"); }
    else status("save failed: " + (r && r.msg ? r.msg : "no response"), "bad");
    refreshSaveUi();
  }
  function showConflict() {
    const el = $(".fe-conflict"); if (!el) return;
    el.hidden = false;
    el.querySelector(".fe-c-theirs").onclick = async () => {
      const r = await readFlowBody(source.lib, source.ctl, source.cmd);
      if (r && r.status === "ok" && r.exists) {
        loadBody(r.body, r.hash || "");
        el.hidden = true; status("loaded theirs — your edits discarded", "bad"); refreshJournal();
      }
    };
    el.querySelector(".fe-c-mine").onclick = async () => {
      const r = await readFlowBody(source.lib, source.ctl, source.cmd);
      baseHash = (r && r.hash) || "";
      el.hidden = true;
      const body = doc.serialize();
      const w = await writeFlowBody(source.lib, source.ctl, source.cmd, body, { base: baseHash, label: "overwrite (conflict: keep mine)" });
      if (w && w.status === "ok") { baseHash = w.hash || baseHash; dirty = false; pendingLabels = []; savedBody = JSON.stringify(body); status("saved mine over theirs", "ok"); pushJournal("saved (overwrite)"); renderChanges(); refreshJournal(); }
      refreshSaveUi();
    };
    el.querySelector(".fe-c-cancel").onclick = () => { el.hidden = true; };
  }

  // ── init ──────────────────────────────────────────────────────────────────
  // ── P4: run tokens — deliveries ride a flowtoken BEHAVIOR on the host ─────
  // The schedule is local and pure (design §3.5 — the platform returns only
  // the result): flowdoc.propagationRounds gives the focused case's firing
  // order. One dev:flowtoken instance per wire is addControl'd into the
  // scenehost, seeded with its round; ONE shared clock (host.state.run.t0)
  // starts them together, so the token behaviors deliver round by round and
  // report via host.state.onTokenDelivered. The editor schedules and audits;
  // the motion is the behavior's.
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  function wireEnd(c, end, which) {
    return terminalWorld(c, end[0], which, end[1]) || terminalWorld(c, end[0], which === "out" ? "in" : "out", end[1]) || null;
  }
  async function runFlow() {
    if (running || !hostApi) return null;
    const c = focusedCase(); if (!c) return null;
    const { rounds, unreached } = propagationRounds(c);
    if (!rounds.length) { status("nothing to run — no wire can fire", "bad"); return null; }
    if (armSrc || wireMode) { cancelWireGhost(); renderFacade(); }
    running = true;
    const runBtn = $(".fe-run"); if (runBtn) { runBtn.disabled = true; runBtn.classList.add("running"); runBtn.textContent = "running…"; }
    const runId = ++runSeq;
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduced ? 0.34 : 0.42;
    const expected = rounds.reduce((n, r) => n + r.length, 0);
    const delivered = [], keys = [];
    let finish; const allDone = new Promise((res) => { finish = res; });
    hostApi.setState("run", { id: runId, t0: null });
    hostApi.setState("onTokenDelivered", (ev) => {
      if (!ev || ev.runId !== runId) return;
      delivered.push({ k: ev.k, round: ev.round });
      if (delivered.length >= expected) finish(true);
    });
    const started = performance.now();
    try {
      for (let r = 0; r < rounds.length; r++) {
        for (const k of rounds[r]) {
          const w = c.cons[k]; if (!w) continue;
          const key = `run${runId}_w${k}`;
          await hostApi.addControl("dev", "flowtoken", {
            runId, k, round: r, dur, reduced,
            wire: "fx_" + slug(`d${activeDeck}/wire/${k}`),
            from: wireEnd(c, w.src, "out"), to: wireEnd(c, w.dest, "in"),
          }, key);
          keys.push(key);
        }
      }
      // every token is booted — start the ONE clock they all ride
      hostApi.setState("run", { id: runId, t0: performance.now() });
      const budget = (rounds.length * dur + 3) * 1000;
      const complete = await Promise.race([allDone, new Promise((res) => setTimeout(() => res(false), budget))]);
      lastRun = auditRun(runId, rounds, unreached, delivered, !!complete, Math.round(performance.now() - started));
    } catch (e) {
      lastRun = { runId, error: String(e && e.message ? e.message : e), rounds, unreached, delivered: delivered.slice(), order: delivered.map((d) => d.k), complete: false, inOrder: false, ms: null };
    } finally {
      for (const key of keys) { try { hostApi.removeControl(key); } catch (e) {} }
      hostApi.setState("run", null);
      hostApi.setState("onTokenDelivered", null);
      running = false;
      if (runBtn) { runBtn.disabled = false; runBtn.classList.remove("running"); runBtn.textContent = "run ▸"; }
    }
    const R = lastRun;
    R.tokensHosted = keys.length;
    pushJournal(`run · ${R.delivered.length}/${expected} deliveries · ${rounds.length} round${rounds.length === 1 ? "" : "s"}` + (unreached.length ? ` · ${unreached.length} unreached` : ""));
    if (R.complete && R.inOrder) status(`ran · ${expected} deliveries in ${rounds.length} rounds · ${R.ms}ms`, "ok");
    else status(R.error ? "run failed: " + R.error : `run incomplete · ${R.delivered.length}/${expected} delivered`, "bad");
    gate(".fe-g-run", !!(R.complete && R.inOrder), R.complete ? `${expected} deliveries, ${rounds.length} rounds, in order` : "incomplete");
    renderRunInspector(R);
    return R;
  }
  // audit: every scheduled wire delivered exactly once, in its own round,
  // rounds non-decreasing in delivery order
  function auditRun(runId, rounds, unreached, delivered, complete, ms) {
    const order = delivered.map((d) => d.k);
    const want = [].concat(...rounds);
    const once = order.length === want.length && new Set(order).size === order.length && want.every((k) => order.includes(k));
    const monotone = delivered.every((d, i) => i === 0 || d.round >= delivered[i - 1].round);
    const ownRound = delivered.every((d) => rounds[d.round] && rounds[d.round].includes(d.k));
    return { runId, rounds, unreached, delivered, order, complete, inOrder: once && monotone && ownRound, ms };
  }
  function runRoundsHtml(R) {
    const c = focusedCase();
    const wl = (k) => { const w = c && c.cons[k]; return esc(w ? `${nameOf(c, w.src[0])}.${w.src[1]} → ${nameOf(c, w.dest[0])}.${w.dest[1]}` : `wire ${k}`); };
    let h = `<p><b>run</b> <span class="lbl">${R.complete && R.inOrder ? "delivered in propagation order" : "incomplete"}${R.ms != null ? ` · ${R.ms}ms` : ""}</span></p><ul class="fe-run-list">`;
    R.rounds.forEach((round, r) => { h += `<li><span class="rd">${r + 1}</span>${round.map(wl).join(" · ")}</li>`; });
    h += `</ul>`;
    if (R.unreached.length) h += `<p class="fe-empty">never fires (I-1/I-2): ${R.unreached.map(wl).join(" · ")}</p>`;
    return h;
  }
  function renderRunInspector(R) {
    const body = $(".fe-inspect-body"); if (!body || !R) return;
    body.innerHTML = runRoundsHtml(R);
  }

  // ── P5 run parity: a LIVE editor runs the REAL command ───────────────────
  // Ported from floweditor3d's openRunPicker/doRun/inspectRunResult. When the
  // editor has a source (and is not the harness), the run button or R key
  // opens an args form over the params bar (doc.root.input, coerced by bar
  // type; no params means run at once). invoke runs the SAVED command
  // CONCURRENTLY with the flowtoken run: the animation never blocks or fails
  // the result. The payload (status/pid stripped) goes to the inspector with
  // an args sentence. Tokens animate only on the root case's first deck,
  // because that is where the server starts. The harness keeps the
  // token-only run.
  let lastResult = null, liveCall = false;
  function coerceArg(raw, type) {
    const t = (type || "").toLowerCase();
    if (t === "integer" || t === "int") { const n = parseInt(raw, 10); return isNaN(n) ? raw : n; }
    if (t === "decimal" || t === "float") { const n = parseFloat(raw); return isNaN(n) ? raw : n; }
    if (t === "boolean" || t === "bool") return raw === "true";
    if (t === "object" || t === "array" || t === "jsonobject" || t === "jsonarray") { try { return JSON.parse(raw); } catch (e) { return raw; } }
    return raw;
  }
  function startRun() {
    if (running || liveCall) return null;
    if (harness || !source) return runFlow();
    const params = Object.entries((doc && doc.root && doc.root.input) || {});
    if (!params.length) return runLive({});
    return openRunPicker(params);
  }
  function openRunPicker(params) {
    const body = $(".fe-inspect-body"); if (!body) return runLive({});
    body.innerHTML = `<p><b>run</b> <span class="lbl">arguments — the params bar</span></p>`;
    const form = document.createElement("form"); form.className = "fe-run-args";
    const inputs = [];
    for (const [name, node] of params) {
      const type = node && node.type;
      const row = document.createElement("label"); row.className = "fe-run-arg";
      const lab = document.createElement("span"); lab.textContent = `${name} : ${type || "any"}`;
      const inp = document.createElement("input"); inp.name = name; inp.placeholder = type || "value"; inp.autocomplete = "off";
      inputs.push({ name, inp, type });
      row.append(lab, inp); form.appendChild(row);
    }
    const foot = document.createElement("div"); foot.className = "fe-run-foot";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "fe-run-cancel"; cancel.textContent = "cancel";
    const go = document.createElement("button"); go.type = "submit"; go.className = "fe-run-go"; go.textContent = "run ▸";
    foot.append(cancel, go); form.appendChild(foot);
    const close = () => { renderInspector(hostApi && hostApi.state ? hostApi.state.selectedKey : null); if (ME.tabIndex >= 0) ME.focus(); status("run cancelled"); };
    cancel.addEventListener("click", close);
    form.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const args = {};
      for (const { name, inp, type } of inputs) args[name] = coerceArg(inp.value, type);
      runLive(args);
    });
    body.appendChild(form);
    const first = form.querySelector("input"); if (first) first.focus();
    status("run — fill in the params bar");
    return form;
  }
  async function runLive(args) {
    if (running || liveCall || !source) return null;
    liveCall = true;
    const src = { lib: source.lib, ctl: source.ctl, cmd: source.cmd };
    const unsaved = dirty ? Math.max(1, ((renderChanges() || {}).changes || []).length) : 0;
    const runBtn = $(".fe-run");
    const busy = () => { if (runBtn) { runBtn.disabled = true; runBtn.classList.add("running"); runBtn.textContent = "running…"; } };
    busy();
    status(`running ${src.cmd}…`);
    const started = performance.now();
    const resP = invokeP(src.lib, src.ctl, src.cmd, args)
      .then((r) => r || { status: "err", msg: "no response" }, (e) => ({ status: "err", msg: String(e && e.message ? e.message : e) }));
    let R = null;
    // animate while the call flies (never block or fail the result on it)
    if (focusPath.length === 1 && activeDeck === 0) {
      try { R = await runFlow(); } catch (e) { R = null; }
      busy();   // runFlow restores the button; the call may still be in flight
    }
    const r = await resP;
    const ms = Math.round(performance.now() - started);
    liveCall = false;
    if (runBtn) { runBtn.disabled = false; runBtn.classList.remove("running"); runBtn.textContent = "run ▸"; }
    const ok = r.status === "ok";
    lastResult = { args, ok, result: r, ms, unsaved, source: src,
      tokens: R ? { complete: !!R.complete, inOrder: !!R.inOrder, delivered: R.delivered.length } : null };
    pushJournal(ok ? `ran ${src.cmd} · ${ms}ms` : `run failed: ${r.msg}`);
    if (ok) status(`ran · ${ms}ms` + (R && R.complete && R.inOrder ? ` · ${R.delivered.length} deliveries in order` : ""), "ok");
    else status(`run failed: ${r.msg}`, "bad");
    renderRunResult(lastResult, R);
    return lastResult;
  }
  function renderRunResult(L, R) {
    const body = $(".fe-inspect-body"); if (!body || !L) return;
    const r = L.result || {};
    const payload = Object.assign({}, r); delete payload.status; delete payload.pid;
    const shown = L.ok ? ("data" in payload && Object.keys(payload).length === 1 ? payload.data : payload) : (r.msg != null ? r.msg : payload);
    let h = `<p><b>run result</b> <span class="lbl">${L.ok ? "ok" : "failed"} · ${L.ms}ms</span></p>`;
    h += `<pre class="fe-run-pre${L.ok ? "" : " bad"}">${esc(typeof shown === "string" ? shown : JSON.stringify(shown, null, 1))}</pre>`;
    h += `<p class="fe-run-note">args: ${esc(JSON.stringify(L.args))} — the tokens replay the propagation ORDER; per-wire values aren't reported by the platform.</p>`;
    if (L.unsaved) h += `<p class="fe-empty">ran the SAVED body — ${L.unsaved} unsaved change${L.unsaved === 1 ? "" : "s"} not included; save to run them</p>`;
    if (R && R.rounds) h += runRoundsHtml(R);
    body.innerHTML = h;
  }

  // ── P4: the in-editor journal + diff ─────────────────────────────────────
  // Two views, both speaking the GRAPH's vocabulary via flowdoc.diffFlow:
  //   unsaved changes — diffFlow(last loaded/saved body, the working body),
  //                     refreshed on every mutation;
  //   server journal  — the control's _patches flow entries for this command
  //                     (write_flow_body history), each expandable to its
  //                     structural diff, revertible as a NEW journaled write.
  const DIFF_GLYPH = { "op+": "+", "op-": "−", "op~": "~", "wire+": "⌁", "wire-": "⌁", sig: "▤", "deck+": "▤", "deck-": "▤" };
  const DIFF_CLASS = { "op+": "add", "op-": "del", "op~": "mod", "wire+": "add", "wire-": "del", sig: "mod", "deck+": "add", "deck-": "del" };
  const noteEl = (t, tag) => { const el = document.createElement(tag || "p"); el.className = tag === "li" ? "fe-empty" : "jl-note"; el.textContent = t; return el; };
  function changeItems(changes, max) {
    const multi = changes.some((x) => x.deck !== changes[0].deck);
    const out = changes.slice(0, max).map((ch) => {
      const li = document.createElement("li"); li.className = "jl-ch jl-" + (DIFF_CLASS[ch.kind] || "mod");
      const g = document.createElement("span"); g.className = "jl-g"; g.textContent = DIFF_GLYPH[ch.kind] || "·";
      const t = document.createElement("span"); t.textContent = (multi ? `case ${ch.deck + 1}: ` : "") + ch.text;
      li.append(g, t); return li;
    });
    if (changes.length > max) out.push(noteEl(`…and ${changes.length - max} more`, "li"));
    return out;
  }
  let lastChanges = null;
  function renderChanges() {
    const ul = $(".fe-changes-list"), cnt = $(".fe-changes-count");
    if (!ul || savedBody == null || !doc) return null;
    let d; try { d = diffFlow(savedBody, snap()); } catch (e) { if (cnt) cnt.textContent = "diff failed"; return null; }
    lastChanges = d;
    if (cnt) cnt.textContent = d.changes.length ? `+${d.counts.added} −${d.counts.removed} ~${d.counts.changed}` : "none";
    ul.replaceChildren(...(d.changes.length ? changeItems(d.changes, 14) : [noteEl("no structural change", "li")]));
    if (d.changes.length) gate(".fe-g-diff", true, `${d.changes.length} change${d.changes.length === 1 ? "" : "s"} vs saved`);
    return d;
  }

  async function refreshJournal() {
    const ul = $(".fe-sjournal-list"); if (!ul) return [];
    if (!source) { ul.replaceChildren(noteEl("read-only view — no source command, no journal", "li")); journalRows = []; return []; }
    const r = await listPatches(source.lib, source.ctl, 40);
    if (!r || r.status !== "ok") { ul.replaceChildren(noteEl("journal unavailable: " + ((r && r.msg) || "no response"), "li")); journalRows = []; return []; }
    journalRows = (r.patches || []).filter((p) => p.facet === "flow" && p.cmd === source.cmd).slice(0, 12);
    ul.replaceChildren();
    if (!journalRows.length) { ul.appendChild(noteEl("no saved history yet", "li")); return journalRows; }
    journalRows.forEach((p, i) => {
      const li = document.createElement("li"); li.dataset.ji = String(i);
      const row = document.createElement("div"); row.className = "jl-row";
      // the label is the disclosure: an entry's real content is WHAT CHANGED
      const label = document.createElement("button"); label.className = "jl-label";
      label.setAttribute("aria-expanded", "false");
      label.innerHTML = `<span class="jl-caret" aria-hidden="true">▸</span> <span>${esc(p.label || p.patch_id || "—")}</span>`;
      const author = document.createElement("span"); author.className = "jl-author"; author.textContent = p.author || "";
      row.append(label, author);
      if (p.old) { // no `old` = the creation entry — nothing to revert to
        const rv = document.createElement("button"); rv.className = "jl-revert"; rv.textContent = "revert";
        rv.title = "write this entry's before-state as a NEW journaled patch";
        rv.addEventListener("click", () => revertTo(p));
        row.appendChild(rv);
      }
      const box = document.createElement("div"); box.className = "jl-diff"; box.hidden = true;
      li.append(row, box);
      label.addEventListener("click", () => toggleJournalDiff(i));
      ul.appendChild(li);
    });
    return journalRows;
  }
  function toggleJournalDiff(i) {
    const ul = $(".fe-sjournal-list"); const li = ul && ul.querySelector(`li[data-ji="${i}"]`); const p = journalRows[i];
    if (!li || !p) return null;
    const label = li.querySelector(".jl-label"), box = li.querySelector(".jl-diff");
    const open = label.getAttribute("aria-expanded") === "true";
    // accordion: one entry open at a time
    for (const other of ul.querySelectorAll(".jl-label[aria-expanded='true']")) {
      other.setAttribute("aria-expanded", "false");
      other.querySelector(".jl-caret").textContent = "▸";
      other.closest("li").querySelector(".jl-diff").hidden = true;
    }
    if (open) return null;
    label.setAttribute("aria-expanded", "true");
    label.querySelector(".jl-caret").textContent = "▾";
    box.hidden = false;
    if (!box.dataset.built) { box.dataset.built = "1"; box.replaceChildren(...renderEntryDiff(p)); }
    gate(".fe-g-journal", true, `${journalRows.length} entr${journalRows.length === 1 ? "y" : "ies"}, diff shown`);
    return box.textContent;
  }
  function renderEntryDiff(p) {
    if (!p.new) return [noteEl("this entry recorded no body")];
    if (!p.old) {
      const c = parseFlow(p.new).root;
      return [noteEl(`created · ${c.cmds.length} op${c.cmds.length === 1 ? "" : "s"}, ${c.cons.length} wire${c.cons.length === 1 ? "" : "s"}`)];
    }
    const { changes, counts } = diffFlow(p.old, p.new);
    if (!changes.length) return [noteEl("no structural change (formatting or identical bodies)")];
    const ul = document.createElement("ul"); ul.className = "jl-diff-list";
    ul.append(...changeItems(changes, 12));
    return [noteEl(`+${counts.added} −${counts.removed} ~${counts.changed}`), ul];
  }
  // (re)load a body as the authoritative doc — the diff baseline moves with it
  function loadBody(body, hash) {
    doc = parseFlow(body); baseHash = hash || "";
    focusPath = [{ root: doc.root, title: "case 1" }]; activeDeck = 0;
    undoStack = []; redoStack = []; pendingLabels = []; dirty = false;
    $(".fe-undo").disabled = true;
    savedBody = snap();
    renderAll(); refreshSaveUi(); renderChanges();
  }
  async function revertTo(p) {
    if (!source || running || saving) return null;
    let body;
    try { body = typeof p.old === "string" ? JSON.parse(p.old) : p.old; }
    catch (e) { status("journal entry has no readable body", "bad"); return null; }
    const cur = await readFlowBody(source.lib, source.ctl, source.cmd);
    const w = await writeFlowBody(source.lib, source.ctl, source.cmd, body,
      { base: cur && cur.status === "ok" ? (cur.hash || "") : "", label: `revert: ${p.label || p.patch_id}` });
    if (!w || w.status !== "ok") { status(`revert failed: ${(w && w.msg) || "no response"}`, "bad"); return w; }
    loadBody(body, w.hash);
    pushJournal(`reverted to before ${p.patch_id}`);
    status("reverted — as a new journal entry", "ok");
    await refreshJournal();
    return w;
  }

  function init() {
    const hostEl = $(".fe-host");
    if (!hostEl || !hostEl.api) { status("scenehost not mounted", "bad"); return null; }
    return new Promise((res) => hostEl.api.waitReady(() => res(hostEl.api))).then(async (scenehost) => {
      hostApi = scenehost; stage = scenehost.stage;
      if (!hostApi || !hostApi.addControl) { gate(".fe-g-host", false, "no addControl"); return null; }
      gate(".fe-g-host", true, scenehost.headless ? "headless (no WebGL)" : "webgl");

      let initial = SPECIMEN;
      if (PROPS.graph) {
        try { initial = typeof PROPS.graph === "string" ? JSON.parse(PROPS.graph) : PROPS.graph; }
        catch (e) { status("graph prop unreadable: " + e.message, "bad"); }
      }
      doc = parseFlow(initial);
      focusPath = [{ root: doc.root, title: "case 1" }];
      current = PROPS.title ? { t: PROPS.title, title: PROPS.title.name || "flow" } : { title: harness ? "specimen" : "flow" };
      savedBody = snap();             // the diff baseline: the body as loaded
      if (!harness) { const gl = $(".fe-gate"); if (gl) gl.hidden = true; ME.classList.add("fe-live"); }

      // wire the flownode behavior hooks into the editor (shared host state)
      hostApi.setState("onPortTap", onPortTap);
      hostApi.setState("onOpDrag", (opIndex, evt) => {
        // drag an op body to move it (front-ortho plane, z kept). Undoable.
        const c = focusedCase(); const op = c && c.cmds[opIndex]; if (!op) return;
        const w = evt && evt.world ? evt.world : (evt && evt.clientX !== undefined ? clientToWorld(evt) : null);
        if (!w) return;
        const to = { x: Math.round(w.x * 2) / 2, y: Math.round(w.y * 2) / 2, z: op.pos.z };
        const cmd = doc.moveOp(c, opIndex, to);
        if (cmd && !cmd.error) commitApplied(cmd);
      });

      renderAll();

      // the body re-read from dev.code is AUTHORITATIVE (floweditor3d's
      // enableEditing): it replaces the graph prop and sets baseHash, so the
      // first save is base-guarded (stale_base → conflict). Unreadable ⇒ the
      // view drops to read-only rather than save over an unknown body.
      if (!harness && source) {
        const rb = await readFlowBody(source.lib, source.ctl, source.cmd);
        if (rb && rb.status === "ok" && rb.exists && rb.body) loadBody(rb.body, rb.hash || "");
        else { const why = (rb && rb.msg) || (rb && rb.exists === false ? "no body yet" : "no response"); source = null; renderAll(); refreshSaveUi(); status("flow body did not read back (" + why + ") — read-only", "bad"); }
      }

      // selection / wire-pick inspector
      hostApi.setState && (function poll() {
        const sk = hostApi.state.selectedKey;
        renderInspector(sk);
      })();
      hostEl.addEventListener("click", () => renderInspector(hostApi.state.selectedKey));

      // stage pointer moves track the wire ghost
      hostEl.addEventListener("pointermove", onStageMove);

      // headless: tap dispatch is programmatic; click a node to select, dblclick drills
      if (scenehost.headless) {
        hostEl.addEventListener("click", () => { if (instances[0] && scenehost.tap) scenehost.tap(`${instances[0].key}:body`); });
        hostEl.addEventListener("dblclick", () => { const c = focusedCase(); if (c && c.cmds[0]) drillInto(c.cmds[0]); });
      } else {
        hostEl.addEventListener("dblclick", () => {
          const sel = hostApi.state && hostApi.state.selectedKey;
          const m = sel && /^d(\d+)_op(\d+)$/.exec(sel);
          const c = focusedCase();
          if (m && c) drillInto(c.cmds[+m[2]]);
        });
      }

      // toolbar + keys
      $(".fe-proj").addEventListener("click", () => setProj(projMode === "front" ? "persp" : "front"));
      $(".fe-frame").addEventListener("click", frameDeck);
      $(".fe-back").addEventListener("click", () => { if (focusPath.length > 1) drillBack(); else if (typeof PROPS.onBack === "function") PROPS.onBack(); });
      $(".fe-undo").addEventListener("click", undo);
      const redoBtn = $(".fe-redo"); if (redoBtn) redoBtn.addEventListener("click", redo);
      const saveBtn = $(".fe-save"); if (saveBtn) saveBtn.addEventListener("click", saveFlow);
      const tidyBtn = $(".fe-tidy"); if (tidyBtn) tidyBtn.addEventListener("click", () => applyLayoutProposal("tidy"));
      const untBtn = $(".fe-untangle"); if (untBtn) untBtn.addEventListener("click", () => applyLayoutProposal("untangle"));
      // palette: click = add op; with a wire selected = splice into that wire
      ME.querySelectorAll(".fe-pal-item").forEach((el) => {
        el.addEventListener("click", () => {
          const entry = PALETTE[+el.dataset.pi]; if (!entry) return;
          if (selWire != null) spliceIntoSelectedWire(entry); else addOpFromPalette(entry);
        });
      });
      refreshSaveUi();
      const runB = $(".fe-run"); if (runB) runB.addEventListener("click", () => { startRun(); });
      const sjB = $(".fe-sj-refresh"); if (sjB) sjB.addEventListener("click", () => { refreshJournal(); });
      renderChanges();
      refreshJournal();
      ME.addEventListener("keydown", (e) => {
        // a form field (run args, popovers) owns its keys: never let typing
        // "r"/Backspace/arrows fire editor shortcuts
        const tg = e.target;
        if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName || ""))) return;
        if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
        // wire mode owns arrows/Enter/Esc while it is up
        if (wireMode) {
          if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") { e.preventDefault(); moveWireCandidate(1); return; }
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveWireCandidate(-1); return; }
          if (e.key === "Enter") { e.preventDefault(); commitKeyboardWire(); return; }
          if (e.key === "Escape") { e.preventDefault(); cancelWireGhost(); renderFacade(); status("wiring cancelled"); return; }
        }
        if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); startRun(); return; }
        if (e.key === "2") setProj("front");
        else if (e.key === "3") setProj("persp");
        else if (e.key === "a" || e.key === "A") frameDeck();
        else if (e.key === "[") setActiveDeck((activeDeck - 1 + deckCount) % deckCount);
        else if (e.key === "]") setActiveDeck((activeDeck + 1) % deckCount);
        else if (e.key === "w" || e.key === "W") { e.preventDefault(); startKeyboardWiring(); }
        else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelectedWire(); }
        else if (e.key === "Escape") {
          const hasSel = (hostApi && hostApi.state && hostApi.state.selectedKey) || selWire != null;
          if (armSrc) { cancelWireGhost(); renderFacade(); status("wiring cancelled"); }
          else if (focusPath.length > 1) drillBack();
          else if (hasSel || harness || typeof PROPS.onBack !== "function") clearSelection();
          else PROPS.onBack();
        }
      });

      // expose a tiny api for the gate + future phases
      return {
        dispose() { cancelWireGhost(); },
        // test/gate surface (headless drives these)
        onPortTap, startKeyboardWiring, moveWireCandidate, commitKeyboardWire,
        armWire, undo, doc: () => doc, focusedCase, canWire: (s, d2) => doc.canWire(focusedCase(), s, d2),
        addWire: (s, d2) => { const cmd = doc.addWire(focusedCase(), { src: s, dest: d2 }); if (!cmd.error) commitApplied(cmd); return cmd; },
        removeWire: (i) => { const cmd = doc.removeWire(focusedCase(), i); if (!cmd.error) commitApplied(cmd); return cmd; },
        cons: () => focusedCase().cons.length,
        // P3 surface
        redo, addOpFromPalette: (i) => addOpFromPalette(PALETTE[i] || PALETTE[0]),
        spliceIntoSelectedWire: (i) => spliceIntoSelectedWire(PALETTE[i] || PALETTE[0]),
        deleteSelectedOp, applyLayoutProposal, saveFlow, PALETTE,
        selectWire: (i) => { selWire = i; renderInspector(null); },
        selectedOp: () => { const k = hostApi.state && hostApi.state.selectedKey; const m = k && /^d(\d+)_op(\d+)$/.exec(k); return m ? +m[2] : null; },
        dirty: () => dirty, serialize: () => doc.serialize(),
        // P5 surface (cutover: the floweditor3d props contract)
        source: () => source, baseHash: () => baseHash, harness: () => harness, titleText: () => $(".fe-title").textContent,
        // P4 surface
        runFlow, lastRun: () => lastRun, running: () => running,
        // P5 run parity surface
        startRun, runLive, lastResult: () => lastResult, liveCall: () => liveCall, coerceArg,
        rounds: () => propagationRounds(focusedCase()),
        changes: () => renderChanges(), refreshJournal, journalRows: () => journalRows,
        toggleJournalDiff, revertTo: (i) => journalRows[i] ? revertTo(journalRows[i]) : null,
        tokens: () => hostApi.children.filter((ch) => ch.ctl === "flowtoken").length,
      };
    }).catch((e) => { status("boot failed: " + (e && e.message ? e.message : e), "bad"); return null; });
  }

  return init();
}).catch(function (e) {
  console.log("flowedit3d failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };