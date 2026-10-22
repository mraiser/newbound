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
  // P5 palette parity: the real primitive catalog + the command picker's reads
  // (same idiom as floweditor3d: app/read for records, app/libs for libraries)
  const { PRIMS, FAMILIES, signature } = document.querySelector('[data-control="dev:flowprims"]').api;
  const jsonP = (c2, v2) => new Promise((res2) => json(c2, v2, res2));
  const readRec = async (l2, id2) => {
    const r2 = await jsonP("../app/read", "lib=" + encodeURIComponent(l2) + "&id=" + encodeURIComponent(id2));
    return r2 && r2.status === "ok" ? r2.data : new Error((r2 && r2.msg) || "read failed");
  };
  const controlsOf = async (l2) => { const d2 = await readRec(l2, "controls"); return d2 instanceof Error ? d2 : ((d2 && d2.list) || []); };
  const libsOf = async () => { const r2 = await jsonP("../app/libs", null); return r2 && r2.status === "ok" ? (r2.data || []) : new Error((r2 && r2.msg) || "libs failed"); };
  // read_command is FLAT (params/type at the top level); accept a data-wrapped
  // reply too so a transport that wraps it still yields the signature
  const readCommand = async (l2, c2, m2) => {
    const r2 = await codeCmd("read_command", { lib: l2, ctl: c2, cmd: m2 });
    if (!r2 || r2.status !== "ok") return r2 || { status: "err" };
    const d2 = (r2.data && typeof r2.data === "object" && !Array.isArray(r2.data)) ? r2.data : r2;
    return { ...d2, status: "ok" };
  };

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
  let disposed = false;           // P5 cutover: dev.frame tears the editor down on navigation
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
  // P5 palette parity: floweditor3d's node kinds (its .fx-pal-item data-kind
  // set). primitive / command open a picker — the op's terminals come from the
  // chosen signature; the rest create at once with floweditor3d's op shapes.
  // (params/return bar editing is the terminal-popover work, not a palette kind.)
  const PALETTE = [
    { kind: "primitive",  label: "primitive",          glyph: "⚙" },
    { kind: "command",    label: "command call",       glyph: "▤" },
    { kind: "local",      label: "local sub-flow",     glyph: "▣" },
    { kind: "constant",   label: "constant / matcher", glyph: "◇" },
    { kind: "persistent", label: "persistent slot",    glyph: "⛃" },
    { kind: "undefined",  label: "blank (undefined)",  glyph: "▢" },
  ];
  const SOCKET_POOL = 8;                  // flownode's in0..7 / out0..7 sockets
  const node0 = () => ({ mode: "", type: "", x: 0 });
  const spread = (names, width) => {
    const n = names.length, gap = n > 1 ? Math.min(0.6, (width - 0.5) / (n - 1)) : 0;
    return Object.fromEntries(names.map((nm, i) => [nm, { mode: "", type: "", x: (i - (n - 1) / 2) * gap }]));
  };
  function opOfKind(kind) {
    if (kind === "constant")   return { name: "", type: "constant", ctype: "string", width: 1.5, in: {}, out: { a: node0() } };
    if (kind === "persistent") return { name: "slot", type: "persistent", width: 1.4, in: {}, out: { a: node0() } };
    if (kind === "local")      return { name: "local", type: "local", width: 2.2, in: { a: node0() }, out: { a: node0() },
                                        localdata: { input: { a: node0() }, output: { a: node0() }, cmds: [], cons: [] } };
    if (kind === "undefined")  return { name: "", type: "undefined", width: 1.5, in: {}, out: {} };
    return null;
  }
  function primOp(prim) {
    const width = Math.max(1.75, prim.name.length * 0.14 + 0.7);
    return { name: prim.name, type: "primitive", width, in: spread(prim.ins, width), out: spread(prim.outs, width) };
  }

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
    // the save label names what the save CHANGES: an undone unsaved edit drops
    // out; undoing already-saved work is itself the change ("undo X")
    { const lb = cmd.label || "edit", li = pendingLabels.lastIndexOf(lb); if (li >= 0) pendingLabels.splice(li, 1); else pendingLabels.push("undo " + lb); }
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
    { const lb = cmd.label || "edit", li = pendingLabels.lastIndexOf("undo " + lb); if (li >= 0) pendingLabels.splice(li, 1); else pendingLabels.push(lb); }
    $(".fe-undo").disabled = false;
    pushJournal("redo " + (cmd.label || ""));
    afterMutation();
  }
  function afterMutation() { reconcileFocus(); cancelWireGhost(); renderAll(); refreshSaveUi(); renderChanges(); refreshInspector(); }

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
    // re-attach the ghost specs if a wire is armed (they ride the facade scene).
    // setScene is a WHOLE-scene replace on the real GL stage: it would destroy
    // every spec the scenehost owns (the flownode instances, host links, run
    // tokens) along with the facade - nothing pickable until renderInstances
    // re-adds them, and never when only the facade re-renders. Carry the
    // host-owned (non-fx_) specs through so the facade replaces only itself.
    // (The headless null stage's setScene is a no-op, which hid this.)
    const hostOwned = stage.objects
      ? [...stage.objects.values()].filter((o) => o && o.spec && !String(o.spec.id).startsWith("fx_")).map((o) => o.spec)
      : [];
    stage.setScene(specs.concat(ghostSpecs(), hostOwned), { lights: "default", grid: true, camera: null });
    styleFacadeLabels();
    return sceneDoc;
  }

  // Prograph look, DOM half: the stage draws text as DOM labels; the facade's
  // op names, literals and control marks sit INSIDE their icons (centred,
  // borderless — css fe-opname/fe-ctlmark) and scale with the zoom so a name
  // keeps to its icon. Classes come from the label's facade meta; the size
  // rides one css variable (--fe-fs) the camera hook keeps current.
  function styleFacadeLabels() {
    if (!stage || !stage.objects) return;          // headless null stage
    for (const o of stage.objects.values()) {
      const m = o && o.label && o.spec && o.spec.meta;
      if (!m) continue;
      if (m.role === "label") {
        o.label.classList.add("fe-opname", "fe-k-" + m.opType);
        if (m.lit) o.label.classList.add("fe-lit");
      } else if (m.role === "flag") o.label.classList.add("fe-ctlmark");
    }
    if (!styleFacadeLabels.hooked && stage.onCameraChange && stage.canvas) {
      styleFacadeLabels.hooked = true;
      const box = stage.canvas.parentElement;      // the .sh-canvas the labels live in
      const fit = () => {
        const o = stage.orbit; if (!o || !box) return;
        // px per world unit at the orbit target (persp fov 40 = the ortho match)
        const u = (stage.canvas.clientHeight || 1) / (2 * Math.max(0.01, o.dist) * Math.tan(20 * Math.PI / 180));
        const fs = u * 0.2;
        box.style.setProperty("--fe-fs", Math.min(16, fs).toFixed(1) + "px");
        box.classList.toggle("fe-far", fs < 6.5);
      };
      stage.onCameraChange(fit);
      fit();
    }
  }

  // ── instances: host each op of the ACTIVE deck as a flownode ─────────────
  // ONE pass at a time. renderAll fires renderInstances without awaiting, and
  // a live mount renders twice back-to-back (graph prop, then the
  // authoritative loadBody) — two overlapping passes each removed only the
  // instances pushed so far and then BOTH addControl'd every op under the same
  // key, so every op was hosted twice (scenehost keeps both; byKey only the
  // last, so the first became unremovable). Calls during a pass coalesce into
  // one more pass that reads the doc as it is by then.
  let renderBusy = null, renderAgain = false;
  function renderInstances() {
    if (renderBusy) { renderAgain = true; return renderBusy; }
    renderBusy = (async () => {
      try { do { renderAgain = false; await renderInstancesOnce(); } while (renderAgain && !disposed); }
      catch (e) { status("render failed: " + (e && e.message ? e.message : e), "bad"); }
      finally { renderBusy = null; }
    })();
    return renderBusy;
  }
  async function renderInstancesOnce() {
    if (disposed) return;          // a late loadBody/mutation after teardown must not re-host
    // flownode.dispose clears host.state.selectedKey when its instance is the
    // selection — right for a real removal, wrong for this re-render. Carry
    // the selection across when that op still exists on the active deck
    // (restored synchronously, before the first await, so the inspector
    // refresh that follows a mutation still sees it).
    const keep = hostApi && hostApi.state ? hostApi.state.selectedKey : null;
    for (const inst of instances) { try { hostApi.removeControl(inst.key); } catch (e) {} }
    instances = [];
    const c = focusedCase(); if (!c) return;
    const km = keep && /^d(\d+)_op(\d+)$/.exec(keep);
    const sameFlow = renderInstances.root === focusRoot(); renderInstances.root = focusRoot();
    if (km && sameFlow && +km[1] === activeDeck && +km[2] < c.cmds.length && hostApi.state.selectedKey !== keep) hostApi.setState("selectedKey", keep);
    for (let i = 0; i < c.cmds.length; i++) {
      const op = c.cmds[i];
      if (!op || renderAgain) break;   // outrun by a mutation: the coalesced next pass redoes it
      const key = `d${activeDeck}_op${i}`;
      const inst = await hostApi.addControl("dev", "flownode", {
        opType: op.type, name: op.name, width: op.width, pos: op.pos, opIndex: i,
        inTerms: Object.keys(op.in || {}), outTerms: Object.keys(op.out || {}), phase: i * 0.7,
        proxy: true,   // the facade draws the Prograph icon; the instance is its pick surface
      }, key);
      if (disposed) { try { hostApi.removeControl(key); } catch (e) {} return; }
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
    for (let k = 0; k < SOCKET_POOL; k++) {
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
  // the ghost touches ONLY its own two specs: upsert while armed, remove when
  // not. (It used to re-render the whole facade - a setScene per pointer move
  // that, on the real GL stage, also destroyed every hosted flownode, so the
  // input you were wiring TO was no longer pickable.)
  function syncGhost() {
    if (!stage) return;
    const g = ghostSpecs();
    if (g.length) { for (const s of g) stage.upsert(s); }
    else { stage.removeObject("fx_ghostwire"); stage.removeObject("fx_ghosttip"); }
  }
  function showGhost(at) { ghostTip = at; syncGhost(); }
  function moveGhost(at) { ghostTip = at; if (armSrc || wireMode) syncGhost(); }
  function cancelWireGhost() { armSrc = null; wireMode = null; ghostTip = null; syncGhost(); if (hostApi) hostApi.setState("wireSrc", null); }

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
    // crumbs: ancestors of the focused level; a drilled level names its op
    // LIVE (f.op.name) so a rename shows at once; text nodes, never raw HTML
    const crumbsEl = $(".fe-crumbs"); crumbsEl.replaceChildren();
    focusPath.slice(0, -1).forEach((f, k) => {
      const sp = document.createElement("span"); sp.className = "fe-crumb"; sp.dataset.k = String(k);
      sp.textContent = f.op ? (f.op.name || "local") : f.title;
      sp.addEventListener("click", () => drillTo(k));
      crumbsEl.append(sp);
    });
    if (focusPath.length > 1) { const cur = focusPath[focusPath.length - 1]; const sp = document.createElement("span"); sp.className = "fe-crumb cur"; sp.textContent = "local: " + ((cur.op && cur.op.name) || cur.title); crumbsEl.append(sp); }
    const decks = $(".fe-decks"); decks.innerHTML = "";
    const editable = !!source;
    chain.forEach((c, k) => {
      const b = document.createElement("button");
      b.textContent = "case " + (k + 1); b.className = k === activeDeck ? "active" : "";
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(k === activeDeck));
      b.addEventListener("click", () => setActiveDeck(k));
      if (editable && k === activeDeck && chain.length > 1) {
        const x = document.createElement("span"); x.className = "x"; x.textContent = "×";
        x.title = "delete this case (splices the chain; I-4 guarded)";
        x.addEventListener("click", (e) => { e.stopPropagation(); removeDeck(k); });
        b.appendChild(x);
      }
      decks.appendChild(b);
    });
    if (editable) {
      const add = document.createElement("button"); add.className = "fe-deck-add"; add.textContent = "+";
      add.title = "add a case — the fall-through program (“next” jumps here)";
      add.addEventListener("click", () => addDeck());
      decks.appendChild(add);
    }
    renderDiagnostics();
    status(`${deckCount} deck${deckCount === 1 ? "" : "s"} · ${focusedCase() ? focusedCase().cmds.length : 0} ops · ${source ? "editing on" : "read-only (no source command)"}`);
  }

  function setActiveDeck(k) { activeDeck = k; cancelWireGhost(); selWire = null; if (hostApi) hostApi.setState("selectedKey", null); renderAll(); }
  // P5 4b DRILL WRITE-BACK: drill IN PLACE. FlowDoc.parse/addOp already
  // normalize op.localdata into the doc tree (normOp → normCase), so the
  // drilled case IS the authoritative sub-case: every mutation made while
  // drilled lands in doc.root's tree, serialize() emits it, save journals it
  // (floweditor3d's drill does the same: stack.push({case: op.localdata})).
  // The previous parseFlow(op.localdata).root built a DETACHED copy whose
  // edits never reached the doc. `op` is kept so the crumb follows renames
  // and reconcileFocus can tell when undo detaches the drilled op.
  function drillInto(op) { if (op && op.type === "local" && op.localdata) { focusPath.push({ root: op.localdata, op, title: op.name }); activeDeck = 0; cancelWireGhost(); renderAll(); } }
  // after undo/redo/delete the drilled op may no longer be in the tree (e.g.
  // undoing the add of the local op you are inside): pop to the deepest level
  // still reachable so the editor never edits a detached case.
  function reconcileFocus() {
    if (!focusPath.length || focusPath[0].root !== doc.root) { focusPath = [{ root: doc.root, title: "case 1" }]; activeDeck = 0; return; }
    for (let k = 1; k < focusPath.length; k++) {
      const f = focusPath[k];
      const live = caseChain(focusPath[k - 1].root).some((c) => c.cmds.includes(f.op)) && f.op.localdata === f.root;
      if (!live) { focusPath = focusPath.slice(0, k); activeDeck = 0; selWire = null; if (hostApi) hostApi.setState("selectedKey", null); status("the drilled sub-flow left the graph — back at " + (k === 1 ? "the root" : focusPath[k - 1].title), "bad"); return; }
    }
    const n = caseChain(focusRoot()).length; if (activeDeck >= n) activeDeck = Math.max(0, n - 1);
  }
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

  // ── P5 step 4c: case chain authoring, diagnostics, walk + frame ──────────
  // The FlowDoc diagnostics path of the focused case, in walkCases' own
  // vocabulary: root "case", deck k appends ".next" k times, a drilled level
  // appends ".cmds[i].local" under the deck holding its op. Computed LIVE from
  // the drilled op's identity (floweditor3d stored it at drill time, so an
  // upstream op delete left its path stale) — null if the op left the tree.
  function focusedPath() {
    let p = "case";
    for (let k = 1; k < focusPath.length; k++) {
      const f = focusPath[k]; let hit = null;
      caseChain(focusPath[k - 1].root).some((c, j) => { const i = c.cmds.indexOf(f.op); if (i >= 0) { hit = { j, i }; return true; } return false; });
      if (!hit) return null;
      p += ".next".repeat(hit.j) + `.cmds[${hit.i}].local`;
    }
    return p + ".next".repeat(activeDeck);
  }
  // the focused case's lints (I-1…I-10 + structural) under the inspector;
  // a row naming an op selects it
  let lastDiags = [];
  function renderDiagnostics() {
    const box = $(".fe-diag"), list = $(".fe-diag-list"); if (!box || !list || !doc) return;
    const path = focusedPath();
    lastDiags = path ? doc.diagnosticsFor(path) : [];
    list.replaceChildren();
    box.hidden = !lastDiags.length;
    for (const d of lastDiags) {
      const li = document.createElement("li"); li.className = d.severity || "info";
      const code = document.createElement("span"); code.className = "code"; code.textContent = d.code;
      const msg = document.createElement("span"); msg.textContent = d.message;
      li.append(code, msg);
      if (d.opIndex != null) { li.classList.add("go"); li.title = "select the op"; li.addEventListener("click", () => selectOp(d.opIndex)); }
      list.appendChild(li);
    }
  }
  // add / delete a case in the FOCUSED chain (FlowDoc.addCase/removeCase, one
  // undo unit each). activeDeck moves BEFORE the commit so afterMutation's one
  // render lands on the right deck (no second racing renderInstances); a
  // refused commit (read-only / mid-run) restores it.
  function addDeck() {
    const prev = activeDeck, root = focusRoot();
    const cmd = doc.addCase(root);
    if (!cmd || cmd.error) return commitEdit(cmd);
    activeDeck = caseChain(root).length - 1; selWire = null; if (hostApi) hostApi.setState("selectedKey", null);
    if (!commitEdit(cmd)) { activeDeck = prev; return false; }
    status(`added case ${activeDeck + 1} — the fall-through program (“next” jumps here) · ⌘Z undoes`, "ok");
    return true;
  }
  function removeDeck(k) {
    const prev = activeDeck, root = focusRoot();
    if (k == null) k = activeDeck;
    const cmd = doc.removeCase(root, k);
    if (!cmd || cmd.error) return commitEdit(cmd);
    activeDeck = Math.max(0, k - 1); selWire = null; if (hostApi) hostApi.setState("selectedKey", null);
    if (!commitEdit(cmd)) { activeDeck = prev; return false; }
    status(`deleted case ${k + 1} — ⌘Z undoes`, "ok");
    return true;
  }
  // Tab walks the focused deck's ops in topological (firing) order
  function topoOrder(c) {
    const N = c.cmds.length, indeg = new Array(N).fill(0), adj = new Map();
    for (const w of c.cons) { const s = w.src[0], d = w.dest[0]; if (s >= 0 && d >= 0) { indeg[d]++; (adj.get(s) || adj.set(s, []).get(s)).push(d); } }
    const q = []; for (let i = 0; i < N; i++) if (!indeg[i]) q.push(i);
    const order = [];
    while (q.length) { const u = q.shift(); order.push(u); for (const v of adj.get(u) || []) if (--indeg[v] === 0) q.push(v); }
    for (let i = 0; i < N; i++) if (!order.includes(i)) order.push(i);
    return order;
  }
  function selectedOpIndex() { const k = hostApi && hostApi.state ? hostApi.state.selectedKey : null; const m = k && /^d(\d+)_op(\d+)$/.exec(k); return m && +m[1] === activeDeck ? +m[2] : null; }
  function selectOp(i) {
    const c = focusedCase(); if (!c || !c.cmds[i] || !hostApi) return null;
    selWire = null; hostApi.setState("selectedKey", `d${activeDeck}_op${i}`);
    refreshInspector();
    return i;
  }
  function walkOps(dir) {
    const c = focusedCase(); if (!c || !c.cmds.length) return null;
    const order = topoOrder(c), pos = order.indexOf(selectedOpIndex());
    const k = pos < 0 ? (dir > 0 ? 0 : order.length - 1) : (pos + dir + order.length) % order.length;
    selectOp(order[k]); frameSelection();
    return order[k];
  }
  // F: fly the orbit to the selected op (scenestage.flyTo keeps dist/angles);
  // nothing selected (or the headless null stage) frames the whole deck
  let lastFrame = null;
  function frameSelection() {
    const c = focusedCase(), i = selectedOpIndex(), op = c && i != null ? c.cmds[i] : null;
    if (!op) { lastFrame = { kind: "deck" }; frameDeck(); return lastFrame; }
    const target = { x: op.pos.x, y: op.pos.y, z: op.pos.z || 0 };
    lastFrame = { kind: "op", opIndex: i, target, flew: !!(stage && stage.flyTo) };
    if (stage && stage.flyTo) stage.flyTo({ target }, 240); else frameDeck();
    return lastFrame;
  }

  // ── P5 step 4: op editor + terminal editor + signature bars ─────────────
  // floweditor3d's edit popovers (§5.5) docked in the inspector. Every control
  // commits ONE FlowDoc mutation through commitApplied (undoable, journaled;
  // read-only / mid-run refusals honored). inspTerm = the terminal being
  // edited {key, idx, which, term}; it applies only to its own selection key
  // (an op key d<k>_op<i>, or bar:params / bar:return for the signature).
  let inspTerm = null;
  const CTYPES_CONST = ["int", "decimal", "boolean", "string", "object", "array"];
  const CTYPES_MATCH = ["int", "decimal", "boolean", "string", "null"];
  function chainHasNext() { return activeDeck < caseChain(focusRoot()).length - 1; }
  function conditionSentence(rule, value) {
    const act = { next: "run the next case", terminate: "end the flow", fail: "fail (a match-failure of the caller)", finish: "end the loop iteration" }[rule] || rule;
    return `when this op’s match = ${value} → ${act}.`;
  }
  const nextTermName = (map) => { for (const ch of "abcdefghijklmnopqrstuvwxyz") if (!(ch in map)) return ch; return `t${Object.keys(map).length}`; };
  function refreshInspector() { renderInspector(hostApi && hostApi.state ? hostApi.state.selectedKey : null); }
  /** Apply one editor mutation; refusals land in the status line. */
  function commitEdit(cmd) {
    if (!cmd || cmd.error) { status("✗ " + ((cmd && cmd.error) || "no change"), "bad"); refreshInspector(); return false; }
    if (!commitApplied(cmd)) { refreshInspector(); return false; }
    status((cmd.label || "edited") + " — ⌘Z undoes", "ok");
    return true;
  }
  function edRow(parent, label, control) {
    const row = document.createElement("label"); row.className = "fe-ed-row";
    const sp = document.createElement("span"); sp.textContent = label;
    row.append(sp, control); parent.appendChild(row); return control;
  }
  function edSelect(options, value) {
    const s = document.createElement("select");
    for (const o of options) { const el = document.createElement("option"); el.value = o; el.textContent = o || "—"; s.appendChild(el); }
    s.value = value ?? options[0]; if (s.selectedIndex < 0) s.value = options[0]; return s;
  }
  function edInput(value, placeholder) {
    const i = document.createElement("input"); i.value = value ?? ""; if (placeholder) i.placeholder = placeholder;
    i.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); i.blur(); }
      else if (e.key === "Escape") { e.preventDefault(); i.value = value ?? ""; i.blur(); }
      // ⌘S must reach the editor's keydown (it blurs this field so the edit
      // commits, then saves); every other key stays the field's own
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) return;
      e.stopPropagation();
    });
    return i;
  }
  function edButton(parent, text, cls, fn) {
    const b = document.createElement("button"); b.className = cls || ""; b.textContent = text;
    b.addEventListener("click", fn); parent.appendChild(b); return b;
  }
  function edNote(parent, text) { const p = document.createElement("p"); p.className = "fe-empty"; p.textContent = text; parent.appendChild(p); return p; }
  function edLbl(parent, text) { const s = document.createElement("span"); s.className = "lbl"; s.textContent = text; parent.appendChild(s); return s; }
  function edBtns(parent) { const d = document.createElement("div"); d.className = "fe-ed-btns"; parent.appendChild(d); return d; }

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
    if (m && c && c.cmds[+m[2]]) renderOpEditor(body, c, +m[2], key);
    else if (c) renderSignatureEditor(body, c);
    else body.innerHTML = `<p class="fe-empty">Select an element. Output sockets start wires.</p>`;
  }

  /** The op popover: literal/slot/name, ctype + matcher toggle, condition,
      terminals (+ in/out, click to edit), drill, delete. */
  function renderOpEditor(body, c, oi, key) {
    const op = c.cmds[oi];
    body.replaceChildren();
    const head = document.createElement("p"); head.className = "fe-ed-head";
    head.innerHTML = `<b>${esc(op.name || op.type)}</b> <span class="lbl">${esc(op.type)} · edit</span>`;
    body.appendChild(head);
    const isConst = op.type === "constant" || op.type === "match";
    const nameLabel = isConst ? "literal" : op.type === "persistent" ? "slot" : "name";
    const nameIn = edRow(body, nameLabel, edInput(op.name, nameLabel)); nameIn.className = "fe-ed-name";
    nameIn.addEventListener("change", () => { if (nameIn.value !== op.name) commitEdit(doc.renameOp(c, oi, nameIn.value)); });
    if (isConst) {
      const ct = edRow(body, "ctype", edSelect(op.type === "match" ? CTYPES_MATCH : CTYPES_CONST, op.ctype)); ct.className = "fe-ed-ctype";
      ct.addEventListener("change", () => commitEdit(doc.setCtype(c, oi, ct.value)));
      edButton(edBtns(body), op.type === "match" ? "→ constant (drop the input)" : "→ matcher (gains input a)", "fe-ed-matcher",
        () => commitEdit(doc.setMatcher(c, oi, op.type !== "match")));
    }
    if (op.type === "command" && op.cmd) edNote(body, "calls " + op.cmd);
    if (op.type !== "constant") {
      const hasNext = chainHasNext();
      const rule = edRow(body, "condition", edSelect(["", "next", "terminate", "fail", "finish"], op.condition ? op.condition.rule : "")); rule.className = "fe-ed-rule";
      const nextOpt = [...rule.options].find((o) => o.value === "next"); if (!hasNext && nextOpt) nextOpt.disabled = true; // I-4: unrepresentable
      const val = edRow(body, "fires when", edSelect(["true", "false"], String(op.condition ? op.condition.value : true))); val.className = "fe-ed-fires";
      const sent = edNote(body, ""); sent.classList.add("fe-ed-sentence");
      const upd = () => { sent.textContent = rule.value ? conditionSentence(rule.value, val.value) : "no condition — evaluates and passes through."; };
      upd();
      const applyCond = () => commitEdit(doc.setCondition(c, oi, rule.value ? { rule: rule.value, value: val.value === "true" } : null, { chainHasNext: hasNext }));
      rule.addEventListener("change", applyCond);
      val.addEventListener("change", () => { if (rule.value) applyCond(); else upd(); });
    }
    edLbl(body, "terminals");
    const tw = document.createElement("div"); tw.className = "fe-ed-terms"; body.appendChild(tw);
    const termBtn = (which, term) => {
      const n = (which === "in" ? op.in : op.out)[term] || {};
      const on = inspTerm && inspTerm.key === key && inspTerm.which === which && inspTerm.term === term;
      const b = edButton(tw, `${which} ${term}${n.mode === "list" || n.mode === "loop" ? " · " + n.mode : ""}`, "fe-ed-term" + (on ? " active" : ""),
        () => { inspTerm = { key, idx: oi, which, term }; refreshInspector(); });
      b.dataset.which = which; b.dataset.term = term;
    };
    for (const t of Object.keys(op.in || {})) termBtn("in", t);
    for (const t of Object.keys(op.out || {})) termBtn("out", t);
    const addRow = edBtns(body);
    edButton(addRow, "+ input", "fe-ed-addin", () => commitEdit(doc.addTerminal(c, oi, "in", nextTermName(op.in || {}))));
    edButton(addRow, "+ output", "fe-ed-addout", () => commitEdit(doc.addTerminal(c, oi, "out", nextTermName(op.out || {}))));
    if (inspTerm && inspTerm.key === key) renderTermEditor(body, c, inspTerm);
    else edNote(body, "click a terminal to rename it, type it, set list/loop mode, or delete it");
    const foot = edBtns(body);
    if (op.type === "local") edButton(foot, "drill ▸ into the sub-flow", "fe-ed-drill", () => drillInto(op));
    const wires = doc.wiresTouching(c, oi);
    edButton(foot, `delete op${wires ? ` · removes ${wires} wire${wires > 1 ? "s" : ""}` : ""}`, "fe-del danger", deleteSelectedOp);
    edNote(body, op.type === "local" ? "dblclick to drill in" : "W wires from its first output · drag body moves · Enter edits");
  }

  /** The terminal popover — op terminals AND bar terminals (the signature). */
  function renderTermEditor(body, c, t) {
    const isBar = t.idx < 0;
    const op = t.idx >= 0 ? c.cmds[t.idx] : null;
    const map = t.idx === -1 ? c.input : t.idx === -2 ? c.output : (op ? (t.which === "in" ? op.in : op.out) : null);
    const node = map && map[t.term];
    if (!node) { inspTerm = null; return; }
    const box = document.createElement("div"); box.className = "fe-ed-term-box"; body.appendChild(box);
    edLbl(box, `terminal · ${isBar ? (t.idx === -1 ? "parameter" : "return") : (t.which === "in" ? "input" : "output")}`);
    const nameIn = edRow(box, "name", edInput(t.term)); nameIn.className = "fe-ed-tname";
    nameIn.addEventListener("change", () => {
      const nn = nameIn.value.trim();
      if (!nn || nn === t.term) { nameIn.value = t.term; return; }
      const was = { ...t };
      inspTerm = { ...t, term: nn };            // the editor follows the rename
      if (!commitEdit(doc.renameTerminal(c, t.idx, t.which, t.term, nn))) { inspTerm = was; refreshInspector(); }
    });
    const typeIn = edRow(box, "type", edInput(node.type, "object · integer · string · …")); typeIn.className = "fe-ed-ttype";
    typeIn.addEventListener("change", () => { const v = typeIn.value.trim(); if (v !== (node.type || "")) commitEdit(doc.setTerminalType(c, t.idx, t.which, t.term, v)); });
    if (!isBar) {
      const mode = edRow(box, "mode", edSelect(["regular", "list", "loop"], node.mode || "regular")); mode.className = "fe-ed-tmode";
      let pair = null;
      if (t.which === "out") {
        const ins = Object.keys(op.in || {});
        pair = edRow(box, "loop ⟲ input", edSelect(ins.length ? ins : [""], node.loop)); pair.className = "fe-ed-tpair";
        pair.disabled = mode.value !== "loop";
      }
      // "regular" persists as the empty-string mode (the from_data default)
      const applyMode = () => {
        if (pair) pair.disabled = mode.value !== "loop";
        commitEdit(doc.setTerminalMode(c, t.idx, t.which, t.term, mode.value === "regular" ? "" : mode.value, pair ? pair.value : undefined));
      };
      mode.addEventListener("change", applyMode);
      if (pair) pair.addEventListener("change", () => { if (mode.value === "loop") applyMode(); });
    } else edNote(box, "the bars are the signature — renaming or retyping this renames the command’s " + (t.idx === -1 ? "parameter" : "return"));
    const row = edBtns(box);
    edButton(row, "delete terminal", "fe-ed-tdel danger", () => {
      const was = inspTerm; inspTerm = null;
      if (!commitEdit(doc.removeTerminal(c, t.idx, t.which, t.term))) { inspTerm = was; refreshInspector(); }
    });
    edButton(row, "done", "fe-ed-tdone", () => { inspTerm = null; refreshInspector(); });
  }

  /** Nothing selected: the focused case's signature — the params and return
      bars (floweditor3d's bar popover + barterm). Params are the bar's
      outputs, returns its inputs (FlowDoc termMap/sideOf convention). */
  function renderSignatureEditor(body, c) {
    body.replaceChildren();
    edNote(body, "Select an element. Output sockets start wires.");
    for (const [idx, label, bar] of [[-1, "params — the signature", "params"], [-2, "return — the signature", "return"]]) {
      const map = (idx === -1 ? c.input : c.output) || {};
      const which = idx === -1 ? "out" : "in";
      const key = "bar:" + bar;
      edLbl(body, label);
      const tw = document.createElement("div"); tw.className = "fe-ed-terms"; tw.dataset.bar = bar; body.appendChild(tw);
      for (const term of Object.keys(map)) {
        const n = map[term] || {};
        const on = inspTerm && inspTerm.key === key && inspTerm.term === term;
        const b = edButton(tw, `${term}${n.type ? " : " + n.type : ""}`, "fe-ed-term" + (on ? " active" : ""),
          () => { inspTerm = { key, idx, which, term }; refreshInspector(); });
        b.dataset.term = term;
      }
      if (!Object.keys(map).length) edNote(tw, "none");
      const row = document.createElement("div"); row.className = "fe-ed-add"; row.dataset.bar = bar; body.appendChild(row);
      const nIn = edInput("", "name"), tIn = edInput("", "type");
      nIn.className = "fe-ed-bname"; tIn.className = "fe-ed-btype";
      row.append(nIn, tIn);
      const addB = edButton(row, "add", "fe-ed-badd", () => {
        const nm = nIn.value.trim(); if (!nm) { nIn.focus(); return; }
        commitEdit(doc.addTerminal(c, idx, which, nm, tIn.value.trim()));
      });
      for (const inp of [nIn, tIn]) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") addB.click(); });
      if (inspTerm && inspTerm.key === key) renderTermEditor(body, c, inspTerm);
    }
    edNote(body, source ? "adding a parameter allocates the next free slot; the save derives the command’s params from this bar"
      : "read-only view — the signature is shown, edits are refused");
  }

  // ── P3: authoring (create / splice / delete op) ───────────────────────────
  // A free spot for a new op: right of the rightmost op on the active deck,
  // at the top layer — the layout proposals (below) tidy it after.
  function freshPos(c) {
    let maxX = -3; for (const op of c.cmds) maxX = Math.max(maxX, (op.pos && op.pos.x) || 0);
    return { x: maxX + 1.8, y: 1.4, z: 0 };
  }
  // P5 palette parity: a palette kind → an op. primitive / command open their
  // picker unless the caller passes the pick (opts.pick = primitive name, or
  // {lib, ctl, cmd} for a command call). With a wire selected the new op is
  // SPLICED into it — floweditor3d's drop-onto-a-wire — as ONE undo unit.
  function addOpFromPalette(entry, opts = {}) {
    const c = focusedCase(); if (!c || !entry) return null;
    const wireIdx = opts.wireIdx !== undefined ? opts.wireIdx : selWire;
    if (entry.kind === "primitive") {
      if (opts.pick == null) { openPrimitivePicker(wireIdx); return null; }
      const prim = PRIMS.find((p) => p.name === opts.pick);
      if (!prim) { status("no primitive named " + opts.pick, "bad"); return null; }
      return createOp(primOp(prim), wireIdx, "primitive");
    }
    if (entry.kind === "command") {
      if (!opts.pick) { openCommandPicker(wireIdx); return null; }
      return createCommandOp(opts.pick, wireIdx);          // async: a Promise
    }
    const raw = opOfKind(entry.kind);
    if (!raw) { status("unknown palette kind " + entry.kind, "bad"); return null; }
    return createOp(raw, wireIdx, entry.kind);
  }
  function spliceIntoSelectedWire(entry, opts = {}) {
    if (selWire == null) { status("select a wire to splice into", "bad"); return null; }
    return addOpFromPalette(entry, { ...opts, wireIdx: selWire });
  }
  // add (and optionally splice) one op; floweditor3d's createOp semantics: a
  // splice the op cannot take (no input / no output) still creates the op and
  // says so. The new op becomes the selection so the inspector can edit it.
  function createOp(rawOp, wireIdx, kind) {
    const c = focusedCase(); if (!c) return null;
    const raw = JSON.parse(JSON.stringify(rawOp));
    if (!raw.pos) raw.pos = freshPos(c);
    const add = doc.addOp(c, raw);
    if (add.error) { status("add refused: " + add.error, "bad"); return add; }
    let unit = add, spliced = false, why = "";
    if (wireIdx != null && c.cons[wireIdx]) {
      const sp = doc.spliceIntoWire(c, wireIdx, add.index);
      if (sp.error) why = sp.error;
      else { spliced = true; unit = { label: sp.label, index: add.index, undo: () => { sp.undo(); add.undo(); }, redo: () => { add.redo(); sp.redo(); } }; }
    }
    if (!commitApplied(unit)) return null;
    selWire = null;
    const key = `d${activeDeck}_op${add.index}`;
    if (hostApi) hostApi.setState("selectedKey", key);
    renderInspector(key);
    const nm = raw.name || raw.type;
    if (spliced) { status(unit.label, "ok"); gate(".fe-g-splice", true, `splice ${kind}`); }
    else if (why) status(`added ${nm} — not spliced: ${why}`, "bad");
    else status(`added ${nm} (${kind})`, "ok");
    gate(".fe-g-create", true, `add ${kind}`);
    return { label: unit.label, index: add.index, spliced, why };
  }
  // a command-call op from {lib, ctl, cmd} (names or ids): terminals from the
  // callee's signature; outputs map by position, so non-flow callees expose
  // the single key `a`, flow callees their output bar (design §1.3 / I-7).
  async function createCommandOp(pick, wireIdx) {
    let { lib, ctl, cmd, ctlId, cmdId } = pick || {};
    if (!lib || !ctl || !cmd) { status("command call needs lib, ctl and cmd", "bad"); return null; }
    if (!ctlId || !cmdId) {
      const ctls = await controlsOf(lib);
      const cr = Array.isArray(ctls) ? ctls.find((r) => r.name === ctl || r.id === ctl) : null;
      if (!cr) { status(`no control ${lib}:${ctl}`, "bad"); return null; }
      ctlId = cr.id; ctl = cr.name;
      const rec = await readRec(lib, ctlId);
      const cm = rec && !(rec instanceof Error) ? (rec.cmd || []).find((m) => m.name === cmd || m.id === cmd) : null;
      if (!cm) { status(`no command ${lib}:${ctl}:${cmd}`, "bad"); return null; }
      cmdId = cm.id; cmd = cm.name;
    }
    const rc = await readCommand(lib, ctl, cmd);
    const ins = rc && rc.status === "ok" && Array.isArray(rc.params) ? rc.params.map((p) => p.name) : [];
    let outs = ["a"];
    if (rc && rc.status === "ok" && rc.type === "flow") {
      const fb = await readFlowBody(lib, ctl, cmd);
      if (fb && fb.status === "ok" && fb.exists && fb.body && fb.body.output) outs = Object.keys(fb.body.output);
    }
    const width = Math.max(1.75, cmd.length * 0.12 + 0.8);
    return createOp({ name: cmd, type: "command", cmd: `${lib}:${ctlId}:${cmdId}`, width,
      in: spread(ins, width), out: spread(outs.length ? outs : ["a"], width) }, wireIdx, "command");
  }

  // ── pickers (DOM overlay on the stage, floweditor3d's 3D-3 pickers) ───────
  let pickerEl = null;
  function closePicker() { if (pickerEl) { pickerEl.remove(); pickerEl = null; } }
  function openPicker(title) {
    closePicker();
    const el = document.createElement("div"); el.className = "fe-picker";
    const panel = document.createElement("div"); panel.className = "fe-picker-panel";
    const head = document.createElement("div"); head.className = "fe-picker-head";
    const lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = title;
    const x = document.createElement("button"); x.className = "fe-picker-x"; x.textContent = "×"; x.title = "close (Esc)";
    x.addEventListener("click", closePicker);
    head.append(lbl, x); panel.appendChild(head); el.appendChild(panel);
    el.addEventListener("pointerdown", (e) => { if (e.target === el) closePicker(); });
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePicker(); const s = ME.querySelector(".nb-flowedit3d"); if (s) s.focus(); } });
    $(".fe-main").appendChild(el);
    pickerEl = el;
    return panel;
  }
  function openPrimitivePicker(wireIdx) {
    const panel = openPicker(`primitive — ${PRIMS.length}, from the registry` + (wireIdx != null ? " · splices into the selected wire" : ""));
    const search = document.createElement("input"); search.className = "fe-picker-search"; search.placeholder = "search primitives…";
    const tabs = document.createElement("div"); tabs.className = "fe-picker-tabs"; tabs.setAttribute("role", "tablist");
    const list = document.createElement("div"); list.className = "fe-picker-list";
    let fam = "";                          // "" = every family
    const renderTabs = () => {
      tabs.replaceChildren(...["", ...FAMILIES].map((f) => {
        const b = document.createElement("button"); b.className = "fe-picker-tab" + (f === fam ? " active" : "");
        b.textContent = f || "all"; b.dataset.fam = f; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", f === fam ? "true" : "false");
        b.addEventListener("click", () => { fam = f; renderTabs(); renderList(); search.focus(); });
        return b;
      }));
    };
    const renderList = () => {
      const q = search.value.trim().toLowerCase();
      list.replaceChildren();
      let n = 0;
      for (const f of FAMILIES) {
        if (fam && f !== fam) continue;
        const prims = PRIMS.filter((p) => p.family === f && (!q || p.name.toLowerCase().includes(q) || f.includes(q)));
        if (!prims.length) continue;
        const h = document.createElement("div"); h.className = "fam lbl"; h.textContent = f; list.appendChild(h);
        for (const prim of prims) {
          const b = document.createElement("button"); b.className = "fe-prim"; b.dataset.prim = prim.name;
          const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = "⚙ " + prim.name;
          const sig = document.createElement("span"); sig.className = "sig"; sig.textContent = signature(prim);
          b.append(nm, sig);
          b.addEventListener("click", () => { closePicker(); createOp(primOp(prim), wireIdx, "primitive"); });
          list.appendChild(b); n++;
        }
      }
      if (!n) { const p = document.createElement("p"); p.className = "fe-empty"; p.textContent = "no primitive matches"; list.appendChild(p); }
    };
    search.addEventListener("input", renderList);
    search.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const b = list.querySelector(".fe-prim"); if (b) b.click(); } });
    panel.append(search, tabs, list);
    renderTabs(); renderList();
    search.focus();
  }
  async function openCommandPicker(wireIdx) {
    const panel = openPicker("command call — the callee" + (wireIdx != null ? " · splices into the selected wire" : ""));
    const mine = pickerEl;
    const libSel = document.createElement("select"); libSel.className = "fe-pk-lib";
    const ctlSel = document.createElement("select"); ctlSel.className = "fe-pk-ctl";
    const cmdSel = document.createElement("select"); cmdSel.className = "fe-pk-cmd";
    const foot = document.createElement("div"); foot.className = "fe-picker-foot";
    const cancel = document.createElement("button"); cancel.className = "fe-pk-cancel"; cancel.textContent = "cancel";
    const go = document.createElement("button"); go.className = "fe-pk-go"; go.textContent = "add call"; go.disabled = true;
    cancel.addEventListener("click", closePicker);
    foot.append(cancel, go);
    panel.append(libSel, ctlSel, cmdSel, foot);
    const fill = (sel, rows, value) => {
      sel.replaceChildren(...rows.map((r) => { const o = document.createElement("option"); o.value = r.value; o.textContent = r.text; return o; }));
      if (value && rows.some((r) => r.value === value)) sel.value = value;
    };
    const libs = await libsOf();
    if (pickerEl !== mine) return;          // closed while loading
    if (libs instanceof Error) { status("cannot list libraries", "bad"); closePicker(); return; }
    fill(libSel, libs.map((l) => ({ value: l.id, text: l.id })), source ? source.lib : null);
    let ctlRows = [];
    const loadCmds = async () => {
      const rec = ctlSel.value ? await readRec(libSel.value, ctlSel.value) : null;
      const cmds = rec && !(rec instanceof Error) ? (rec.cmd || []) : [];
      fill(cmdSel, cmds.map((cm) => ({ value: cm.id, text: cm.name })));
      go.disabled = !cmdSel.value;
    };
    const loadCtls = async () => {
      const ctls = await controlsOf(libSel.value);
      ctlRows = ctls instanceof Error ? [] : ctls;
      fill(ctlSel, ctlRows.map((cr) => ({ value: cr.id, text: cr.name })), source ? (ctlRows.find((r) => r.name === source.ctl) || {}).id : null);
      await loadCmds();
    };
    libSel.addEventListener("change", loadCtls);
    ctlSel.addEventListener("change", loadCmds);
    cmdSel.addEventListener("change", () => { go.disabled = !cmdSel.value; });
    mine.dataset.loading = "1";
    await loadCtls();
    if (pickerEl === mine) delete mine.dataset.loading;
    go.addEventListener("click", () => {
      const lib = libSel.value, ctlId = ctlSel.value, cmdId = cmdSel.value;
      if (!lib || !ctlId || !cmdId) return;
      const ctlName = (ctlRows.find((r) => r.id === ctlId) || {}).name;
      const cmdName = cmdSel.options[cmdSel.selectedIndex] ? cmdSel.options[cmdSel.selectedIndex].textContent : "";
      closePicker();
      createCommandOp({ lib, ctl: ctlName, cmd: cmdName, ctlId, cmdId }, wireIdx);
    });
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
    if (armSrc || wireMode) { cancelWireGhost(); }
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
    // a server panic arrives as an HTML 500 page in msg; show its words
    const rawMsg = String(r.msg == null ? "" : r.msg);
    const msg = /^\s*</.test(rawMsg) ? rawMsg.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : rawMsg;
    lastResult = { args, ok, result: r, msg, ms, unsaved, source: src,
      tokens: R ? { complete: !!R.complete, inOrder: !!R.inOrder, delivered: R.delivered.length } : null };
    pushJournal(ok ? `ran ${src.cmd} · ${ms}ms` : `run failed: ${msg}`);
    if (ok) status(`ran · ${ms}ms` + (R && R.complete && R.inOrder ? ` · ${R.delivered.length} ${R.delivered.length === 1 ? "delivery" : "deliveries"} in order` : ""), "ok");
    else status(`run failed: ${msg}`, "bad");
    renderRunResult(lastResult, R);
    return lastResult;
  }
  function renderRunResult(L, R) {
    const body = $(".fe-inspect-body"); if (!body || !L) return;
    const r = L.result || {};
    const payload = Object.assign({}, r); delete payload.status; delete payload.pid; delete payload.nn_return_type;
    const shown = L.ok ? ("data" in payload && Object.keys(payload).length === 1 ? payload.data : payload) : (L.msg || payload);
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
      hostApi.setState("onOpDrag", (p) => {
        // drag an op body to move it (front-ortho plane, z kept). Undoable.
        // flownode hands ONE payload {phase, key, opIndex, evt, which?, ord?}
        // (it used to be read as (opIndex, evt), so no drag ever committed);
        // the node live-follows the pointer itself, the move commits on end.
        if (!p || p.which) return;                 // socket drags: not an op move
        // live-follow: the drawn icon rides the pointer with its pick proxy —
        // and so do its wires (links re-resolve their socket ends each frame)
        if (p.phase === "move" && !running) {
          const c0 = focusedCase(); const op0 = c0 && c0.cmds[p.opIndex]; const e0 = p.evt || {};
          if (op0 && op0.pos && typeof e0.dx === "number" && stage && stage.applyDelta) {
            const fid = "fx_" + slug(`d${activeDeck}/op/${p.opIndex}`);
            stage.applyDelta(fid, "pos.x", op0.pos.x + e0.dx);
            stage.applyDelta(fid, "pos.y", op0.pos.y + (e0.dy || 0));
          }
          return;
        }
        if (p.phase !== "end" || running) return;
        const c = focusedCase(); const op = c && c.cmds[p.opIndex]; if (!op || !op.pos) return;
        const evt = p.evt || {};
        let to;
        if (typeof evt.dx === "number" && typeof evt.dy === "number") {
          if (Math.hypot(evt.dx, evt.dy) < 1e-6) return;
          to = { x: op.pos.x + evt.dx, y: op.pos.y + evt.dy };
        } else {
          const w = evt.world ? evt.world : (evt.clientX !== undefined ? clientToWorld(evt) : null);
          if (!w) return;
          to = { x: w.x, y: w.y };
        }
        to = { x: Math.round(to.x * 2) / 2, y: Math.round(to.y * 2) / 2, z: op.pos.z };
        if (to.x === op.pos.x && to.y === op.pos.y) { renderAll(); return; }   // snapped back: re-seat the node
        const cmd = doc.moveOp(c, p.opIndex, to);
        if (cmd && !cmd.error) { commitApplied(cmd); status(`moved ${nameOf(c, p.opIndex)} — ⌘Z undoes`, "ok"); }
        else { renderAll(); status("move refused" + (cmd && cmd.error ? ": " + cmd.error : ""), "bad"); }
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
      // palette: click = add op (primitive/command open a picker); with a wire
      // selected the new op splices into that wire
      ME.querySelectorAll(".fe-pal-item").forEach((el) => {
        el.addEventListener("click", () => {
          const entry = PALETTE[+el.dataset.pi]; if (!entry) return;
          addOpFromPalette(entry);
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
        const inField = tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName || ""));
        // ⌘S saves from anywhere in the editor. A focused text field's pending
        // value is committed EXPLICITLY (a change event — blur alone does not
        // fire change when the value was not set by real typing, and some
        // engines skip it on removal); every inspector change handler is
        // guarded on "value differs", so a second change from the blur is a
        // no-op. Then the save runs on the next tick, after the commit.
        if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
          e.preventDefault();
          if (inField && /^(INPUT|TEXTAREA)$/.test(tg.tagName || "")) tg.dispatchEvent(new Event("change", { bubbles: true }));
          if (inField && tg.isConnected && tg.blur) tg.blur();
          setTimeout(() => { saveFlow(); }, 0);
          return;
        }
        if (inField) return;
        if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
        // wire mode owns arrows/Enter/Esc while it is up
        if (wireMode) {
          if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") { e.preventDefault(); moveWireCandidate(1); return; }
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveWireCandidate(-1); return; }
          if (e.key === "Enter") { e.preventDefault(); commitKeyboardWire(); return; }
          if (e.key === "Escape") { e.preventDefault(); cancelWireGhost(); status("wiring cancelled"); return; }
        }
        // Enter edits the selection (floweditor3d's popover key): focus the op
        // editor's first field, or the params-bar name field with no selection
        if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const f = $(".fe-inspect-body .fe-ed-name") || $(".fe-inspect-body .fe-ed-bname");
          if (f) { e.preventDefault(); f.focus(); if (f.select) f.select(); return; }
        }
        if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); startRun(); return; }
        if (e.key === "2") setProj("front");
        else if (e.key === "3") setProj("persp");
        else if (e.key === "a" || e.key === "A") frameDeck();
        else if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !e.altKey) frameSelection();
        else if (e.key === "Tab" && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); walkOps(e.shiftKey ? -1 : 1); }
        else if (e.key === "[") setActiveDeck((activeDeck - 1 + deckCount) % deckCount);
        else if (e.key === "]") setActiveDeck((activeDeck + 1) % deckCount);
        else if (e.key === "w" || e.key === "W") { e.preventDefault(); startKeyboardWiring(); }
        else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelectedWire(); }
        else if (e.key === "Escape") {
          const hasSel = (hostApi && hostApi.state && hostApi.state.selectedKey) || selWire != null;
          if (armSrc) { cancelWireGhost(); status("wiring cancelled"); }
          else if (focusPath.length > 1) drillBack();
          else if (hasSel || harness || typeof PROPS.onBack !== "function") clearSelection();
          else PROPS.onBack();
        }
      });

      // expose a tiny api for the gate + future phases
      return {
        // dev.frame calls dispose() on every navigation away. The scenehost
        // runs a rAF frame loop + a WebGL stage that outlive the dropped DOM
        // (floweditor3d's own dispose was stage.dispose()), so: cancel the
        // gesture, close overlays, end any run, remove every hosted instance
        // (their dispose behaviors run), then stop the host. Idempotent.
        dispose() {
          if (disposed) return;
          disposed = true;
          cancelWireGhost(); closePicker();
          try { hostApi.setState("onTokenDelivered", null); hostApi.setState("run", null); } catch (e) {}
          for (const ch of (hostApi.children || []).slice()) { try { hostApi.removeControl(ch.key); } catch (e) {} }
          instances = [];
          try { if (hostApi.dispose) hostApi.dispose(); } catch (e) {}
        },
        disposed: () => disposed,
        hostedCount: () => (hostApi && hostApi.children ? hostApi.children.length : 0),
        // test/gate surface (headless drives these)
        onPortTap, startKeyboardWiring, moveWireCandidate, commitKeyboardWire,
        armWire, undo, doc: () => doc, focusedCase, canWire: (s, d2) => doc.canWire(focusedCase(), s, d2),
        addWire: (s, d2) => { const cmd = doc.addWire(focusedCase(), { src: s, dest: d2 }); if (!cmd.error) commitApplied(cmd); return cmd; },
        removeWire: (i) => { const cmd = doc.removeWire(focusedCase(), i); if (!cmd.error) commitApplied(cmd); return cmd; },
        cons: () => focusedCase().cons.length,
        // P3 surface
        redo, addOpFromPalette: (i, pick) => addOpFromPalette(PALETTE[i] || PALETTE[0], pick !== undefined ? { pick } : {}),
        spliceIntoSelectedWire: (i, pick) => spliceIntoSelectedWire(PALETTE[i] || PALETTE[0], pick !== undefined ? { pick } : {}),
        deleteSelectedOp, applyLayoutProposal, saveFlow, PALETTE,
        // P5 palette parity surface
        addPrimitive: (name) => addOpFromPalette(PALETTE[0], { pick: name }),
        addCommandCall: (pick) => addOpFromPalette(PALETTE[1], { pick }),
        picker: () => pickerEl, closePicker, primCount: () => PRIMS.length, families: () => FAMILIES.slice(),
        opAt: (i) => { const c = focusedCase(); return c && c.cmds[i] ? JSON.parse(JSON.stringify(c.cmds[i])) : null; },
        opCount: () => { const c = focusedCase(); return c ? c.cmds.length : 0; },
        selectWire: (i) => { selWire = i; renderInspector(null); },
        // P5 step 4 surface (op / terminal / signature editor)
        refreshInspector, inspTerm: () => inspTerm,
        editTerm: (key, idx, which, term) => { inspTerm = { key, idx, which, term }; refreshInspector(); },
        caseIO: () => { const c = focusedCase(); return c ? JSON.parse(JSON.stringify({ input: c.input, output: c.output })) : null; },
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
        // P5 step 4c surface (case chain authoring, diagnostics, walk, frame)
        addDeck, removeDeck, setActiveDeck, activeDeck: () => activeDeck, deckCount: () => caseChain(focusRoot()).length,
        focusedPath, diagnostics: () => lastDiags.map((d) => ({ code: d.code, severity: d.severity, opIndex: d.opIndex, message: d.message })),
        walkOps, selectOp, selectedOpIndex, frameSelection, lastFrame: () => lastFrame,
        pose: () => (stage && stage.getPose ? stage.getPose() : null),
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