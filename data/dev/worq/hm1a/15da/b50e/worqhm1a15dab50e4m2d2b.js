// flowedit3d — the P2 GATE for the floweditor3d → app-scene-stack conversion:
// WIRING GESTURES ported onto app:scenehost. Building on flowview3d (the P1
// read-only gate), this adds the editing gestures as flownode behaviors +
// editor chrome, with the FLOW BODY authoritative (decision 4): every wire is
// a FlowDoc mutation (addWire/removeWire/canWire — I-1/I-2 enforced there),
// and the scene facet is a DERIVED view re-projected from the doc on each
// mutation. Nothing here writes a second source of truth.
//
// Gestures ported (design §5.4, pointer AND keyboard):
//   wire drag  — press a socket, drag to a socket of the OTHER kind, release:
//                the wire commits. Inputs are op in sockets and return-bar
//                terminals; outputs are op out sockets and params-bar
//                terminals — any of them can start the drag or end it. The
//                ghost is a REAL hang link between the grabbed socket and the
//                pointer; over a legal socket it snaps there and the status
//                previews the wire (I-1/I-2 via canWire). Op socket drags
//                dispatch flownode.drag → host.state.onOpDrag → onSocketDrag;
//                bar sockets (facade, no instance) arrive by the scenehost's
//                host.state.onSceneDrag → onSceneDrag → onSocketDrag. A plain
//                socket TAP wires nothing (onPortTap just says how).
//   keyboard   — W arms wiring from the selection; ←→ cycle the legal targets
//                (reading order, nearest-first); Enter commits; Esc cancels.
//   select     — tap a WIRE: its facade link keeps a tap affordance, the
//                host forwards the unclaimed tap (host.state.onSceneTap) and
//                the wire highlights; one selection at a time (op XOR wire).
//                Tap an OP body: flownode.click → host.state.onOpSelect →
//                selectOp (halo + inspector + "Del deletes" status) — the
//                same path, so an op is selected exactly like a wire.
//   delete     — Del/Backspace deletes THE selection: a selected wire unwires
//                (FlowDoc.removeWire — frees its input, I-1); a selected op is
//                removed with its wires (FlowDoc.removeOp). The inspector's
//                "unwire" / "delete op" buttons do the same.
//   undo       — ⌘Z runs the mutation's inverse (commitApplied's undo stack).
//
// The facade (toSceneDoc) is the rendered picture; the instances are the pick
// surface. The wire ghost lives on the facade as tip+hang-link specs moved via
// flowproject.terminalWorld — the SAME geometry the wires render with.
//
// STEP DEBUGGER (P4): toolbar + keys (F10 over · F11 into · ⇧F11 out · F5
// continue · ⇧F10 back · ⇧F5 stop · F9 breakpoint), deliveries ride
// dev:flowtoken (reverse on ⇧F10), op state on flownode's dbg plate, the ready
// set click-to-pick, drill in/out with the frame stack, the debug inspector
// (frames, selection values, args/out, breakpoints) and the D5 TIMELINE: a
// scrub strip over the session's tape (one tick per step, the cursor, branch
// bands at the forks) — click/drag = goto, double-click = step; the inspector
// carries the same strip plus the branch swap buttons.

var me = this;
var ME = document.getElementById(me.UUID);

var readyP = new Promise(function (res) { me.ready = res; }).then(async () => {
  const { parse: parseFlow, propagationRounds, diffFlow } = document.querySelector('[data-control="dev:flowdoc"]').api;
  const { toSceneDoc, terminalWorld, jumpPoints, GEO, syncHandlePos } = document.querySelector('[data-control="dev:flowproject"]').api;
  const { tidy, untangle } = document.querySelector('[data-control="dev:flowlayout"]').api;
  // STEP DEBUGGER (P4): debug_state -> editor views + the session client
  const FD = document.querySelector('[data-control="dev:flowdebug"]').api;

  // ── backend plumbing (same ajax idiom as floweditor3d) ────────────────────
  const invokeP = (l2, c2, m2, a2) => new Promise((res2) => invokeCommand(l2, c2, m2, a2, res2));
  const codeCmd = (m2, a2) => invokeP("dev", "code", m2, a2);

  // ── OLD RUNTIMES (synchros S3) ────────────────────────────────────────────
  // A synchro is honored only by a flowlang that implements S1 (Case.syncs in
  // Code::execute). Older interpreters — this instance's build, or any peer's —
  // ignore the key SILENTLY and run the flow unsynchronized. S1 is unreleased
  // as of this writing; 0.3.38 is verified synchro-less, so the first release
  // that can carry it is 0.3.39. Set SYNC_MIN_FLOWLANG to the actual S1
  // release when it ships.
  const SYNC_MIN_FLOWLANG = "0.3.39";
  const verParts = (v) => String(v || "").replace(/^[^0-9]*/, "").split(/[.+-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
  const verLess = (a, b) => { const A = verParts(a), B = verParts(b); for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] < B[i]; return false; };
  // dev.dev.crate_versions ONCE per mount (it reads every manifest), and only
  // when the flow has synchros. The OLDEST flowlang pin across the manifests
  // wins: a skewed build (mismatch) still links the older interpreter somewhere.
  // Unreadable (non-admin, older host) = unknown = no warning.
  let runtimeInfo = null;         // {flowlang, min, old, mismatch} | {unknown:true, msg}
  let runtimeP = null;
  function checkRuntime() {
    if (!runtimeP) runtimeP = invokeP("dev", "dev", "crate_versions", {}).then((r) => {
      const d = r && r.data && typeof r.data === "object" && "flowlang" in r.data ? r.data : r;
      if (!d || d.status === "err" || typeof d.flowlang !== "string") {
        runtimeInfo = { unknown: true, msg: String((d && d.msg) || "crate_versions unavailable") };
        return runtimeInfo;
      }
      let fl = d.flowlang;
      for (const m of Array.isArray(d.manifests) ? d.manifests : []) {
        if (m && m.flowlang && (!fl || verLess(m.flowlang, fl))) fl = m.flowlang;
      }
      runtimeInfo = fl
        ? { flowlang: fl, min: SYNC_MIN_FLOWLANG, old: verLess(fl, SYNC_MIN_FLOWLANG), mismatch: !!d.mismatch }
        : { unknown: true, msg: "no flowlang pin found" };
      return runtimeInfo;
    }, (e) => (runtimeInfo = { unknown: true, msg: String(e && e.message ? e.message : e) }));
    return runtimeP;
  }
  // synchros in a WHOLE flow (default: the working doc): every case of every
  // chain, locals included. A raw body works too (the saved snapshot).
  function flowSyncCount(root) {
    let n = 0;
    const visit = (c) => {
      for (; c && typeof c === "object"; c = c.nextcase) {
        n += Array.isArray(c.syncs) ? c.syncs.length : 0;
        (Array.isArray(c.cmds) ? c.cmds : []).forEach((op) => { if (op && op.localdata) visit(op.localdata); });
      }
    };
    visit(root !== undefined ? root : (doc && doc.root));
    return n;
  }
  // the warning, or null: the flow has synchros AND the runtime predates S1.
  // n overrides the count (a live run counts the SAVED body - what it runs).
  function runtimeWarning(n) {
    if (typeof n !== "number") n = flowSyncCount();
    if (!n || !runtimeInfo || !runtimeInfo.old) return null;
    return { n, flowlang: runtimeInfo.flowlang, min: SYNC_MIN_FLOWLANG,
      text: `this flow has ${n} synchro${n === 1 ? "" : "s"}, but this instance runs flowlang ${runtimeInfo.flowlang} (synchros need ≥ ${SYNC_MIN_FLOWLANG}, S1): it will run UNSYNCHRONIZED — older interpreters and peers ignore syncs silently` };
  }
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
  let armSrc = null;              // pointer wiring: the GRABBED socket { which, idx, term, key }
  let ghostIds = [];              // facade ghost specs (tip + hang link)
  let selWire = null;             // a selected wire's cons index (for Del)
  let selWireRef = null;          // ...and the cons OBJECT, so the selection survives re-indexing
  // a selected SYNCHRO (S3): its syncs index, the sync OBJECT (survives
  // re-indexing, like selWireRef) and the case it belongs to (a deck switch
  // or drill drops it). One selection at a time: op XOR wire XOR synchro.
  let selSync = null, selSyncRef = null, selSyncCase = null;

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
    // a debug session's tape describes THIS body: edits wait for stop (⇧F5)
    if (dbgActive()) { try { cmd.undo(); } catch (e) {} renderAll(); status("debugging — edits are locked; stop the session (⇧F5) to edit", "bad"); return false; }
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
    if (dbgActive()) { status("debugging — stop the session (⇧F5) to undo", "bad"); return; }
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
    if (dbgActive()) { status("debugging — stop the session (⇧F5) to redo", "bad"); return; }
    const cmd = redoStack.pop(); if (!cmd) return;
    try { if (cmd.redo) cmd.redo(); } catch (e) {}
    undoStack.push(cmd);
    dirty = true;
    { const lb = cmd.label || "edit", li = pendingLabels.lastIndexOf("undo " + lb); if (li >= 0) pendingLabels.splice(li, 1); else pendingLabels.push(lb); }
    $(".fe-undo").disabled = false;
    pushJournal("redo " + (cmd.label || ""));
    afterMutation();
  }
  function afterMutation() { reconcileFocus(); reconcileSelWire(); reconcileSelSync(); cancelWireGhost(); renderAll(); refreshSaveUi(); renderChanges(); refreshInspector(); }
  // the synchro twin: follow the selected sync OBJECT to its new index in
  // the SAME case, else drop it (deleted, undone, or another deck in focus)
  function reconcileSelSync() {
    if (selSync == null) return;
    const c = focusedCase();
    const i = c && c === selSyncCase && selSyncRef && Array.isArray(c.syncs) ? c.syncs.indexOf(selSyncRef) : -1;
    if (i >= 0) selSync = i; else { selSync = null; selSyncRef = null; selSyncCase = null; }
  }
  // a mutation can re-index cons (removeWire/removeOp/undo): follow the
  // selected wire OBJECT to its new index, or drop the selection if it is gone
  function reconcileSelWire() {
    if (selWire == null) return;
    const c = focusedCase();
    const i = c && selWireRef ? c.cons.indexOf(selWireRef) : -1;
    if (i >= 0) selWire = i; else { selWire = null; selWireRef = null; }
  }

  function pushJournal(text) {
    const ul = $(".fe-journal-list"); if (!ul) return;
    const li = document.createElement("li"); li.textContent = text;
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > 24) ul.removeChild(ul.lastChild);
  }

  // ── facade: project the derived scene facet onto the stage ────────────────
  function renderFacade() {
    reconcileSelSync();                       // a deck switch / drill drops it
    // colours follow the live bench tokens (app:tokens) — the dev app's theme
    const tokens = (n) => getComputedStyle(ME).getPropertyValue(n);
    const sceneDoc = toSceneDoc(focusRoot(), { editable: true, activeDeck, tokens });
    // selection = the bench accent, read exactly as flownode's halo reads it
    const selTok = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    const selColor = /^#[0-9a-f]{3,8}$/i.test(selTok) ? selTok : "#f0a63c";
    // STEP DEBUGGER (P4): the focused case's frame in the debug session (null
    // when not debugging or no frame runs this case) tints its wires
    // (delivered / ready / skipped) and synchros (fired / ready / skipped);
    // a ready one also thickens - it is pickable (a tap runs it next)
    const dv = dbgDeckView();
    const dcol = dv ? dbgColors() : null;
    const DBG_W = { delivered: "done", fired: "done", ready: "ready", skipped: "skipped" };
    const tint = (s, n, st) => {
      const role = DBG_W[st]; if (!role || !dcol) return;
      s.material = { ...(s.material || n.material || {}), color: dcol[role] };
      if (st === "ready" && n.kind === "link") s.r = (n.r || 0.035) * 1.6;
      if (st === "ready" && n.meta && n.meta.part === "mark") s.scale = { x: 1.4, y: 1.4, z: 1.4 };
      s.meta = { ...(s.meta || n.meta), dbg: st };
    };
    const specs = sceneDoc.nodes.map((n) => {
      const s = { ...n, id: "fx_" + n.id };
      if (n.parent !== undefined) s.parent = "fx_" + n.parent;
      if (n.kind === "link") { s.from = "fx_" + n.from; s.to = "fx_" + n.to; }
      delete s.affordances;                 // facade is scenery; instances are picked —
      // EXCEPT bar sockets: no instance hosts a bar, so its facade sockets
      // stay tappable + draggable (the host forwards them to onSceneTap /
      // onSceneDrag → the wiring engine, the same as an op's sockets)
      if (barTermOfMeta(n.meta)) s.affordances = { tap: true, hover: true, drag: { plane: "xy" } };
      // EXCEPT wires: a wire is no instance, so its facade link stays tappable
      // (the host forwards the tap to onSceneTap → selectWire), and the
      // selected wire draws in the selection colour, thicker
      if (n.kind === "link" && n.meta && n.meta.role === "wire") {
        s.affordances = { tap: true, hover: true };
        if (dv) tint(s, n, dv.wires[n.meta.index]);   // only the ACTIVE deck draws wires
        if (selWire != null && n.meta.index === selWire) {
          s.material = { ...(n.material || {}), color: selColor };
          s.r = (n.r || 0.035) * 1.8;
          s.meta = { ...n.meta, selected: true };
        }
      }
      // SYNCHROS (S3): no instance hosts a synchro either — its midpoint
      // MARK stays tappable (onSceneTap → selectSync) and its op-end HANDLES
      // stay tappable + draggable (onSceneDrag → onSyncDrag, from either
      // end). The selected synchro draws its line + mark in the selection
      // colour, the mark enlarged.
      if (n.meta && n.meta.role === "sync-handle") s.affordances = { tap: true, hover: true, drag: { plane: "xy" } };
      if (n.meta && n.meta.role === "sync") {
        if (n.meta.part === "mark") s.affordances = { tap: true, hover: true };
        if (dv) tint(s, n, dv.syncs[n.meta.index]);
        if (selSync != null && n.meta.index === selSync) {
          s.material = { ...(n.material || {}), color: selColor };
          if (n.meta.part === "mark") s.scale = { x: 1.6, y: 1.6, z: 1.6 };
          s.meta = { ...n.meta, selected: true };
        }
      }
      s.params = n.params || (n.text ? n.text : undefined);
      return s;
    });
    lastFacadeDbg = specs.filter((s) => s.meta && s.meta.dbg).map((s) => ({ id: s.id, role: s.meta.role, part: s.meta.part, index: s.meta.index, dbg: s.meta.dbg, color: s.material && s.material.color }));
    // D4: breakpoint dots on the focused case's wires and synchros (ops
    // carry theirs on the flownode) - see bpDotSpecs
    for (const s of bpDotSpecs()) specs.push(s);
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
    stage.setScene(specs.concat(ghostSpecs(), syncGhostSpecs(), hostOwned), { lights: "default", grid: false, camera: null });
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

  // ── wiring: DRAG between an input and an output, from either end ─────────
  // The pointer wiring gesture: press a socket, drag, release over a socket
  // of the OTHER kind. From an op's INPUT, drop on an output (an op's out
  // socket or a params-bar terminal); from an op's OUTPUT, drop on an input
  // (an op's in socket or a return-bar terminal). Socket drags route here
  // from flownode.drag (host.state.onOpDrag → onSocketDrag). armSrc holds the
  // grabbed socket {which, idx, term, key}; the ghost hangs between it and
  // the pointer, snapping onto a legal socket under the pointer while the
  // status previews the wire (I-1/I-2 via canWire). Release over a legal
  // socket commits ONE doc.addWire (⌘Z undoes); anywhere else cancels; Esc
  // cancels mid-drag. A plain TAP on a socket wires nothing — it says how.
  function onPortTap(p) {
    const m = p && /^(in|out)(\d+)$/.exec(p.node || ""); if (!m) return;
    status(m[1] === "in" ? "drag from this input to an output to wire it"
      : "drag from this output to an input to wire it", "ok");
  }

  // the drag's point on its plane (world); the front-ortho fallback otherwise
  function dragPoint(evt) {
    if (evt && typeof evt.x === "number" && typeof evt.y === "number") return { x: evt.x, y: evt.y, z: typeof evt.z === "number" ? evt.z : 0 };
    return evt && typeof evt.clientX === "number" ? clientToWorld(evt) : null;
  }

  // a bar socket of the active deck, from its facade meta (toScene stamps
  // {role:"terminal", idx:-1|-2, which, term}): the params bar's sockets are
  // sources (which "out"), the return bar's are sinks (which "in")
  function barTermOfMeta(m) {
    return m && m.role === "terminal" && (m.idx === -1 || m.idx === -2) && typeof m.term === "string"
      ? { idx: m.idx, which: m.which, term: m.term } : null;
  }
  function barTermOfSpec(specId) {
    const o = specId && stage && stage.objects && stage.objects.get ? stage.objects.get(specId) : null;
    return barTermOfMeta(o && o.spec && o.spec.meta);
  }

  // the `which` ("in"|"out") terminal under the pointer: the socket the stage
  // picks there (an op socket on the active deck, or a bar socket), else the
  // nearest such terminal — op sockets plus the matching bar (outputs: the
  // params bar; inputs: the return bar) — within DROP_PX on screen
  // (DROP_WORLD units when headless).
  const DROP_PX = 24, DROP_WORLD = 0.3;
  function terminalAt(c, evt, which) {
    if (!c || !evt) return null;
    const hasClient = typeof evt.clientX === "number" && typeof evt.clientY === "number";
    if (hasClient && stage && stage.pickAt) {
      const id = String(stage.pickAt(evt.clientX, evt.clientY) || "");
      const m = /^d(\d+)_op(\d+):(in|out)(\d+)$/.exec(id);
      if (m && +m[1] === activeDeck && m[3] === which) {
        const op = c.cmds[+m[2]]; const term = op && Object.keys(op[which] || {})[+m[4]];
        if (term !== undefined) return { idx: +m[2], term };
      }
      const bt = barTermOfSpec(id);
      if (bt && bt.which === which) return { idx: bt.idx, term: bt.term };
    }
    const cands = [];
    c.cmds.forEach((op, i) => Object.keys((op && op[which]) || {}).forEach((term) => cands.push({ idx: i, term })));
    const bar = which === "out" ? -1 : -2;
    Object.keys((which === "out" ? c.input : c.output) || {}).forEach((term) => cands.push({ idx: bar, term }));
    const screen = hasClient && stage && stage.anchor && stage.canvas;
    const r = screen ? stage.canvas.getBoundingClientRect() : null;
    const pt = screen ? null : dragPoint(evt);
    let best = null, bd = Infinity;
    for (const t of cands) {
      const w = terminalWorld(c, t.idx, which, t.term); if (!w) continue;
      let d;
      if (screen) { const a = stage.anchor(w); if (!a.visible) continue; d = Math.hypot(a.x - (evt.clientX - r.left), a.y - (evt.clientY - r.top)) / DROP_PX; }
      else if (pt) d = Math.hypot(w.x - pt.x, w.y - pt.y) / DROP_WORLD;
      else continue;
      if (d < bd) { bd = d; best = t; }
    }
    return bd <= 1 ? best : null;
  }

  // p: {phase, key, opIndex, which, evt} plus ord (an op socket: the socket
  // ordinal) or term + sock (a bar socket: opIndex -1/-2, sock = its facade
  // spec id, which the ghost hangs from)
  function onSocketDrag(p) {
    const c = focusedCase(); if (!c || !p) return;
    const evt = p.evt || {};
    if (p.phase === "start") {
      if (running || dbgActive() || (p.which !== "in" && p.which !== "out")) return;
      const terms = p.opIndex === -1 ? c.input : p.opIndex === -2 ? c.output
        : (c.cmds[p.opIndex] && c.cmds[p.opIndex][p.which]);
      const term = p.term !== undefined ? p.term : Object.keys(terms || {})[p.ord];
      if (term === undefined || !terms || !(term in terms)) return;
      if (p.which === "in" && c.cons.some((w) => w.dest[0] === p.opIndex && w.dest[1] === term)) {
        status(`✗ ${nameOf(c, p.opIndex)}.${term} is already wired (I-1) — select its wire and Del first`, "bad");
        return;
      }
      if (wireMode) cancelWireGhost();
      armSrc = { which: p.which, idx: p.opIndex, term, key: p.key, sock: p.sock || null }; selWire = null;
      hostApi.setState("wireSrc", armSrc);
      showGhost(dragPoint(evt) || terminalWorld(c, p.opIndex, p.which, term));
      status(`wiring ${nameOf(c, p.opIndex)}.${term} — drag to ${p.which === "in" ? "an output" : "an input"} and release (Esc cancels)`, "ok");
      return;
    }
    if (!armSrc || p.key !== armSrc.key) return;    // not our gesture (or Esc'd)
    const fromIn = armSrc.which === "in";
    const want = fromIn ? "out" : "in";               // the kind of socket to drop on
    const wantText = fromIn ? "an output" : "an input";
    const mine = [armSrc.idx, armSrc.term];
    const tgt = terminalAt(c, evt, want);
    const there = tgt && [tgt.idx, tgt.term];
    const src = tgt && (fromIn ? there : mine), dest = tgt && (fromIn ? mine : there);
    const chk = tgt ? doc.canWire(c, src, dest) : null;
    const wl = tgt ? `${nameOf(c, src[0])}.${src[1]} → ${nameOf(c, dest[0])}.${dest[1]}` : "";
    if (p.phase === "move") {
      moveGhost((chk && chk.ok && terminalWorld(c, tgt.idx, want, tgt.term)) || dragPoint(evt) || ghostTip);
      if (!tgt) status(`wiring ${nameOf(c, mine[0])}.${mine[1]} — drag to ${wantText} and release (Esc cancels)`, "ok");
      else if (chk.ok) status(`release to wire ${wl}`, "ok");
      else status("✗ " + chk.reason, "bad");
      return;
    }
    if (p.phase !== "end") return;
    cancelWireGhost();
    if (!tgt) return status(`wiring cancelled — release over ${wantText} to wire`);
    if (!chk.ok) { status("✗ " + chk.reason, "bad"); gate(".fe-g-i1i2", true, chk.reason); return; }
    const cmd = doc.addWire(c, { src, dest });
    if (cmd.error) return status("wire refused: " + cmd.error, "bad");
    if (!commitApplied(cmd)) return;
    status(`wired ${wl} — ⌘Z undoes`, "ok");
    gate(".fe-g-wiretap", true, `drag wire committed (from ${fromIn ? "input" : "output"})`);
  }

  // ── the wire ghost: facade tip sphere + hang link tracking the pointer ────
  // pointer drag (armSrc = the grabbed socket): the tip rides the pointer at
  // the FREE end; the link always hangs from the output end down into the
  // input end — tip → input when an input was grabbed, output → tip when an
  // output was. keyboard (wireMode): from the selected output down to the
  // tip on the candidate input.
  function ghostSpecs() {
    if (!armSrc && !wireMode) return [];
    const c = focusedCase(); if (!c) return [];
    const tipSpec = (t) => ({ id: "fx_ghosttip", kind: "sphere", pos: { x: t.x, y: t.y, z: t.z },
      params: { radius: 0.05 }, material: { color: "#62bd8c", emissive: true } });
    const linkSpec = (from, to) => ({ id: "fx_ghostwire", kind: "link", curve: "hang", from, to,
      r: GEO.wireR, material: { color: "#62bd8c", dash: true } });
    if (armSrc) {
      const which = armSrc.which || "in";
      const sockId = armSrc.sock || `fx_${slug(`d${activeDeck}/op/${armSrc.idx}/${which}/${armSrc.term}`)}`;
      const at = terminalWorld(c, armSrc.idx, which, armSrc.term) || { x: 0, y: 0, z: 0 };
      return which === "in"
        ? [tipSpec(ghostTip || at), linkSpec("fx_ghosttip", sockId)]
        : [tipSpec(ghostTip || at), linkSpec(sockId, "fx_ghosttip")];
    }
    const src = wireMode.src;
    if (!src) return [];
    const fromId = `fx_${slug(`d${activeDeck}/op/${src.idx}/out/${src.term}`)}`;
    const from = terminalWorld(c, src.idx, "out", src.term) || { x: 0, y: 0, z: 0 };
    return [tipSpec(ghostTip || from), linkSpec(fromId, "fx_ghosttip")];
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
  function cancelWireGhost() { armSrc = null; wireMode = null; ghostTip = null; syncGhost(); cancelSyncGesture(); if (hostApi) hostApi.setState("wireSrc", null); }

  // ── synchro authoring (S3): drag between sync handles, from EITHER end ──
  // The handles are facade nodes (no instance hosts them), so their drags
  // arrive via host.state.onSceneDrag → onSceneDrag → onSyncDrag, exactly as
  // a bar socket's do. Grab a sync-out (◆ right end) and drop on another
  // op's sync-in (◆ left end) — or the reverse; dropping on the other op's
  // BODY also counts. FlowDoc.canSync refuses self, duplicates and any
  // synchro that would close a cycle over wires + synchros (I-2: the case
  // would stall); FlowDoc.addSync is the ONE undoable mutation, journaled by
  // commitApplied and written by the normal save. The ghost is a straight
  // sync-coloured link from the grabbed handle to the pointer.
  let armSync = null;             // {idx, which, key} while a synchro drag is live
  let syncTip = null;
  function syncColorOf() { const v = getComputedStyle(ME).getPropertyValue("--f-data").trim(); return /^#[0-9a-f]{3,8}$/i.test(v) ? v : "#a78bda"; }
  function syncGhostSpecs() {
    if (!armSync) return [];
    const c = focusedCase(); if (!c) return [];
    const col = syncColorOf();
    const at = syncTip || syncHandlePos(c, armSync.idx, armSync.which) || { x: 0, y: 0, z: 0 };
    const hid = armSync.key || `fx_${slug(`d${activeDeck}/op/${armSync.idx}/sync-${armSync.which}`)}`;
    const tip = { id: "fx_ghostsynctip", kind: "ico", pos: { x: at.x, y: at.y, z: at.z },
      params: { radius: GEO.syncR || 0.055, detail: 0 }, material: { color: col, emissive: true } };
    const link = armSync.which === "out"
      ? { id: "fx_ghostsync", kind: "link", from: hid, to: "fx_ghostsynctip", material: { color: col } }
      : { id: "fx_ghostsync", kind: "link", from: "fx_ghostsynctip", to: hid, material: { color: col } };
    return [tip, link];
  }
  function drawSyncGhost() {
    if (!stage) return;
    const g = syncGhostSpecs();
    if (g.length) { for (const s of g) stage.upsert(s); }
    else { stage.removeObject("fx_ghostsync"); stage.removeObject("fx_ghostsynctip"); }
  }
  function cancelSyncGesture() { if (!armSync && !syncTip) return; armSync = null; syncTip = null; drawSyncGhost(); }
  // the op whose `which` sync handle (or body) is under the pointer: a picked
  // handle / op body first, else the nearest such handle within DROP_PX on
  // screen (DROP_WORLD headless)
  function syncHandleAt(c, evt, which) {
    if (!c || !evt) return null;
    const hasClient = typeof evt.clientX === "number" && typeof evt.clientY === "number";
    if (hasClient && stage && stage.pickAt) {
      const id = String(stage.pickAt(evt.clientX, evt.clientY) || "");
      const sh = syncHandleOfSpec(id);
      if (sh && sh.which === which) return sh.idx;
      const m = /^d(\d+)_op(\d+)(?::body)?$/.exec(id);
      if (m && +m[1] === activeDeck && c.cmds[+m[2]]) return +m[2];
    }
    const screen = hasClient && stage && stage.anchor && stage.canvas;
    const r = screen ? stage.canvas.getBoundingClientRect() : null;
    const pt = screen ? null : dragPoint(evt);
    let best = null, bd = Infinity;
    c.cmds.forEach((op, i) => {
      const w = syncHandlePos(c, i, which); if (!w) return;
      let d;
      if (screen) { const a = stage.anchor(w); if (!a.visible) return; d = Math.hypot(a.x - (evt.clientX - r.left), a.y - (evt.clientY - r.top)) / DROP_PX; }
      else if (pt) d = Math.hypot(w.x - pt.x, w.y - pt.y) / DROP_WORLD;
      else return;
      if (d < bd) { bd = d; best = i; }
    });
    return bd <= 1 ? best : null;
  }
  // p: {phase, key (the grabbed handle's facade spec id), idx, which, evt}
  function onSyncDrag(p) {
    const c = focusedCase(); if (!c || !p) return;
    const evt = p.evt || {};
    if (p.phase === "start") {
      if (running || dbgActive() || !c.cmds[p.idx] || (p.which !== "in" && p.which !== "out")) return;
      if (armSrc || wireMode) cancelWireGhost();
      armSync = { idx: p.idx, which: p.which, key: p.key || null };
      if (selWire != null || selSync != null) { selWire = null; selWireRef = null; selSync = null; selSyncRef = null; selSyncCase = null; }
      syncTip = dragPoint(evt) || syncHandlePos(c, p.idx, p.which);
      drawSyncGhost();
      status(`synchronizing ${nameOf(c, p.idx)} — drag to another op's ${p.which === "out" ? "sync-in (left ◆)" : "sync-out (right ◆)"} and release (Esc cancels)`, "ok");
      return;
    }
    if (!armSync || (p.key && armSync.key && p.key !== armSync.key)) return;
    const fromOut = armSync.which === "out";
    const want = fromOut ? "in" : "out";
    const there = syncHandleAt(c, evt, want);
    const tgt = there === armSync.idx ? null : there;   // its own op: no target (not a refusal)
    const src = tgt == null ? null : (fromOut ? armSync.idx : tgt);
    const dest = tgt == null ? null : (fromOut ? tgt : armSync.idx);
    const chk = tgt == null ? null : doc.canSync(c, src, dest);
    const sl = tgt == null ? "" : `${nameOf(c, src)} → ${nameOf(c, dest)}`;
    if (p.phase === "move") {
      syncTip = (chk && chk.ok && syncHandlePos(c, tgt, want)) || dragPoint(evt) || syncTip;
      drawSyncGhost();
      if (tgt == null) status(`synchronizing ${nameOf(c, armSync.idx)} — drag to another op's sync handle and release (Esc cancels)`, "ok");
      else if (chk.ok) status(`release to synchronize ${sl}`, "ok");
      else status("✗ " + chk.reason, "bad");
      return;
    }
    if (p.phase !== "end") return;
    cancelSyncGesture();
    if (tgt == null) return status("synchro cancelled — release over another op's sync handle to synchronize");
    if (!chk.ok) { status("✗ synchro refused: " + chk.reason, "bad"); lastSyncRefusal = chk.reason; return; }
    const cmd = doc.addSync(c, src, dest);
    if (!cmd || cmd.error) { lastSyncRefusal = (cmd && cmd.error) || "refused"; return status("synchro refused: " + lastSyncRefusal, "bad"); }
    if (!commitApplied(cmd)) return;
    lastSyncRefusal = null;
    status(`synchronized ${sl} — ${nameOf(c, src)} finishes before ${nameOf(c, dest)} starts · ⌘Z undoes`, "ok");
  }
  let lastSyncRefusal = null;

  // the front-ortho client→world projection (headless fallback for a drag
  // point, and an op-drag end that carries no plane delta)
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

  // ── select: a tap on a facade wire (host.state.onSceneTap) ───────────────
  // The facade wire's spec carries meta {role:"wire", index}; the id is the
  // fallback (fx_ + slug(`d<deck>/wire/<i>`)) — the headless null stage keeps
  // no objects, and the id math is the same slug the facade is built with.
  function wireIndexOfSpec(specId) {
    if (!specId) return null;
    const o = stage && stage.objects && stage.objects.get ? stage.objects.get(specId) : null;
    const m = o && o.spec && o.spec.meta;
    if (m && m.role === "wire" && typeof m.index === "number") return m.index;
    const r = /^fx_d(\d+)_wire_(\d+)$/.exec(String(specId));
    return r && +r[1] === activeDeck ? +r[2] : null;
  }
  // select wire i of the focused case (null/absent clears). ONE selection:
  // a wire selection clears the op selection (and renderInspector drops the
  // wire when an op is selected after it).
  function selectWire(i) {
    const c = focusedCase();
    if (i == null || !c || !c.cons[i]) {
      const had = selWire != null;
      selWire = null; selWireRef = null;
      if (had) renderFacade();
      refreshInspector();
      return null;
    }
    selWire = i; selWireRef = c.cons[i];
    selSync = null; selSyncRef = null; selSyncCase = null;
    if (hostApi && hostApi.state && hostApi.state.selectedKey) hostApi.setState("selectedKey", null);
    renderFacade(); renderInspector(null);
    const w = c.cons[i];
    status(`wire ${nameOf(c, w.src[0])}.${w.src[1]} → ${nameOf(c, w.dest[0])}.${w.dest[1]} selected — Del unwires`, "ok");
    return i;
  }
  // ── synchros (S3): select by the midpoint mark, Del removes ─────────────
  // The mark's facade spec carries meta {role:"sync", part:"mark", index};
  // the id fallback is the slug fx_d<deck>_sync_<k>_mark (headless stage).
  function syncIndexOfSpec(specId) {
    if (!specId) return null;
    const o = stage && stage.objects && stage.objects.get ? stage.objects.get(specId) : null;
    const m = o && o.spec && o.spec.meta;
    if (m && m.role === "sync" && typeof m.index === "number") return m.index;
    const r = /^fx_d(\d+)_sync_(\d+)(?:_mark)?$/.exec(String(specId));
    return r && +r[1] === activeDeck ? +r[2] : null;
  }
  function syncHandleOfSpec(specId) {
    const o = specId && stage && stage.objects && stage.objects.get ? stage.objects.get(specId) : null;
    const m = o && o.spec && o.spec.meta;
    if (m && m.role === "sync-handle" && typeof m.opIndex === "number") return { idx: m.opIndex, which: m.which };
    const r = /^fx_d(\d+)_op_(\d+)_sync_(in|out)$/.exec(String(specId || ""));
    return r && +r[1] === activeDeck ? { idx: +r[2], which: r[3] } : null;
  }
  function syncText(c, s) { return `${nameOf(c, s.src)} → ${nameOf(c, s.dest)}`; }
  // select synchro k of the focused case (null/absent clears). ONE selection.
  function selectSync(k) {
    const c = focusedCase();
    if (k == null || !c || !Array.isArray(c.syncs) || !c.syncs[k]) {
      const had = selSync != null;
      selSync = null; selSyncRef = null; selSyncCase = null;
      if (had) renderFacade();
      refreshInspector();
      return null;
    }
    selSync = k; selSyncRef = c.syncs[k]; selSyncCase = c;
    selWire = null; selWireRef = null;
    if (hostApi && hostApi.state && hostApi.state.selectedKey) hostApi.setState("selectedKey", null);
    renderFacade(); renderInspector(null);
    status(`synchro ${syncText(c, c.syncs[k])} selected — Del removes it`, "ok");
    return k;
  }
  function deleteSelectedSync() {
    const c = focusedCase(); if (!c) return;
    if (selSync == null) return status("select a synchro first (click its arrow)", "bad");
    const cmd = doc.removeSync(c, selSync);
    if (!cmd || cmd.error) return status((cmd && cmd.error) || "unsync refused", "bad");
    if (!commitApplied(cmd)) return;
    selSync = null; selSyncRef = null; selSyncCase = null;
    status("synchro removed — ⌘Z undoes", "ok");
  }
  function onSceneTap(specId) {
    if (armSrc || wireMode || armSync) return;  // mid wiring/synchro gesture: not a selection
    const bd = bpDotOfSpec(specId);            // D4: a breakpoint dot toggles its breakpoint
    if (bd) { toggleBreakpoint(bd.kind, bd.index); return; }
    const bt = barTermOfSpec(specId);          // a bar socket: the same hint as an op's
    if (bt) { onPortTap({ node: bt.which + "0" }); return; }
    const wi = wireIndexOfSpec(specId);
    if (wi != null && debugPickItem("wire", wi)) return;   // STEP DEBUGGER: a ready wire delivers next
    if (wi != null) { selectWire(wi); return; }
    const si = syncIndexOfSpec(specId);
    if (si != null && debugPickItem("sync", si)) return;   // ...a ready synchro fires next
    if (si != null) { selectSync(si); return; }
    if (syncHandleOfSpec(specId)) { status("drag from a synchro handle (◆) to another op's handle to synchronize them", "ok"); return; }
    if (specId == null && selWire != null) selectWire(null);   // background tap drops it
    if (specId == null && selSync != null) selectSync(null);
  }
  // drags no hosted instance claims (host.state.onSceneDrag): a bar socket's
  // drag is a wiring gesture — handed to onSocketDrag exactly as flownode
  // hands it an op socket's (the facade spec id is both key and ghost end)
  function onSceneDrag(evt) {
    const sh = evt && syncHandleOfSpec(evt.id);
    if (sh) { onSyncDrag({ phase: evt.type || evt.phase, key: evt.id, idx: sh.idx, which: sh.which, evt }); return; }
    const bt = evt && barTermOfSpec(evt.id); if (!bt) return;
    onSocketDrag({ phase: evt.type, key: evt.id, sock: evt.id, opIndex: bt.idx, which: bt.which, term: bt.term, evt });
  }

  // ── delete: Del unwires the selected wire (frees its input, I-1) ─────────
  function deleteSelectedWire() {
    const c = focusedCase(); if (!c) return;
    if (selWire == null) return status("select a wire first (click it)", "bad");
    const cmd = doc.removeWire(c, selWire);
    if (cmd.error) return status(cmd.error, "bad");
    // a committed unwire: afterMutation's reconcileSelWire drops the selection
    // (its wire is gone); a refused one (read-only / mid-run) keeps it
    if (!commitApplied(cmd)) return;
    selWire = null; selWireRef = null;
    status("unwired — ⌘Z undoes", "ok");
  }
  // Del/Backspace deletes THE selection. There is one selection at a time
  // (op XOR wire), so the key routes to whichever is held: a selected wire
  // unwires; a selected op is removed with every wire touching it
  // (deleteSelectedOp → FlowDoc.removeOp, one undoable mutation).
  function deleteSelection() {
    if (armSrc || wireMode) return status("finish or Esc the wiring first", "bad");
    if (selWire != null) return deleteSelectedWire();
    if (selSync != null) return deleteSelectedSync();
    if (selectedOpIndex() != null) return deleteSelectedOp();
    status("select an op, a wire or a synchro first (click it)", "bad");
  }

  // ── render: facade + instances + chrome ───────────────────────────────────
  function renderAll() { syncDebugState(); renderFacade(); renderInstances(); renderChrome(); }

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
    status(`${deckCount} deck${deckCount === 1 ? "" : "s"} · ${focusedCase() ? focusedCase().cmds.length : 0} ops · ${source ? (dbgActive() ? "debugging — edits locked" : "editing on") : "read-only (no source command)"}`);
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
  function clearSelection() { if (hostApi) hostApi.setState("selectedKey", null); const had = selWire != null || selSync != null; selWire = null; selWireRef = null; selSync = null; selSyncRef = null; selSyncCase = null; if (had) renderFacade(); renderInspector(null); }

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
    // OLD RUNTIMES: a flow-wide warn row while the flow has synchros and the
    // instance's flowlang predates S1. The first render with synchros asks
    // crate_versions (once) and re-renders when it answers.
    const rw = runtimeWarning();
    if (rw) lastDiags = lastDiags.concat([{ code: "RT", severity: "warn", message: rw.text, runtime: true }]);
    else if (!runtimeP && flowSyncCount()) checkRuntime().then(() => { if (runtimeWarning()) renderDiagnostics(); });
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
    if (selWire != null) { selWire = null; selWireRef = null; renderFacade(); }
    hostApi.setState("selectedKey", `d${activeDeck}_op${i}`);
    refreshInspector();
    const op = c.cmds[i];
    status(`op ${op.name || op.type} selected — Del deletes it (and its wires)`, "ok");
    return i;
  }
  // a tap on an op BODY: flownode.click hands it here via host.state.onOpSelect
  // — the op twin of onSceneTap's wire pick, so op selection takes the SAME
  // path as wire selection (one selection, op XOR wire; inspector + status
  // follow; Del then deletes it). Mid wiring gesture the tap only moves the
  // emphasis, as before; a key from another deck never selects op i here.
  function onOpSelect(p) {
    const key = p && p.key; if (!key || !hostApi) return null;
    const m = /^d(\d+)_op(\d+)$/.exec(key);
    // STEP DEBUGGER: a tap on a READY op of the top frame picks it (it runs next)
    if (m && +m[1] === activeDeck && debugPickItem("op", +m[2])) return null;
    if (armSrc || wireMode || !m || +m[1] !== activeDeck) { hostApi.setState("selectedKey", key); return null; }
    return selectOp(+m[2]);
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
    // ONE selection: selecting a wire clears selectedKey, so a key alongside
    // a wire means an op was selected AFTER it — the op wins
    if (selWire != null && key) { selWire = null; selWireRef = null; renderFacade(); }
    // STEP DEBUGGER (D3): a session owns the inspector (edits are locked)
    if (dbgActive()) {
      if (selSync != null && key) { selSync = null; selSyncRef = null; selSyncCase = null; renderFacade(); }
      renderDebugInspector(body, key); return;
    }
    if (selWire != null) {
      const c = focusedCase(); const w = c && c.cons[selWire];
      if (!w) { selWire = null; selWireRef = null; body.innerHTML = ""; return; }
      body.innerHTML = `<p class="fe-ed-head"><b>wire</b> ${esc(nameOf(c, w.src[0]))}.${esc(w.src[1])} → ${esc(nameOf(c, w.dest[0]))}.${esc(w.dest[1])}</p>` +
        `<p class="fe-empty"><kbd>Del</kbd> unwires · click a palette op to <b>splice</b> it into this wire</p>`;
      const btns = edBtns(body);
      edButton(btns, "unwire", "fe-del fe-unwire danger", deleteSelectedWire);
      return;
    }
    // a synchro (S3): same one-selection rule — an op key alongside wins
    if (selSync != null && key) { selSync = null; selSyncRef = null; selSyncCase = null; renderFacade(); }
    if (selSync != null) {
      const c = focusedCase(); const s = c && Array.isArray(c.syncs) && c.syncs[selSync];
      if (!s) { selSync = null; selSyncRef = null; selSyncCase = null; body.innerHTML = ""; return; }
      body.innerHTML = `<p class="fe-ed-head"><b>synchro</b> ${esc(syncText(c, s))}</p>` +
        `<p class="fe-empty">${esc(nameOf(c, s.src))} must finish before ${esc(nameOf(c, s.dest))} starts — no data flows. <kbd>Del</kbd> removes it</p>`;
      const btns = edBtns(body);
      edButton(btns, "unsync", "fe-del fe-unsync danger", deleteSelectedSync);
      return;
    }
    const m = key && /^d(\d+)_op(\d+)$/.exec(key);
    const c = focusedCase();
    if (m && c && c.cmds[+m[2]]) renderOpEditor(body, c, +m[2], key);
    else if (c) renderSignatureEditor(body, c);
    else body.innerHTML = `<p class="fe-empty">Select an element. Drag between an input and an output socket (either end) to wire.</p>`;
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
    edNote(body, op.type === "local" ? "dblclick to drill in · Del deletes" : "drag socket ↔ socket wires · drag body moves · Enter edits · Del deletes");
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
    edNote(body, "Select an element. Drag between an input and an output socket (either end) to wire.");
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
    // selectedOpIndex is deck-aware: a selection key from another deck
    // (d<k>_op<i>, k ≠ activeDeck) must never delete op i of the focused case
    const c = focusedCase(); const i = selectedOpIndex();
    if (i == null || !c) return;
    const op = c.cmds[i]; if (!op) return;
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
  // The schedule is local and pure (design §3.5 — the platform returns no
  // per-wire values): flowdoc.propagationRounds gives the DRY harness's firing
  // order. A LIVE run is the stepper's continue (P5): its real events ride
  // through rideRunEvents (below runFlow), and which CASES it went through is
  // the tape's own. One dev:flowtoken instance per leg is addControl'd into
  // the scenehost, seeded with its round; ONE shared clock starts them
  // together, so the token behaviors deliver round by round and report via
  // host.state.onTokenDelivered. The editor schedules and audits; the motion
  // is the behavior's.
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  function wireEnd(c, end, which) {
    return terminalWorld(c, end[0], which, end[1]) || terminalWorld(c, end[0], which === "out" ? "in" : "out", end[1]) || null;
  }
  // ── the run's CASE PATH (a `next` rule moves the run to the next case) ────
  // P5: a LIVE run IS the stepper's continue (the run is one debug session),
  // so the case path is the TAPE's — the stepper's own events name the op
  // whose next/terminate/fail rule ended each case (no inference, nothing
  // predicted). A DRY run (the no-source harness) is the only one still
  // scheduled from propagationRounds' prediction: it assumes every op
  // succeeds, so a non-match op's rule fires when its value is true and a
  // match op's rule is unknown (noted, not taken). Segments (root first):
  // {deck, end, stopAt, inferred} — deck/end as the tape reports them;
  // stopAt/inferred are the DRY plan's only (a live segment leaves them null).
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const frames = (n) => new Promise((res) => { const step = () => (n-- <= 0 ? res() : requestAnimationFrame(step)); step(); });
  function dryPlan() {
    const chain = caseChain(focusRoot());
    const segments = [], notes = [];
    for (let d = activeDeck; d < chain.length; d++) {
      const c = chain[d];
      const seg = { deck: d, end: "done", stopAt: null, inferred: false };
      for (const i of propagationRounds(c).order || []) {
        const op = c.cmds[i]; const cond = op && op.type !== "constant" && op.condition;
        if (!cond || !["next", "terminate", "fail"].includes(cond.rule)) continue;
        if (op.type === "match") { notes.push(`case ${d + 1}: ${nameOf(c, i)}'s ${cond.rule} rule depends on values — a live run follows it`); continue; }
        if (cond.value === true) { seg.end = cond.rule; seg.stopAt = i; break; }
      }
      segments.push(seg);
      if (seg.end !== "next") break;
      if (!chain[d + 1]) { seg.end = "next-missing"; notes.push(`case ${d + 1}: a next rule fires but there is no next case (I-4)`); break; }
    }
    return { mode: "dry", segments, notes };
  }
  // the jump pipe's two legs for op i of the focused case (flowproject.toScene
  // draws them): rise tab → bead (that link hangs FROM the bead, so it is
  // ridden in reverse), then dive bead → the next case's input bar
  function jumpLegs(c, i) {
    const jp = jumpPoints(c, i, caseChain(focusRoot())[activeDeck + 1]);
    const id = (sfx) => "fx_" + slug(`d${activeDeck}/op/${i}/${sfx}`);
    return [
      { wire: id("jumpup"), from: jp.bead, to: jp.tab, reverse: true },
      { wire: id("jumpdn"), from: jp.bead, to: jp.entry },
    ];
  }
  // animate ONE case: its wires round by round (sched is already cut at the
  // rule's op), then the jump legs as two more rounds — on its own clock id.
  // SYNCHROS (S3): each fired synchro PULSES — one sync-coloured token rides
  // its straight link in the round its src completes (sched.syncRounds,
  // parallel to rounds; a round may carry only synchros).
  async function animateSegment(c, sched, jumpOp, dur, reduced) {
    const rid = ++runSeq;
    const { rounds, unreached } = sched;
    const syncRounds = sched.syncRounds || [];
    const nRounds = Math.max(rounds.length, syncRounds.length);
    const legs = jumpOp == null ? [] : jumpLegs(c, jumpOp);
    const nSync = syncRounds.reduce((n, r) => n + r.length, 0);
    const expected = rounds.reduce((n, r) => n + r.length, 0) + nSync + legs.length;
    const started = performance.now();
    const delivered = [], keys = [];
    if (!expected) {                           // nothing travels: let the case be seen
      await sleep(reduced ? 150 : 400);
      return Object.assign(auditRun(rid, rounds, unreached, [], true, Math.round(performance.now() - started)), { skipped: sched.skipped || [], jumped: false, tokensHosted: 0 });
    }
    let finish; const allDone = new Promise((res) => { finish = res; });
    hostApi.setState("run", { id: rid, t0: null });
    hostApi.setState("onTokenDelivered", (ev) => {
      if (!ev || ev.runId !== rid) return;
      delivered.push({ k: ev.k, round: ev.round });
      if (delivered.length >= expected) finish(true);
    });
    try {
      const syncTint = syncColorOf();
      for (let r = 0; r < nRounds; r++) {
        for (const k of rounds[r] || []) {
          const w = c.cons[k]; if (!w) continue;
          const key = `run${rid}_w${k}`;
          await hostApi.addControl("dev", "flowtoken", {
            runId: rid, k, round: r, dur, reduced,
            wire: "fx_" + slug(`d${activeDeck}/wire/${k}`),
            from: wireEnd(c, w.src, "out"), to: wireEnd(c, w.dest, "in"),
          }, key);
          keys.push(key);
        }
        for (const j of syncRounds[r] || []) {
          const s = (c.syncs || [])[j]; if (!s) continue;
          const key = `run${rid}_s${j}`;
          await hostApi.addControl("dev", "flowtoken", {
            runId: rid, k: "sync" + j, round: r, dur, reduced, straight: true, tint: syncTint,
            wire: "fx_" + slug(`d${activeDeck}/sync/${j}`),
            from: syncHandlePos(c, s.src, "out"), to: syncHandlePos(c, s.dest, "in"),
          }, key);
          keys.push(key);
        }
      }
      for (let j = 0; j < legs.length; j++) {
        const key = `run${rid}_j${j}`;
        await hostApi.addControl("dev", "flowtoken", Object.assign({ runId: rid, k: "jump" + j, round: nRounds + j, dur, reduced }, legs[j]), key);
        keys.push(key);
      }
      // every token is booted — start the ONE clock they all ride
      hostApi.setState("run", { id: rid, t0: performance.now() });
      const budget = ((nRounds + legs.length) * dur + 3) * 1000;
      const complete = await Promise.race([allDone, new Promise((res) => setTimeout(() => res(false), budget))]);
      const wires = delivered.filter((d) => typeof d.k === "number");
      const pulses = delivered.filter((d) => typeof d.k === "string" && d.k.startsWith("sync"));
      const A = auditRun(rid, rounds, unreached, wires, !!complete, Math.round(performance.now() - started));
      A.skipped = sched.skipped || [];
      A.jumped = legs.length > 0 && delivered.filter((d) => typeof d.k === "string" && d.k.startsWith("jump")).length === legs.length;
      A.syncRounds = syncRounds;
      A.syncsPulsed = pulses.map((d) => +d.k.slice(4));
      A.syncsInRound = pulses.every((d) => (syncRounds[d.round] || []).includes(+d.k.slice(4)));
      A.syncsUnreached = sched.syncsUnreached || [];
      A.tokensHosted = keys.length;
      return A;
    } finally {
      for (const key of keys) { try { hostApi.removeControl(key); } catch (e) {} }
      hostApi.setState("run", null);
      hostApi.setState("onTokenDelivered", null);
    }
  }
  const pathText = (segs) => segs.map((s) => `case ${s.deck + 1}`).join(" → ")
    + ({ terminate: " (terminated)", fail: " (failed)", panic: " (panicked)", "next-missing": " (next with no next case, I-4)" }[segs.length ? segs[segs.length - 1].end : ""] || "");
  async function runFlow(plan) {
    if (running || !hostApi) return null;
    plan = plan || dryPlan();
    if (!plan.segments.length) { status("nothing to run", "bad"); return null; }
    if (armSrc || wireMode) { cancelWireGhost(); }
    running = true;
    const runBtn = $(".fe-run"); if (runBtn) { runBtn.disabled = true; runBtn.classList.add("running"); runBtn.textContent = "running…"; }
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduced ? 0.34 : 0.42;
    const started = performance.now();
    const segments = [];
    let error = null;
    try {
      for (const seg of plan.segments) {
        if (seg.deck !== activeDeck) {         // follow the run into the case it moved to
          setActiveDeck(seg.deck);
          await frames(2);                     // the new facade's links resolve their ends
          await sleep(reduced ? 120 : 300);
        }
        const c = focusedCase(); if (!c) break;
        const sched = propagationRounds(c, seg.stopAt != null ? { stopAt: seg.stopAt } : {});
        const jumpOp = seg.end === "next" && seg.stopAt != null && caseChain(focusRoot())[seg.deck + 1] ? seg.stopAt : null;
        const A = await animateSegment(c, sched, jumpOp, dur, reduced);
        segments.push(Object.assign({}, seg, A));
      }
    } catch (e) {
      error = String(e && e.message ? e.message : e);
    } finally {
      running = false;
      if (runBtn) { runBtn.disabled = false; runBtn.classList.remove("running"); runBtn.textContent = "run ▸"; }
    }
    const R = lastRun = {
      mode: plan.mode, segments, notes: plan.notes || [], untraced: plan.untraced || null, error,
      path: segments.map((s) => ({ deck: s.deck, end: s.end, stopAt: s.stopAt, inferred: s.inferred, jumped: !!s.jumped })),
      rounds: [].concat(...segments.map((s) => s.rounds)),
      unreached: [].concat(...segments.map((s) => s.unreached)),
      delivered: [].concat(...segments.map((s) => s.delivered)),
      complete: !error && segments.length === plan.segments.length && segments.every((s) => s.complete),
      inOrder: !error && segments.length > 0 && segments.every((s) => s.inOrder),
      ms: Math.round(performance.now() - started),
    };
    R.tokensHosted = segments.reduce((n, s) => n + (s.tokensHosted || 0), 0);
    const n = R.delivered.length, deliveries = `${n} deliver${n === 1 ? "y" : "ies"}`;
    pushJournal(`${plan.mode === "dry" ? "dry run" : "run"} · ${pathText(segments)} · ${deliveries}` + (R.unreached.length ? ` · ${R.unreached.length} unreached` : ""));
    if (error) status("run failed: " + error, "bad");
    else if (R.complete && R.inOrder) status(`${plan.mode === "dry" ? "dry run" : "ran"} · ${pathText(segments)} · ${deliveries} · ${R.ms}ms`, "ok");
    else status(`run incomplete · ${n} delivered`, "bad");
    gate(".fe-g-run", !!(R.complete && R.inOrder), R.complete ? `${deliveries}, ${R.rounds.length} rounds, ${pathText(segments)}, in order` : "incomplete");
    renderRunInspector(R);
    return R;
  }
  // ── P5: the run's case path and events come from the stepper ──────────────
  // The case path is walked off the run's EVENT stream (fin.events): a `next`
  // event {from, op, to} ends its case and moves on, the final case ends with
  // the run's done/stall/error. Only the LAST case's root frame is still on
  // the stack (earlier cases closed and left it), so the frames cannot report
  // the whole path — the events can. end ∈ done|next|terminate|fail|panic|
  // stall|next-missing (pathText's suffix map covers them).
  function casePathFromEvents(events) {
    const path = [];
    let cur = -1;
    for (const ev of events || []) {
      if (!ev || !ev.type) continue;
      if (ev.type === "enter" || (ev.type === "seed" && cur < 0)) {
        if (ev.case != null && ev.case !== cur) { if (cur >= 0) path.push({ deck: cur, end: "next", stopAt: null, inferred: false }); cur = ev.case; }
      } else if (ev.type === "next" && ev.from != null) {
        path.push({ deck: ev.from, end: "next", stopAt: ev.op != null ? ev.op : null, inferred: false });
        cur = ev.to != null ? ev.to : ev.from + 1;
      } else if (ev.type === "done" || ev.type === "stall" || ev.type === "error") {
        const c = ev.case != null ? ev.case : Math.max(0, cur);
        const end = ev.type === "done" ? (ev.fail ? "fail" : (ev.outcome && ev.outcome !== "ok" ? ev.outcome : "done")) : ev.type;
        path.push({ deck: c, end, stopAt: null, inferred: false });
        cur = -1;
      }
    }
    return path;
  }
  function runFailureText(ev, lastStop) {
    if (!ev) return `run ended without a done event (${lastStop || "?"})`;
    if (ev.type === "done" && ev.fail) return "the flow failed: a fail rule fired";
    if (ev.type === "done") return `run ended (${ev.outcome || "?"})`;
    if (ev.type === "stall" || ev.type === "error") return `${ev.type}: ${ev.msg || ev.reason || "no progress"}`;
    return `run stopped (${lastStop || ev.type || "?"})`;
  }
  // ride the stepper's REAL events on the editor's picture, grouped into
  // rounds by a shared readySeq — one dev:flowtoken per leg on one clock per
  // round (the run animation's own machinery). path rides the jump pipe after
  // a case's events (the tape carries no deliver INTO the next case). Events
  // not on this picture (a drilled frame's internals, trimmed continues) are
  // skipped — the ride never blocks or fails the result. Returns lastRun.
  async function rideRunEvents(events, path) {
    if (running || !hostApi) return null;
    if (armSrc || wireMode) cancelWireGhost();
    running = true;
    const runBtn = $(".fe-run"); if (runBtn) { runBtn.disabled = true; runBtn.classList.add("running"); runBtn.textContent = "running…"; }
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduced ? 0.34 : 0.42;
    const started = performance.now();
    const delivered = [], keys = [], pathSegs = [];
    let error = null, complete = true, inOrder = true, prevSeq = -1, round = -1, tokens = null, t0 = null;
    const clock = () => { t0 = performance.now(); hostApi.setState("run", { id: t0, t0 }); };
    const waitRound = async (ms2) => {
      if (!keys.length) return;
      const base = delivered.length, n = keys.length;
      await Promise.race([
        (async () => { while (delivered.length < base + n) await sleep(30); })(),
        sleep(ms2),
      ]);
      if (delivered.length < base + n) complete = false;
      for (const key of keys.splice(0)) { try { hostApi.removeControl(key); } catch (e) {} }
    };
    hostApi.setState("onTokenDelivered", (ev) => { if (ev && t0 && ev.runId === t0) delivered.push({ k: ev.k, round: ev.round }); });
    try {
      for (const ev of events) {
        if (!ev) continue;
        if (ev.type === "enter" && ev.frame && ev.frame.length) break;   // a drilled frame's events are not on this picture
        if (ev.type === "next" && ev.op != null && ev.from === activeDeck && caseChain(focusRoot())[ev.from + 1]) {
          await waitRound(6000);
          const legs = jumpLegs(focusedCase(), ev.op).filter((l) => l && l.from && l.to);
          round += 1;
          clock();
          for (let j = 0; j < legs.length; j++) {
            const key = `run_ev${ev.seq}_${j}`;
            await hostApi.addControl("dev", "flowtoken", Object.assign({ runId: t0, round, k: "jump" + j, dur, reduced }, legs[j]), key);
            keys.push(key);
          }
          await waitRound(Math.ceil(dur * 1000) + 1500);
          pathSegs.push({ deck: ev.from, end: "next", stopAt: ev.op, inferred: false });
          setActiveDeck(ev.to);
          await frames(2);
          await sleep(reduced ? 120 : 300);
          continue;
        }
        const legs = dbgLegs(focusedCase(), ev, false).filter((l) => l && l.from && l.to);
        if (!legs.length) continue;
        const seq = typeof ev.readySeq === "number" ? ev.readySeq : ev.seq;
        if (seq !== prevSeq) { await waitRound(6000); prevSeq = seq; round += 1; clock(); }
        for (let j = 0; j < legs.length; j++) {
          const { seq: _s, ...seed } = legs[j];
          const key = `run_ev${ev.seq}_${j}`;
          await hostApi.addControl("dev", "flowtoken", Object.assign({ runId: t0, round, dur, reduced }, seed), key);
          keys.push(key);
        }
      }
      await waitRound(6000);
    } catch (e) { error = String(e && e.message ? e.message : e); complete = false; }
    finally {
      for (const key of keys) { try { hostApi.removeControl(key); } catch (e) {} }
      hostApi.setState("run", null);
      hostApi.setState("onTokenDelivered", null);
      running = false;
      if (runBtn) { runBtn.disabled = false; runBtn.classList.remove("running"); runBtn.textContent = "run ▸"; }
    }
    for (let i = 1; i < delivered.length; i++) if (delivered[i].round < delivered[i - 1].round) inOrder = false;
    const segs = (path && path.length ? path : [{ deck: 0, end: "done", stopAt: null, inferred: false }])
      .map((p) => { const r = pathSegs.find((q) => q.deck === p.deck && q.end === "next"); return r ? Object.assign({}, p, { stopAt: r.stopAt, jumped: true }) : p; });
    const R = lastRun = {
      mode: "live", segments: segs, notes: [], untraced: path && path.length ? null : (path ? "no case path" : null), error,
      path: segs, rounds: [], unreached: [], delivered,
      complete, inOrder, ms: Math.round(performance.now() - started), tokensHosted: delivered.length,
    };
    const n = delivered.length, deliveries = `${n} deliver${n === 1 ? "y" : "ies"}`;
    pushJournal(`run · ${pathText(segs)} · ${deliveries} (real events)`);
    gate(".fe-g-run", complete && inOrder, `${deliveries} (real events), ${pathText(segs)}`);
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
    const chain = caseChain(focusRoot());
    const wl = (c, k) => { const w = c && c.cons[k]; return esc(w ? `${nameOf(c, w.src[0])}.${w.src[1]} → ${nameOf(c, w.dest[0])}.${w.dest[1]}` : `wire ${k}`); };
    const segs = R.segments && R.segments.length ? R.segments
      : [{ deck: activeDeck, end: "done", stopAt: null, rounds: R.rounds || [], unreached: R.unreached || [] }];
    const lbl = R.complete && R.inOrder ? (segs.length > 1 || segs[0].end !== "done" ? esc(pathText(segs)) : (R.mode === "live" ? "delivered in event order" : "delivered in propagation order")) : "incomplete";
    let h = `<p><b>${R.mode === "dry" ? "dry run" : "run"}</b> <span class="lbl">${lbl}${R.ms != null ? ` · ${R.ms}ms` : ""}</span></p>`;
    segs.forEach((s) => {
      const c = chain[s.deck];
      if (segs.length > 1 || s.end !== "done") {
        const sop = s.stopAt != null && c ? c.cmds[s.stopAt] : null;
        const nm = sop ? (sop.type === "match" || sop.type === "constant" ? `“${nameOf(c, s.stopAt)}”` : nameOf(c, s.stopAt)) : "?";
        const at = esc(nm) + (s.inferred ? " (inferred: this case has more than one such rule)" : "");
        const how = { done: "done", next: `next at ${at} → case ${s.deck + 2}`, terminate: `terminated at ${at}`, fail: `failed at ${at}`,
          panic: "panicked", "next-missing": `next at ${at}, but there is no next case (I-4)` }[s.end] || esc(s.end);
        h += `<p class="fe-run-case"><b>case ${s.deck + 1}</b> <span class="lbl">${how}</span></p>`;
      }
      h += `<ul class="fe-run-list">`;
      const sr = s.syncRounds || [];
      const sl = (j) => { const y = c && (c.syncs || [])[j]; return `<span class="fe-run-sync">${esc(y ? `${nameOf(c, y.src)} ⇢ ${nameOf(c, y.dest)}` : `synchro ${j}`)} (synchro)</span>`; };
      for (let r = 0; r < Math.max((s.rounds || []).length, sr.length); r++) {
        const parts = ((s.rounds || [])[r] || []).map((k) => wl(c, k)).concat((sr[r] || []).map(sl));
        h += `<li><span class="rd">${r + 1}</span>${parts.join(" · ")}</li>`;
      }
      if (s.jumped) h += `<li><span class="rd">↳</span>jump pipe → case ${s.deck + 2}</li>`;
      h += `</ul>`;
      if (s.unreached && s.unreached.length) h += `<p class="fe-empty">never fires (I-1/I-2): ${s.unreached.map((k) => wl(c, k)).join(" · ")}</p>`;
      if (s.syncsUnreached && s.syncsUnreached.length) h += `<p class="fe-empty">synchro never fires (its src never completes): ${s.syncsUnreached.map(sl).join(" · ")}</p>`;
    });
    if (R.untraced) h += `<p class="fe-empty">no case path (${esc(R.untraced)}): showing case 1's schedule only</p>`;
    for (const note of R.notes || []) h += `<p class="fe-empty">${esc(note)}</p>`;
    return h;
  }
  function renderRunInspector(R) {
    const body = $(".fe-inspect-body"); if (!body || !R) return;
    body.innerHTML = runRoundsHtml(R);
  }

  // ── P5 run parity: a LIVE editor runs on the stepper ─────────────────────
  // When the editor has a source (and is not the harness), the run button or
  // R key opens an args form over the params bar (doc.root.input, coerced by
  // bar type; no params means run at once). The run is ONE debug session:
  // debug_start (body {} = the SAVED body) + debug_step continue {wait}, and
  // its REAL events ride the editor in rounds afterwards — the same
  // interpreter path as the debugger, with the case path read straight off
  // the tape (no trace_flow sentinel, no predicted schedule). The payload
  // (the ended frame's out, or the run's failure) goes to the inspector with
  // an args sentence. The harness keeps the token-only (dry) run.
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
  // goFn/verb: the debugger reuses this form (goFn = debugStart, verb "debug")
  function openRunPicker(params, goFn, verb) {
    goFn = goFn || runLive; verb = verb || "run";
    const body = $(".fe-inspect-body"); if (!body) return goFn({});
    body.innerHTML = `<p><b>${verb}</b> <span class="lbl">arguments — the params bar</span></p>`;
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
    const go = document.createElement("button"); go.type = "submit"; go.className = "fe-run-go"; go.textContent = verb === "run" ? "run ▸" : verb + " ⏯";
    foot.append(cancel, go); form.appendChild(foot);
    const close = () => { renderInspector(hostApi && hostApi.state ? hostApi.state.selectedKey : null); if (ME.tabIndex >= 0) ME.focus(); status(verb + " cancelled"); };
    cancel.addEventListener("click", close);
    form.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const args = {};
      for (const { name, inp, type } of inputs) args[name] = coerceArg(inp.value, type);
      goFn(args);
    });
    body.appendChild(form);
    const first = form.querySelector("input"); if (first) first.focus();
    status(verb + " — fill in the params bar");
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
    // a flow with synchros: know the runtime BEFORE the run reports (cached).
    // The server runs the SAVED body, so ITS synchros are the ones ignored.
    let savedSyncs; try { savedSyncs = flowSyncCount(JSON.parse(savedBody)); } catch (e) { savedSyncs = flowSyncCount(); }
    if (savedSyncs || flowSyncCount()) { try { await checkRuntime(); } catch (e) {} }
    status(`running ${src.cmd}…`);
    const started = performance.now();
    const settle = (p) => p.then((r) => r || { status: "err", msg: "no response" }, (e) => ({ status: "err", msg: String(e && e.message ? e.message : e) }));
    // ONE execution on the stepper: debug_start (body {} = the SAVED body)
    // opens a session and debug_step continue {wait} runs it to the end —
    // the same interpreter path as the debugger. The case path is the tape's
    // (each case-ending event names its op), and the run's REAL events ride
    // the editor afterwards. A session the stepper refuses (never started)
    // falls back to the plain command run with no path; its other failures
    // ARE the run's result and are shown as-is — never a second execution.
    const st = await FD.client.start(src, {}, args);
    let session = st && st.session, r, path = null, untraced = null, tapeEvents = null;
    if (!session) {
      untraced = String((st && st.msg) || "no session").slice(0, 120);
      r = await settle(invokeP(src.lib, src.ctl, src.cmd, args));
    } else {
      const fin = await FD.client.step(session, "continue", { wait: true });
      tapeEvents = (fin && Array.isArray(fin.events) && !fin.events_truncated) ? fin.events : null;
      const st2 = await FD.client.state(session);
      path = casePathFromEvents(tapeEvents);
      const ev = (st2 && st2.event) || (fin && fin.event) || null;
      if (st2 && st2.status === "ok" && ev && ev.type === "done" && !ev.fail && ev.outcome === "ok") {
        r = Object.assign({ status: "ok" }, (ev.out && typeof ev.out === "object" && !Array.isArray(ev.out) ? ev.out : {}));
      } else if (st2 && st2.status === "ok" && st2.ended) {
        r = { status: "err", msg: runFailureText(ev, st2.last_stop) };
      } else {
        r = { status: "err", msg: String((fin && fin.msg) || (st2 && st2.msg) || "the run did not end") };
      }
      try { await FD.client.stop(session); } catch (e) {}
      session = null;
    }
    const ms = Math.round(performance.now() - started);
    // ride the run's REAL events from the ROOT case's first deck, where the
    // stepper starts (events not on this picture are skipped, never fatal);
    // untraced (no session): the dry schedule rides instead (runFlow's own)
    let R = null;
    if (focusPath.length === 1) {
      try { R = tapeEvents && tapeEvents.length ? await rideRunEvents(tapeEvents, path) : (untraced ? await runFlow() : null); } catch (e) { R = null; }
    }
    liveCall = false;
    if (runBtn) { runBtn.disabled = false; runBtn.classList.remove("running"); runBtn.textContent = "run ▸"; }
    const ok = r.status === "ok";
    // a server panic arrives as an HTML 500 page in msg; show its words
    const rawMsg = String(r.msg == null ? "" : r.msg);
    const msg = /^\s*</.test(rawMsg) ? rawMsg.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : rawMsg;
    const rw = runtimeWarning(savedSyncs);
    lastResult = { args, ok, result: r, msg, ms, unsaved, source: src, path, untraced,
      unsynchronized: rw ? { flowlang: rw.flowlang, min: rw.min, syncs: rw.n, text: rw.text } : null,
      tokens: R ? { complete: !!R.complete, inOrder: !!R.inOrder, delivered: R.delivered.length } : null };
    const via = untraced ? " · no case path" : (path && path.length ? ` · ${pathText(path)}` : "");
    const unsync = rw ? ` · UNSYNCHRONIZED (flowlang ${rw.flowlang} ignores synchros)` : "";
    pushJournal(ok ? `ran ${src.cmd}${via} · ${ms}ms${unsync}` : `run failed: ${msg}${unsync}`);
    if (ok && rw) status(`ran UNSYNCHRONIZED — flowlang ${rw.flowlang} ignores synchros · ${ms}ms`, "warn");
    else if (ok) status(`ran${via} · ${ms}ms` + (R && R.complete && R.inOrder ? ` · ${R.delivered.length} ${R.delivered.length === 1 ? "delivery" : "deliveries"} in order` : ""), "ok");
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
    if (L.unsynchronized) h += `<p class="fe-run-unsync">⚠ ran UNSYNCHRONIZED: flowlang ${esc(L.unsynchronized.flowlang)} predates synchros (need ≥ ${esc(L.unsynchronized.min)}), so the server ignored this flow's ${L.unsynchronized.syncs} synchro${L.unsynchronized.syncs === 1 ? "" : "s"}. The replay below draws the order the synchros ASK for, not the order that ran.</p>`;
    if (R && R.rounds && R.rounds.length) h += runRoundsHtml(R);
    body.innerHTML = h;
  }

  // ── STEP DEBUGGER (flow step debugger P4) ────────────────────────────────
  // A debug SESSION (dev.flowstep P3: a recorded tape — step / back / goto /
  // continue / breakpoints) runs the CURRENT body — unsaved edits included
  // (doc.serialize()) — under the stepper; P5: the run button is the same
  // session + a continue over the SAVED body, so run and debug share the one
  // interpreter path. Every move is one debug_step then
  // one debug_state, and the editor only DRAWS that state: dev:flowdebug maps
  // the frames onto the doc's case objects, the focus FOLLOWS the top frame
  // (drill into local frames, the case it runs), flownode plates show each
  // op's state via host.state.dbg (waiting / ready / running / done /
  // skipped), the facade tints wires and synchros, and a tap on a READY op /
  // wire / synchro picks it (mode into, pick {kind, index}). Edits are locked
  // while a session is open (its tape describes THIS body); stop (⇧F5)
  // unlocks. Without a source the harness's command names the session (the
  // body debugged is still the editor's own).
  let dbg = null;            // { session, src, args, st, views, busy, last, follow, sig }
  let bps = [];              // D4 breakpoints { kind, ref, root } - the EDITOR's, kept across sessions
  let lastBpDots = [];       // D4: the facade breakpoint dots the last render drew (checks)
  let dbgPollT = null;
  let lastFacadeDbg = [];    // the facade specs the last render tinted (checks)
  const dbgSrc = () => source || { lib: "scratch", ctl: "skills", cmd: "flowedit3d_body" };
  function dbgActive() { return !!(dbg && dbg.session); }
  function dbgColors() {
    const cs = getComputedStyle(ME);
    const pick = (n, d) => { const v = String(cs.getPropertyValue(n) || "").trim(); return /^#[0-9a-f]{3,8}$/i.test(v) ? v : d; };
    return { ready: pick("--fe-dbg-ready", "#f0a63c"), running: pick("--fe-dbg-running", "#56a3d9"),
      done: pick("--fe-dbg-done", "#62bd8c"), skipped: pick("--fe-dbg-skipped", "#6b6f78") };
  }
  // the session frame running the FOCUSED case (null: not debugging, or no
  // frame runs it — e.g. the user walked to another deck)
  function dbgDeckView() { return dbgActive() && dbg.views ? FD.deckView(dbg.views, focusRoot(), activeDeck) : null; }
  // the focused case's op states → host.state.dbg (flownode's plate reads it)
  function syncDebugState() {
    if (!hostApi) return;
    const dv = dbgDeckView();
    hostApi.setState("dbg", dv ? { deck: activeDeck, ops: dv.ops.slice(), colors: dbgColors(), cursor: dbg.st ? dbg.st.cursor : 0 } : null);
    syncBpState();
  }
  function startDebug() {
    if (dbgActive()) return null;
    if (running || liveCall) { status("a run is in progress", "bad"); return null; }
    const params = Object.entries((doc && doc.root && doc.root.input) || {});
    if (!params.length) return debugStart({});
    return openRunPicker(params, debugStart, "debug");
  }
  async function debugStart(args) {
    if (running || liveCall || disposed) return null;
    if (dbgActive()) await debugStop();
    if (armSrc || wireMode) cancelWireGhost();
    if (armSync) cancelSyncGesture();
    let body; try { body = JSON.parse(snap()); } catch (e) { status("debug: body unreadable — " + e.message, "bad"); return null; }
    const src = dbgSrc();
    status(`debug: opening a session on ${src.cmd}…`);
    const r = await FD.client.start(src, body, args || {});
    if (!r || r.status !== "ok" || !r.session) { status("debug start failed: " + ((r && r.msg) || "no session"), "bad"); return r; }
    dbg = { session: r.session, src, args: args || {}, st: null, views: [], busy: false, last: r, follow: true, sig: "", unsaved: dirty,
      boundary: typeof r.boundary === "string" ? r.boundary : "", crossed: [] };   // R3: the server's session boundary, shown verbatim
    dbgTape = []; dbgTapeCursor = -1;                    // D5: a fresh tape
    ME.classList.add("fe-debugging");
    pushJournal(`debug session · ${src.cmd}` + (dirty ? " (unsaved body)" : ""));
    if (bpPlaces().length) await sendBreakpoints();   // D4: the editor's breakpoints ride every session
    await debugRefresh();
    renderInspector(hostApi && hostApi.state ? hostApi.state.selectedKey : null);
    status(`debugging ${src.cmd} — F11 into · F10 over · F5 continue · ⇧F5 stop`, "ok");
    return r;
  }
  // one move: into / over / out / continue / back / goto / pause / run_to …
  async function debugStep(mode, pick) {
    if (!dbgActive()) return (mode === "into" || mode === "over" || mode === "continue") ? startDebug() : null;
    if (dbg.busy) return null;
    if (dbg.st && dbg.st.running && mode !== "pause") { status("debug: a continue is running — pause first", "bad"); return null; }
    const d = dbg; d.busy = true;
    if (mode !== "pause") d.follow = true;     // D3: a frame focused in the stack holds only until the next move
    const prevEv = d.st ? d.st.event : null;   // the event a back(1) undoes
    try {
      const r = await FD.client.step(d.session, mode, pick || {});
      if (dbg !== d) return r;                 // stopped meanwhile
      d.last = r;
      if (!r || r.status !== "ok") {
        const msg = String((r && r.msg) || "no reply");
        status(`debug ${mode} refused: ${msg}`, "bad");
        if (/session/i.test(msg) && /(no such|no debug session|unknown|not found|gone|missing|reaped)/i.test(msg)) debugEnded("the session is gone (reaped after idling?)");
        return r;
      }
      // D4: why this move stopped (over/out/run_to: the reply says; a
      // continue's comes with the poll that sees it end)
      d.stop = r.running ? null : { stopped: String(r.stopped || ""), hit: r.hit || null, mode };
      // R3: back/goto over opaque rust/python command steps restores the
      // interpreter, not the world - the server lists those steps
      // (crossed_side_effects); the bar says so until the next move
      d.crossed = Array.isArray(r.crossed_side_effects) ? r.crossed_side_effects.slice() : [];
      // D2: what this move SHOWS — its events (a back(1): the undone one, in
      // reverse); continue/goto/pause/back(n) only redraw
      const back1 = mode === "back" && !!prevEv && !(pick && pick.count > 1);
      const evs = back1 ? [prevEv] : (!r.running && Array.isArray(r.events) && !r.events_truncated ? r.events : []);
      // D5: the timeline's tape: every reply's event span (a move's own events,
      // or continue/back(n)/goto's span) records its steps' events
      if (!r.running && Array.isArray(r.events) && !r.events_truncated) dbgRecordEvents(r.events, r.cursor);
      const ride = { mode, reverse: back1, events: evs.map((e) => e.seq), a: null, b: null };
      if (evs.length) ride.a = await dbgShow(evs, back1, null);   // on the picture as it stands
      if (dbg !== d) return r;
      await debugRefresh();
      // flew to the op going IN: the drilled deck is framed whole once drawn
      if (ride.a && ride.a.fly && dbg === d && focusPath.length > ride.a.depth) frameDeck();
      if (evs.length && dbg === d) ride.b = await dbgShow(evs, back1, ride.a);   // where the focus went
      d.lastRide = ride;
      if (r.running) debugPoll();
      return r;
    } finally { d.busy = false; renderDebugBar(); }
  }
  async function debugRefresh() {
    if (!dbgActive()) return null;
    const d = dbg;
    const st = await FD.client.state(d.session);
    if (dbg !== d) return null;
    if (!st || st.status !== "ok") {
      const msg = String((st && st.msg) || "no reply");
      if (/no debug session|reaped/i.test(msg)) { debugEnded("the session is gone (reaped after idling?)"); return null; }
      status("debug state failed: " + msg, "bad"); return null;
    }
    const sig = `${st.cursor}|${st.length}|${st.running}|${st.hash}`;
    d.st = st;
    if (sig === d.sig) { renderDebugBar(); return st; }   // a poll that saw no move
    d.sig = sig;
    d.views = FD.frameViews(doc.root, st);
    const moved = d.follow ? debugFollow() : false;
    if (moved) renderAll(); else { syncDebugState(); renderFacade(); }
    renderDebugBar();
    refreshInspector();
    return st;
  }
  // follow the TOP frame: drill to the deepest frame the editor holds (a
  // command frame's callee is not in this doc — the focus stays on its
  // caller) and show the case it runs. Returns true when the focus moved.
  function debugFollow() {
    const chain = FD.focusChain(dbg.views); if (!chain.length) return false;
    const deep = chain[chain.length - 1];
    const same = chain.length === focusPath.length && chain.every((x, k) => focusPath[k].root === x.root) && activeDeck === deep.case;
    if (same) return false;
    focusPath = chain.map((x, k) => (k === 0 ? { root: doc.root, title: "case 1" } : { root: x.root, op: x.op, title: x.title }));
    activeDeck = deep.case;
    cancelWireGhost();
    selWire = null; selWireRef = null; selSync = null; selSyncRef = null; selSyncCase = null;
    if (hostApi) hostApi.setState("selectedKey", null);
    return true;
  }
  // a tap on a READY item of the top frame runs it next; anything else is
  // not the debugger's (the tap selects, as always)
  function debugPickItem(kind, index) {
    if (!dbgActive() || (dbg.st && dbg.st.running)) return false;
    const dv = dbgDeckView(); if (!dv || !dv.top) return false;
    const s = kind === "op" ? dv.ops[index] : kind === "wire" ? dv.wires[index] : dv.syncs[index];
    if (s !== "ready") return false;
    debugStep("into", { kind, index });
    return true;
  }
  // ── D2: every move SHOWS what it moved ────────────────────────────────────
  // A step's events ride the picture: each deliver rides its wire, each fired
  // synchro pulses down its straight link, a next rule rides the jump pipe
  // out of the case — one dev:flowtoken per leg on ONE shared clock (the run
  // animation's machinery: host.state.run + onTokenDelivered), legs in tape
  // order. Events on the picture AS IT STANDS ride first, then the state
  // redraws (the wire turns delivered, the focus follows); events on the
  // picture the focus moved to ride after the redraw. A drill (enter/leave of
  // a local op) flies the orbit to the op on its parent's picture — before
  // the redraw going in, after it coming out. back(1) shows the undone event
  // in REVERSE: the token rides dest → src, the jump pipe is climbed back,
  // the drill flies the other way. continue/goto/pause/back(n) only redraw
  // (their replies carry no events). FD.rideEvents/drillEvents decide which
  // events belong to a picture; the geometry is the run animation's own.
  const DBG_RIDE_MAX = 16;
  function dbgLegs(c, ev, reverse) {
    const id = (sfx) => "fx_" + slug(`d${activeDeck}/${sfx}`);
    if (ev.type === "deliver") {
      const w = c.cons[ev.wire]; if (!w) return [];
      return [{ k: "w" + ev.wire, seq: ev.seq, wire: id(`wire/${ev.wire}`), from: wireEnd(c, w.src, "out"), to: wireEnd(c, w.dest, "in"), reverse: !!reverse }];
    }
    if (ev.type === "sync") {
      const s = (c.syncs || [])[ev.sync]; if (!s) return [];
      return [{ k: "s" + ev.sync, seq: ev.seq, straight: true, tint: syncColorOf(), wire: id(`sync/${ev.sync}`),
        from: syncHandlePos(c, s.src, "out"), to: syncHandlePos(c, s.dest, "in"), reverse: !!reverse }];
    }
    if (ev.type === "next" && ev.op != null && c.cmds[ev.op] && caseChain(focusRoot())[activeDeck + 1]) {
      const legs = jumpLegs(c, ev.op).map((l, j) => Object.assign({ k: "j" + j, seq: ev.seq }, l));
      return reverse ? legs.reverse().map((l) => Object.assign({}, l, { reverse: !l.reverse })) : legs;
    }
    return [];
  }
  // ride the legs one after another (leg j in round j) and wait for them all
  async function dbgRide(legs) {
    if (!legs.length || !hostApi || disposed) return null;
    const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = Math.max(0.12, Math.min(reduced ? 0.2 : 0.32, 2.4 / legs.length));
    const rid = ++runSeq, keys = [], got = [];
    const started = performance.now();
    let finish; const allDone = new Promise((res) => { finish = res; });
    hostApi.setState("run", { id: rid, t0: null });
    hostApi.setState("onTokenDelivered", (e) => { if (!e || e.runId !== rid) return; got.push(e.k); if (got.length >= legs.length) finish(true); });
    try {
      for (let j = 0; j < legs.length; j++) {
        const { seq, ...seed } = legs[j];
        const key = `dbg${rid}_${j}`;
        await hostApi.addControl("dev", "flowtoken", Object.assign({ runId: rid, round: j, dur, reduced }, seed), key);
        keys.push(key);
      }
      hostApi.setState("run", { id: rid, t0: performance.now() });
      const complete = await Promise.race([allDone, sleep((legs.length * dur + 2) * 1000).then(() => false)]);
      return { rid, hosted: keys.length, delivered: got.slice(), complete: !!complete,
        inOrder: got.length === legs.length && got.every((k, j) => k === legs[j].k),
        reverse: legs.map((l) => !!l.reverse), dur, ms: Math.round(performance.now() - started) };
    } finally {
      for (const key of keys) { try { hostApi.removeControl(key); } catch (e) {} }
      hostApi.setState("run", null);
      hostApi.setState("onTokenDelivered", null);
    }
  }
  // show `evs` on the focused picture; `prior` = what the first pass showed
  async function dbgShow(evs, reverse, prior) {
    const dv = dbgDeckView(), c = focusedCase();
    if (!dv || !c || !hostApi || disposed) return null;
    const seen = prior ? prior.seqs : [];
    let on = FD.rideEvents(evs, dv).filter((ev) => !seen.includes(ev.seq));
    if (reverse) on = on.slice().reverse();
    if (on.length > DBG_RIDE_MAX) on = on.slice(0, DBG_RIDE_MAX);
    const legs = [];
    for (const ev of on) for (const L of dbgLegs(c, ev, reverse)) legs.push(L);
    const drill = prior && prior.fly ? [] : FD.drillEvents(evs, dv).filter((ev) => !seen.includes(ev.seq));
    if (!legs.length && !drill.length) return null;
    const out = { deck: activeDeck, depth: focusPath.length, path: dv.path, seqs: on.map((ev) => ev.seq).concat(drill.map((ev) => ev.seq)),
      legs: legs.map((l) => l.k), ride: null, fly: null };
    if (legs.length) out.ride = await dbgRide(legs);
    const ev = drill[0], op = ev ? c.cmds[ev.op] : null;
    if (op && op.pos && dbgActive()) {
      const target = { x: op.pos.x, y: op.pos.y, z: op.pos.z || 0 };
      out.fly = { op: ev.op, type: ev.type, target, flew: !!(stage && stage.flyTo) };
      if (stage && stage.flyTo) { stage.flyTo({ target }, 240); await sleep(260); }
    }
    return out;
  }
  // ── D5: the timeline scrubber ────────────────────────────────────────────
  // The session's TAPE as a strip: one tick per step (its event type), the
  // cursor at the tape position, the forked-off branches shaded at their fork
  // points. Click / drag / ←→ on the strip = goto that step (no execution:
  // goto replays or rolls back; it never runs code). Double-click = step to it
  // (into, one step). The same strip renders in the inspector, plus the branch
  // records (click = swap a branch back in at its fork point — the current tail
  // is kept as a branch). Ticks come from the steps' OWN views (each reply's
  // .event), recorded on dbgTape; continue/back(n)/goto record the reply's
  // event span.
  let dbgTape = [];              // step seq → its event ({} = not seen)
  let dbgTapeCursor = -1;        // the largest seq this session has reached
  let lastTlTicks = [];          // the ticks the last draw placed (checks)
  let tlDrag = null;             // a drag in progress on the top strip
  function dbgRecordEvents(evs, upto) {
    if (!Array.isArray(evs)) return;
    for (const e of evs) {
      if (!e || typeof e.seq !== "number") continue;
      dbgTape[e.seq] = { type: e.type || "?", seq: e.seq, user: e.pick === "user" };
      if (e.seq > dbgTapeCursor) dbgTapeCursor = e.seq;
    }
    if (typeof upto === "number" && upto > dbgTapeCursor) dbgTapeCursor = upto;
  }
  function tlTickTitle(ev, seq) {
    if (!ev) return `step ${seq}`;
    return `#${seq} ${ev.type}` + (ev.user ? " · your pick" : "");
  }
  function tlDrawInto(track, st) {
    if (!track) return [];
    track.replaceChildren();
    const base = st.base || 0, len = st.length || 0, cur = st.cursor || 0;
    // position against the deepest the tape has EVER been here: a fork's new
    // tail is shorter than the branch it replaced, and the branch band sits
    // past the (new) end — st.length alone would push it off the strip
    let far = len;
    for (const b of (st.branch_list || [])) { if (typeof b.at === "number" && typeof b.steps === "number") far = Math.max(far, b.at + b.steps); }
    const span = Math.max(1, far - base);
    const placed = [];
    for (let s = base; s < len; s++) {
      const ev = dbgTape[s];
      if (!ev) continue;                                     // a step we never saw (skipped ticks)
      const el = document.createElement("div");
      el.className = "fe-dbg-tl-tick t-" + String(ev.type).replace(/[^a-z]/g, "");
      el.dataset.seq = String(s);
      el.style.left = (((s - base) / span) * 100) + "%";
      el.title = tlTickTitle(ev, s);
      track.appendChild(el);
      placed.push({ seq: s, type: ev.type });
    }
    // the forked-off branches shade their fork point
    for (const b of (st.branch_list || [])) {
      if (typeof b.at !== "number" || b.at < base) continue;
      const el = document.createElement("div");
      el.className = "fe-dbg-tl-branch";
      el.style.left = (((b.at - base) / span) * 100) + "%";
      el.style.width = Math.max(1.2, (Math.max(1, Math.min(b.steps || 1, far - b.at)) / span) * 100) + "%";
      el.title = `branch ${b.id}: forked at step ${b.at} · ${b.steps} steps`;
      track.appendChild(el);
    }
    const cur2 = document.createElement("div");
    cur2.className = "fe-dbg-tl-cursor";
    cur2.style.left = (Math.max(0, Math.min(span, cur - base)) / span * 100) + "%";
    track.appendChild(cur2);
    return placed;
  }
  function tlSeqAt(track, clientX) {
    const st = dbg && dbg.st ? dbg.st : {};
    const base = st.base || 0, len = st.length || 0;
    const r = track.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
    return Math.max(base, Math.min(Math.max(base, len - 1), Math.round(base + frac * Math.max(0, len - 1 - base))));
  }
  function renderTimeline() {
    const on = dbgActive();
    const strip = $(".fe-dbg-timeline");
    if (strip) strip.hidden = !on;
    if (!on) { lastTlTicks = []; return; }
    const st = dbg.st || {};
    lastTlTicks = tlDrawInto($(".fe-dbg-tl-track"), st);
    const pos = $(".fe-dbg-tl-pos");
    if (pos) pos.textContent = `${st.cursor || 0} / ${st.length || 0}` + ((st.branches || 0) ? ` · ${st.branches} branch${st.branches === 1 ? "" : "es"}` : "");
  }
  async function debugBranch(id) {
    const st = dbg && dbg.st ? dbg.st : {};
    const bl = (st.branch_list || []).find((b) => b.id === id);
    if (bl && typeof bl.at === "number" && (st.cursor || 0) !== bl.at) {
      const g = await debugStep("goto", { seq: bl.at });
      if (!g || g.status !== "ok") return g;
    }
    return debugStep("branch", { id });
  }
  // the inspector's own strip + the branch records
  function renderTimelineInspector(body, m) {
    edLbl(body, `timeline · ${m.length} step${m.length === 1 ? "" : "s"} on the tape` + (m.branches ? ` · ${m.branches} branch${m.branches === 1 ? "" : "es"}` : ""));
    const track = document.createElement("div");
    track.className = "fe-dbgi-tl-track";
    track.title = "click = go to that step · double-click = step to it";
    body.appendChild(track);
    // place the ticks on the inspector strip (same data, own geometry)
    const base = 0, len = m.length || 0, span = Math.max(1, len);
    for (let s = 0; s < len; s++) {
      const ev = dbgTape[s]; if (!ev) continue;
      const el = document.createElement("div");
      el.className = "fe-dbgi-tl-tick t-" + String(ev.type).replace(/[^a-z]/g, "");
      el.style.left = ((s / span) * 100) + "%";
      el.title = tlTickTitle(ev, s);
      track.appendChild(el);
    }
    const cur = document.createElement("div");
    cur.className = "fe-dbgi-tl-cursor";
    cur.style.left = (Math.max(0, Math.min(span, m.cursor)) / span * 100) + "%";
    track.appendChild(cur);
    track.addEventListener("click", (e) => {
      if (!dbgActive() || (dbg.st && dbg.st.running)) return;
      const r = track.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
      const seq = Math.max(0, Math.min(Math.max(0, len - 1), Math.round(frac * Math.max(0, len - 1))));
      debugStep("goto", { seq });
    });
    track.addEventListener("dblclick", (e) => {
      if (!dbgActive() || (dbg.st && dbg.st.running)) return;
      const r = track.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
      const seq = Math.max(0, Math.min(Math.max(0, len - 1), Math.round(frac * Math.max(0, len - 1))));
      const cur2 = (dbg.st && typeof dbg.st.cursor === "number") ? dbg.st.cursor : 0;
      if (seq === cur2 + 1) debugStep("into");
      else if (seq !== cur2) debugStep("goto", { seq });
    });
    // the branches (a fork kept the tail it replaced)
    const bl = m.branchList || [];
    if (bl.length) {
      edLbl(body, `branches · ${bl.length} — swap one back in (your current tail is kept)`);
      for (const b of bl) {
        const box = document.createElement("div"); box.className = "fe-dbgi-branch";
        const p = document.createElement("p"); p.className = "fe-dbgi-brnote";
        p.textContent = `#${b.id} · forked at step ${b.at} · ${b.steps} steps · took ${b.took ? (b.took.kind + " " + b.took.index) : "—"} · ends ${b.end || "?"}`;
        box.appendChild(p);
        edButton(edBtns(box), `swap branch ${b.id} in`, "fe-dbgi-bswap", () => debugBranch(b.id));
        body.appendChild(box);
      }
    }
  }
  function debugPoll() {
    if (dbgPollT) clearTimeout(dbgPollT);
    dbgPollT = setTimeout(async () => {
      dbgPollT = null;
      if (!dbgActive() || disposed) return;
      const st = await debugRefresh();
      if (st && st.running) debugPoll();
      else if (st) {
        // D5: a continue's ticks ride its last_run's event span
        if (st.last_run && Array.isArray(st.last_run.events) && !st.last_run.events_truncated) dbgRecordEvents(st.last_run.events, st.cursor);
        if (dbg) { dbg.stop = { stopped: String(st.last_stop || ""), hit: (st.last_run && st.last_run.hit) || null, mode: "continue" }; renderDebugBar(); refreshInspector(); }
        const bh = dbgStopText();
        status(bh ? `debug: ${bh} at step ${st.cursor}` : `debug: stopped${st.last_stop ? " — " + st.last_stop : ""} at step ${st.cursor}`, "ok");
      }
    }, 200);
  }
  async function debugStop() {
    if (!dbg) return null;
    const d = dbg;
    debugEnded(null);
    let r = null;
    try { r = await FD.client.stop(d.session); } catch (e) {}
    return r;
  }
  function debugEnded(why) {
    dbg = null;
    if (dbgPollT) { clearTimeout(dbgPollT); dbgPollT = null; }
    ME.classList.remove("fe-debugging");
    renderDebugBar();
    if (!disposed && hostApi) { syncDebugState(); renderFacade(); refreshInspector(); }
    status(why ? "debug: " + why : "debug session stopped — edits unlocked", why ? "bad" : "ok");
  }
  // a ready item in words, named in the top frame's case
  function dbgItemText(v, it) {
    const c = v && v.caseObj;
    if (!it || it.kind === "auto") return "auto";
    if (it.kind === "op") return `op ${c && c.cmds[it.index] ? nameOf(c, it.index) : it.index}`;
    if (it.kind === "wire") { const w = c && c.cons[it.index]; return w ? `${nameOf(c, w.src[0])}.${w.src[1]}→${nameOf(c, w.dest[0])}.${w.dest[1]}` : `wire ${it.index}`; }
    if (it.kind === "sync") { const s = c && c.syncs && c.syncs[it.index]; return s ? `${nameOf(c, s.src)}⇢${nameOf(c, s.dest)}` : `synchro ${it.index}`; }
    return `${it.kind} ${it.index}`;
  }
  function renderDebugBar() {
    const on = dbgActive();
    const bar = $(".fe-dbg"); if (bar) bar.hidden = !on;
    renderTimeline();
    const dbtn = $(".fe-debug"); if (dbtn) { dbtn.textContent = on ? "debugging ■" : "debug ⏯"; dbtn.setAttribute("aria-pressed", String(on)); dbtn.title = on ? "Stop debugging (⇧F5)" : "Debug: step through the CURRENT body, unsaved edits included (F11 / F10 start a session)"; }
    if (!on || !bar) return;
    const st = dbg.st || {};
    const live = !!st.running, ended = !!st.ended, busy = !!dbg.busy;
    const set = (sel, dis) => { const b = $(sel); if (b) b.disabled = !!dis; };
    set(".fe-dbg-back", busy || live || !((st.cursor || 0) > (st.base || 0)));
    for (const s of [".fe-dbg-over", ".fe-dbg-into", ".fe-dbg-out", ".fe-dbg-cont"]) set(s, busy || live || ended);
    set(".fe-dbg-pause", !live);
    const pos = $(".fe-dbg-pos"); if (pos) pos.textContent = `step ${st.cursor || 0} / ${st.length || 0}`;
    const ev = $(".fe-dbg-ev");
    if (ev) {
      const top = dbg.views && dbg.views.length ? dbg.views[dbg.views.length - 1] : null;
      let t = FD.eventText(st.event, dbg.views);
      { const bh = dbgStopText(); if (bh) t = `● ${bh} · ${t}`; }   // D4
      const rd = (st.ready || []).filter((x) => x && x.kind !== "auto");
      if (ended) t += " · ended";
      else if (rd.length) t += ` · ready: ${rd.map((x) => dbgItemText(top, x)).join(", ")}` + (st.default ? ` · next ${dbgItemText(top, st.default)}` : "");
      else if ((st.ready || []).length) t += " · next: auto";
      if (top && top.external) t += ` · in ${top.external.name || "a callee"} (not in this flow)`;
      if (live) t = "running… " + t;
      ev.textContent = t;
      ev.className = "fe-dbg-ev" + (ended ? " ended" : "") + (st.event && (st.event.type === "error" || st.event.type === "stall") ? " bad" : "") + (dbgStopText() ? " bp" : "");
    }
    // R3: the session boundary - the server's facts, never invented here:
    // the last move's crossed_side_effects, the flow's persistent keys
    // (debug_state persistent), and debug_start's boundary as the tooltip
    const wn = $(".fe-dbg-warn");
    if (wn) {
      const w = dbgWarnings(st);
      wn.textContent = w.length ? "⚠ " + w.join(" · ⚠ ") : "";
      wn.title = (w.length ? w.join("\n") + "\n\n" : "") + (dbg.boundary ? "session boundary: " + dbg.boundary : "");
      wn.hidden = !w.length;
    }
  }
  function dbgWarnings(st) {
    const w = [];
    const cx = dbg && Array.isArray(dbg.crossed) ? dbg.crossed : [];
    const pk = st && Array.isArray(st.persistent) ? st.persistent : [];
    if (cx.length) w.push(`rolled back over rust/python step${cx.length > 1 ? "s" : ""} ${cx.join(", ")}: outside effects NOT undone`);
    if (pk.length) w.push(`persistent ${pk.join(", ")} not isolated: other runs share ${pk.length > 1 ? "them" : "it"}`);
    return w;
  }

  // ── D3: the debug inspector ──────────────────────────────────────────────
  // While a session is open the inspector shows the SESSION, not the editor's
  // popovers (edits are locked anyway): the frame stack (top first; a click
  // focuses that frame's case and the focus stops following until the next
  // move), the ready set (click = run it next), the selection in the focused
  // frame (an op's inputs with delivery marks + its results; a wire's source
  // and delivered value; a synchro's state) and the frame's args / out /
  // outcome. dbgInspModel is the same picture as data, read straight from
  // the frame debug_state returned (checks compare the DOM rows with it).
  let dbgInsp = null;          // the last rendered model
  const dbgVal = (v) => { let s; try { s = JSON.stringify(v); } catch (e) { s = String(v); } if (s === undefined) s = "null"; return s.length > 160 ? s.slice(0, 159) + "…" : s; };
  const dbgOwn = (o, k) => !!o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);
  function dbgFrameTitle(v) {
    if (v.fi === 0) return "root";
    const nm = v.opName || (v.external && (v.external.name || v.external.cmd)) || "frame";
    return `${v.kind || "frame"} ${nm}` + (v.iter != null ? ` [${v.iter}]` : "");
  }
  function dbgInspModel(key) {
    if (!dbgActive()) return null;
    const st = dbg.st || {}, views = dbg.views || [];
    const dv = dbgDeckView();
    const chainLen = FD.focusChain(views).length;
    const top = views.length ? views[views.length - 1] : null;
    const m = { cursor: st.cursor || 0, length: st.length || 0, ended: !!st.ended, running: !!st.running,
      base: st.base || 0, branches: st.branches || 0, branchList: st.branch_list || [],
      event: FD.eventText(st.event, views), focusFi: dv ? dv.fi : null, follow: !!dbg.follow,
      frames: views.slice().reverse().map((v) => ({ fi: v.fi, title: dbgFrameTitle(v), kind: v.kind, case: v.case, phase: v.phase,
        outcome: v.outcome, top: v.top, focused: dv === v, showable: v.fi < chainLen, external: !!v.external })),
      ready: (st.ready || []).filter((x) => x && x.kind !== "auto").map((x) => ({ kind: x.kind, index: x.index, text: dbgItemText(top, x),
        isDefault: !!(st.default && st.default.kind === x.kind && st.default.index === x.index) })),
      sel: null, frame: null, stop: dbgStopText(),
      bps: bpListModel().map((x) => ({ kind: x.kind, index: x.index, case: x.case, depth: x.depth, text: x.text, entry: x.entry })) };
    if (!dv) return m;
    const f = dv.frame || {}, c = dv.caseObj;
    m.frame = { fi: dv.fi, case: dv.case, phase: dv.phase, outcome: dv.outcome, args: f.args || {}, out: f.out || {}, inprog: f.inprog || null };
    const mk = key && /^d(\d+)_op(\d+)$/.exec(key);
    if (selWire != null && c && c.cons[selWire]) {
      const k = selWire, w = c.cons[k];
      const srcObj = w.src[0] === -1 ? f.args : (Array.isArray(f.results) ? f.results[w.src[0]] : null);
      const dstObj = w.dest[0] === -2 ? f.out : (Array.isArray(f.inputs) ? f.inputs[w.dest[0]] : null);
      m.sel = { kind: "wire", index: k, text: `${nameOf(c, w.src[0])}.${w.src[1]} → ${nameOf(c, w.dest[0])}.${w.dest[1]}`, state: dv.wires[k],
        src: dbgOwn(srcObj, w.src[1]) ? { has: true, value: srcObj[w.src[1]] } : { has: false, value: null },
        dest: dbgOwn(dstObj, w.dest[1]) ? { has: true, value: dstObj[w.dest[1]] } : { has: false, value: null } };
    } else if (selSync != null && c && Array.isArray(c.syncs) && c.syncs[selSync]) {
      m.sel = { kind: "sync", index: selSync, text: syncText(c, c.syncs[selSync]), state: dv.syncs[selSync] };
    } else if (mk && +mk[1] === activeDeck && c && c.cmds[+mk[2]]) {
      const i = +mk[2], op = c.cmds[i];
      const inp = (Array.isArray(f.inputs) && f.inputs[i]) || {}, dl = (Array.isArray(f.dlv) && f.dlv[i]) || {};
      const res = Array.isArray(f.results) ? f.results[i] : null;
      const resObj = res && typeof res === "object" ? res : {};
      const inTerms = Array.from(new Set([...Object.keys(op.in || {}), ...Object.keys(inp)]));
      const outTerms = Array.from(new Set([...Object.keys(op.out || {}), ...Object.keys(resObj)]));
      m.sel = { kind: "op", index: i, name: nameOf(c, i), type: op.type, state: dv.ops[i], done: !!(Array.isArray(f.done) && f.done[i]),
        running: f.inprog && f.inprog.op === i ? (f.inprog.stage || "running") : null,
        inputs: inTerms.map((t) => ({ term: t, has: dbgOwn(inp, t), value: dbgOwn(inp, t) ? inp[t] : null, delivered: !!dl[t] })),
        outputs: outTerms.map((t) => ({ term: t, has: dbgOwn(resObj, t), value: dbgOwn(resObj, t) ? resObj[t] : null })),
        results: res == null ? null : res };
    }
    if (m.sel) m.sel.bp = hasBreakpoint(m.sel.kind, m.sel.index);   // D4
    return m;
  }
  function dbgKv(parent, rows, cls) {
    if (!rows.length) { const p = edNote(parent, "—"); p.classList.add("fe-dbgi-none"); return null; }
    const t = document.createElement("table"); t.className = "fe-dbgi-kv" + (cls ? " " + cls : "");
    for (const r of rows) {
      const tr = document.createElement("tr"); tr.dataset.term = r.k; if (r.cls) tr.className = r.cls;
      const a = document.createElement("td"); a.className = "k"; a.textContent = r.k;
      const b = document.createElement("td"); b.className = "v"; b.textContent = r.v;
      tr.append(a, b);
      if (r.mark != null) { const mk = document.createElement("td"); mk.className = "m"; mk.textContent = r.mark; mk.title = r.markTitle || ""; tr.appendChild(mk); }
      t.appendChild(tr);
    }
    parent.appendChild(t); return t;
  }
  const dbgObjRows = (o) => Object.keys(o && typeof o === "object" ? o : {}).map((k) => ({ k, v: dbgVal(o[k]) }));
  function renderDebugInspector(body, key) {
    const m = dbgInspModel(key); dbgInsp = m;
    body.replaceChildren();
    if (!m) return;
    const head = document.createElement("p"); head.className = "fe-ed-head fe-dbgi-head";
    head.innerHTML = `<b>debugger</b> <span class="lbl">step ${m.cursor} / ${m.length}${m.ended ? " · ended" : m.running ? " · running…" : ""}</span>`;
    body.appendChild(head);
    edNote(body, m.event).classList.add("fe-dbgi-ev");
    if (m.stop) edNote(body, "● " + m.stop).classList.add("fe-dbgi-bphit");   // D4
    renderTimelineInspector(body, m);   // D5: the tape + branches
    // the frame stack, top first
    edLbl(body, "frames · top first — click to focus");
    const ul = document.createElement("ul"); ul.className = "fe-dbgi-frames";
    for (const fr of m.frames) {
      const li = document.createElement("li");
      li.className = "fe-dbgi-frame" + (fr.focused ? " focused" : "") + (fr.top ? " top" : "") + (fr.showable ? "" : " external");
      li.dataset.fi = String(fr.fi);
      li.textContent = `${fr.title} · case ${fr.case + 1} · ${fr.phase || "—"}${fr.outcome ? " · " + fr.outcome : ""}`;
      li.title = fr.showable ? "focus this frame's case" : "a callee this editor does not hold";
      if (fr.showable) li.addEventListener("click", () => debugFocusFrame(fr.fi));
      ul.appendChild(li);
    }
    body.appendChild(ul);
    if (!m.follow) edButton(edBtns(body), "follow the top frame", "fe-dbgi-follow", debugFollowNow);
    // the ready set: click = run it next
    if (m.ready.length && !m.ended && !m.running) {
      edLbl(body, "ready — click to run it next");
      const rb = edBtns(body); rb.classList.add("fe-dbgi-ready");
      for (const it of m.ready) {
        const b = edButton(rb, it.text + (it.isDefault ? " ·default" : ""), "fe-dbgi-pick" + (it.isDefault ? " default" : ""), () => debugStep("into", { kind: it.kind, index: it.index }));
        b.dataset.kind = it.kind; b.dataset.index = String(it.index);
      }
    }
    if (!m.frame) { edNote(body, "no frame runs this case right now — click a frame above, or follow the top frame").classList.add("fe-dbgi-noframe"); renderBpList(body, m); return; }
    // the selection, in the focused frame
    const s = m.sel;
    const sec = document.createElement("div"); sec.className = "fe-dbgi-sel"; body.appendChild(sec);
    if (s && s.kind === "op") {
      sec.dataset.kind = "op"; sec.dataset.index = String(s.index);
      const h = document.createElement("p"); h.className = "fe-dbgi-selhead";
      h.innerHTML = `<b>${esc(s.name)}</b> <span class="lbl">${esc(s.type)}</span> <span class="fe-dbgi-st s-${esc(s.state)}">${esc(s.state)}${s.running ? " · " + esc(s.running) : ""}</span>`;
      sec.appendChild(h);
      edLbl(sec, "inputs");
      dbgKv(sec, s.inputs.map((x) => ({ k: x.term, v: x.has ? dbgVal(x.value) : "—", mark: x.delivered ? "✓" : "·", markTitle: x.delivered ? "delivered" : "not delivered yet", cls: x.delivered ? "dlv" : "pend" })), "fe-dbgi-in");
      edLbl(sec, s.results == null ? "outputs · not evaluated" : "outputs");
      dbgKv(sec, s.outputs.map((x) => ({ k: x.term, v: x.has ? dbgVal(x.value) : "—", cls: x.has ? "has" : "pend" })), "fe-dbgi-out");
    } else if (s && s.kind === "wire") {
      sec.dataset.kind = "wire"; sec.dataset.index = String(s.index);
      const h = document.createElement("p"); h.className = "fe-dbgi-selhead";
      h.innerHTML = `<b>wire</b> ${esc(s.text)} <span class="fe-dbgi-st s-${esc(s.state)}">${esc(s.state)}</span>`;
      sec.appendChild(h);
      dbgKv(sec, [{ k: "source", v: s.src.has ? dbgVal(s.src.value) : "—" }, { k: "delivered", v: s.dest.has ? dbgVal(s.dest.value) : "—" }], "fe-dbgi-wire");
    } else if (s && s.kind === "sync") {
      sec.dataset.kind = "sync"; sec.dataset.index = String(s.index);
      const h = document.createElement("p"); h.className = "fe-dbgi-selhead";
      h.innerHTML = `<b>synchro</b> ${esc(s.text)} <span class="fe-dbgi-st s-${esc(s.state)}">${esc(s.state)}</span>`;
      sec.appendChild(h);
    } else edNote(sec, "click an op or a wire (not a ready one — that runs it) to see its values");
    // D4: the selection's breakpoint toggle (F9 does the same)
    if (s) {
      const b = edButton(edBtns(sec), s.bp ? "● breakpoint — clear (F9)" : "○ set breakpoint (F9)", "fe-dbgi-bp" + (s.bp ? " on" : ""), () => toggleBreakpoint(s.kind, s.index));
      b.dataset.on = String(!!s.bp);
    }
    // the focused frame: args in, out so far
    const fr = m.frame;
    edLbl(body, `frame ${fr.fi === 0 ? "root" : "#" + fr.fi} · case ${fr.case + 1} · args`);
    dbgKv(body, dbgObjRows(fr.args), "fe-dbgi-args");
    edLbl(body, "out" + (fr.outcome ? ` · ${fr.outcome}` : "") + (fr.phase ? ` · ${fr.phase}` : ""));
    dbgKv(body, dbgObjRows(fr.out), "fe-dbgi-fout");
    renderBpList(body, m);
  }
  // D4: every breakpoint (click one = clear it), plus clear-all
  function renderBpList(body, m) {
    const L = m.bps || [];
    edLbl(body, `breakpoints · ${L.length}` + (L.length ? " — click one to clear it" : " — ● dots on ops, wires and synchros, or F9 on the selection"));
    if (!L.length) return;
    const ul = document.createElement("ul"); ul.className = "fe-dbgi-bps";
    L.forEach((x, i) => {
      const li = document.createElement("li"); li.className = "fe-dbgi-bpi";
      li.dataset.kind = x.kind; li.dataset.index = String(x.index); li.dataset.case = String(x.case); li.dataset.depth = String(x.depth);
      li.textContent = "● " + x.text; li.title = "clear this breakpoint";
      li.addEventListener("click", () => removeBreakpointAt(i));
      ul.appendChild(li);
    });
    body.appendChild(ul);
    edButton(edBtns(body), "clear all breakpoints", "fe-dbgi-bpclear", clearBreakpoints);
  }
  // focus frame fi's case (a click in the stack): the focus stops following
  // the top frame until the next move (or "follow the top frame")
  function debugFocusFrame(fi) {
    if (!dbgActive()) return null;
    const chain = FD.focusChain(dbg.views);
    if (!(fi >= 0 && fi < chain.length)) { status("that frame runs a callee this editor doesn't hold", "bad"); return null; }
    dbg.follow = fi === dbg.views.length - 1;
    focusPath = chain.slice(0, fi + 1).map((x, k) => (k === 0 ? { root: doc.root, title: "case 1" } : { root: x.root, op: x.op, title: x.title }));
    activeDeck = chain[fi].case;
    cancelWireGhost();
    selWire = null; selWireRef = null; selSync = null; selSyncRef = null; selSyncCase = null;
    if (hostApi) hostApi.setState("selectedKey", null);
    renderAll(); refreshInspector();
    status(`debug: showing frame ${fi === 0 ? "root" : dbgFrameTitle(dbg.views[fi])} · case ${activeDeck + 1}` + (dbg.follow ? "" : " — the next move follows the top frame again"), "ok");
    return { fi, depth: focusPath.length, deck: activeDeck, follow: dbg.follow };
  }
  function debugFollowNow() {
    if (!dbgActive()) return null;
    dbg.follow = true;
    if (debugFollow()) renderAll(); else { syncDebugState(); renderFacade(); }
    refreshInspector();
    return { depth: focusPath.length, deck: activeDeck };
  }

  // ── D4: breakpoints ──────────────────────────────────────────────────────
  // A breakpoint is { kind: op|wire|sync, ref, root }: the OBJECT it sits on
  // and the picture (case-chain root: the doc root or a local's localdata)
  // holding it — it follows renumbering edits and dies with its object
  // (FD.bpPlace → null; pruned on read). They belong to the EDITOR, not the
  // session: set before or during a session, re-sent on every debugStart and
  // every toggle (dev.flowstep.debug_set_breakpoints; FD.bpEntry: frame
  // [[op,"*"]…] = any iteration of each local on the way, cases = the parent
  // cases). The stepper stops BEFORE a breakpointed op / wire / synchro is
  // picked, on over / out / continue (never on the one a move starts from).
  // Dots: an op's on its flownode (host.state.bps); a wire's just above its
  // destination socket (one wire per input, so the spot is the wire's own;
  // the hang link drops into it from above); a synchro's above its mark.
  // Solid when set; while a session is open every op / wire / synchro of the
  // focused case shows a faint ghost dot — a tap toggles. F9 toggles the
  // selection's; the debug inspector has the toggle and the list.
  function bpColor() {
    const v = String(getComputedStyle(ME).getPropertyValue("--fe-dbg-bp") || "").trim();
    return /^#[0-9a-f]{3,8}$/i.test(v) ? v : "#e5484d";
  }
  function bpPlaces() {
    const out = [];
    bps = bps.filter((b) => { const p = FD.bpPlace(doc && doc.root, b); if (p) out.push(Object.assign({ bp: b }, p)); return !!p; });
    return out;
  }
  const bpRefOf = (kind, index, c) => !c ? null : kind === "op" ? c.cmds[index] : kind === "wire" ? c.cons[index] : (c.syncs || [])[index];
  const bpFind = (kind, ref, root) => bps.findIndex((b) => b.kind === kind && b.ref === ref && b.root === root);
  function hasBreakpoint(kind, index) { const ref = bpRefOf(kind, index, focusedCase()); return !!ref && bpFind(kind, ref, focusRoot()) >= 0; }
  // the focused case's breakpoints as index lists
  function bpDeck() {
    const o = { op: [], wire: [], sync: [] }, c = focusedCase(), root = focusRoot();
    if (!c) return o;
    for (const b of bps) {
      if (b.root !== root || !o[b.kind]) continue;
      const k = (b.kind === "op" ? c.cmds : b.kind === "wire" ? c.cons : (c.syncs || [])).indexOf(b.ref);
      if (k >= 0) o[b.kind].push(k);
    }
    return o;
  }
  function syncBpState() {
    if (!hostApi || disposed) return;
    hostApi.setState("bps", { deck: activeDeck, ops: bpDeck().op, ghost: dbgActive(), color: bpColor() });
  }
  // the facade dots for wires + synchros (renderFacade appends them)
  function bpDotSpecs() {
    lastBpDots = [];
    const c = focusedCase(); if (!c) return [];
    const d = bpDeck(), ghost = dbgActive(), col = bpColor(), out = [];
    const dot = (kind, k, p) => {
      const on = d[kind].includes(k);
      if ((!on && !ghost) || !p) return;
      const id = "fx_" + slug(`d${activeDeck}/bp/${kind}/${k}`);
      out.push({ id, kind: "sphere", pos: p, params: { radius: on ? 0.07 : 0.055 },
        material: { color: col, opacity: on ? 1 : 0.3, emissive: on },
        affordances: { tap: true, hover: true }, meta: { role: "bp", kind, index: k, on } });
      lastBpDots.push({ id, kind, index: k, on, pos: p });
    };
    c.cons.forEach((w, k) => { const e = wireEnd(c, w.dest, "in"); dot("wire", k, e ? { x: e.x, y: e.y + 0.17, z: (e.z || 0) + 0.04 } : null); });
    (c.syncs || []).forEach((s, j) => {
      let a = null, b = null;
      try { a = syncHandlePos(c, s.src, "out"); b = syncHandlePos(c, s.dest, "in"); } catch (e) {}
      dot("sync", j, a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 0.17, z: ((a.z || 0) + (b.z || 0)) / 2 + 0.04 } : null);
    });
    return out;
  }
  function bpDotOfSpec(specId) {
    if (!specId) return null;
    const o = stage && stage.objects && stage.objects.get ? stage.objects.get(specId) : null;
    const m = o && o.spec && o.spec.meta;
    if (m && m.role === "bp" && typeof m.index === "number") return { kind: m.kind, index: m.index };
    const r = /^fx_d(\d+)_bp_(op|wire|sync)_(\d+)$/.exec(String(specId));
    return r && +r[1] === activeDeck ? { kind: r[2], index: +r[3] } : null;
  }
  function bpRedraw() { syncBpState(); renderFacade(); refreshInspector(); renderDebugBar(); }
  // toggle (on null) / set (true) / clear (false) kind index of the FOCUSED case
  function toggleBreakpoint(kind, index, on) {
    const c = focusedCase(), root = focusRoot();
    const ref = bpRefOf(kind, index, c);
    if (!ref) { status(`no ${kind} ${index} in this case`, "bad"); return null; }
    const k = bpFind(kind, ref, root);
    const want = on == null ? k < 0 : !!on;
    if (want && k < 0) bps.push({ kind, ref, root });
    else if (!want && k >= 0) bps.splice(k, 1);
    bpRedraw();
    const sent = sendBreakpoints();
    status(`breakpoint ${want ? "set" : "cleared"} on ${dbgItemText({ caseObj: c }, { kind, index })}` + (dbgActive() ? "" : " — kept for the next debug session"), "ok");
    return { on: want, sent };
  }
  function toggleSelectedBreakpoint() {
    if (selWire != null) return toggleBreakpoint("wire", selWire);
    if (selSync != null) return toggleBreakpoint("sync", selSync);
    const key = hostApi && hostApi.state ? hostApi.state.selectedKey : null;
    const mk = key && /^d(\d+)_op(\d+)$/.exec(key);
    if (mk && +mk[1] === activeDeck) return toggleBreakpoint("op", +mk[2]);
    status("select an op, a wire or a synchro first — F9 toggles its breakpoint", "bad");
    return null;
  }
  function clearBreakpoints() {
    bps = [];
    bpRedraw();
    const sent = sendBreakpoints();
    status("breakpoints cleared", "ok");
    return { sent };
  }
  async function sendBreakpoints() {
    if (!dbgActive()) return null;
    const d = dbg, list = bpPlaces().map((p) => FD.bpEntry(p));
    const r = await FD.client.setBreakpoints(d.session, list);
    if (dbg !== d) return r;
    d.bpSent = { list, ok: !!(r && r.status === "ok"), echoed: r && Array.isArray(r.breakpoints) ? r.breakpoints : null };
    if (!r || r.status !== "ok") status("debug: breakpoints refused — " + ((r && r.msg) || "no reply"), "bad");
    return r;
  }
  // the last move's stop on a breakpoint, in words (null: it did not stop on one)
  function dbgStopText() {
    if (!dbgActive() || !dbg.stop || dbg.stop.stopped !== "breakpoint") return null;
    const h = dbg.stop.hit || {}, views = dbg.views || [];
    const top = views.length ? views[views.length - 1] : null;
    if (h.kind === "op" || h.kind === "wire" || h.kind === "sync") return `stopped at breakpoint: ${dbgItemText(top, h)}`;
    return "stopped at breakpoint" + (h.kind ? ` (${h.kind})` : "");
  }
  // every breakpoint in words (the inspector's list + checks)
  function bpListModel() {
    return bpPlaces().map((p) => {
      const c = FD.caseChain(p.bp.root)[p.case];
      const ops = FD.chainOps(doc.root, p.chain);
      const where = ops.length ? ` · in ${ops.map((o) => (o && (o.name || o.type)) || "local").join(" › ")}` : "";
      return { kind: p.kind, index: p.index, case: p.case, depth: p.chain.length, entry: FD.bpEntry(p),
        text: `${dbgItemText({ caseObj: c }, { kind: p.kind, index: p.index })} · case ${p.case + 1}${where}`, bp: p.bp };
    });
  }
  function removeBreakpointAt(i) {
    const it = bpListModel()[i]; if (!it) return null;
    const k = bps.indexOf(it.bp); if (k >= 0) bps.splice(k, 1);
    bpRedraw();
    return { sent: sendBreakpoints() };
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
    if (dbgActive()) debugStop();     // a new body: the session's tape no longer describes it
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
      // taps no flownode claims (facade wires; null = background) → wire selection
      hostApi.setState("onSceneTap", onSceneTap);
      // drags no flownode claims (the bar sockets) → the wiring engine
      hostApi.setState("onSceneDrag", onSceneDrag);
      // taps on an op BODY (flownode.click) → op selection, the same path as wires
      hostApi.setState("onOpSelect", onOpSelect);
      // D4: a tap on an op's breakpoint dot (flownode.click node "bp") toggles it
      hostApi.setState("onBpTap", (p) => { if (p && typeof p.opIndex === "number" && p.opIndex >= 0) toggleBreakpoint("op", p.opIndex); });
      hostApi.setState("onOpDrag", (p) => {
        // drag an op body to move it (front-ortho plane, z kept). Undoable.
        // flownode hands ONE payload {phase, key, opIndex, evt, which?, ord?}
        // (it used to be read as (opIndex, evt), so no drag ever committed);
        // the node live-follows the pointer itself, the move commits on end.
        if (!p) return;
        if (p.which) { onSocketDrag(p); return; }   // socket drags WIRE (input → output)
        // live-follow: the drawn icon rides the pointer with its pick proxy —
        // and so do its wires (links re-resolve their socket ends each frame)
        if (p.phase === "move" && !running && !dbgActive()) {
          const c0 = focusedCase(); const op0 = c0 && c0.cmds[p.opIndex]; const e0 = p.evt || {};
          if (op0 && op0.pos && typeof e0.dx === "number" && stage && stage.applyDelta) {
            const fid = "fx_" + slug(`d${activeDeck}/op/${p.opIndex}`);
            stage.applyDelta(fid, "pos.x", op0.pos.x + e0.dx);
            stage.applyDelta(fid, "pos.y", op0.pos.y + (e0.dy || 0));
          }
          return;
        }
        if (p.phase === "end" && dbgActive()) { renderAll(); status("debugging — stop the session (⇧F5) to move ops", "bad"); return; }
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
        if (cmd && !cmd.error) {
          // refused (read-only view / mid-run): commitApplied reverted the doc
          // and set the reason — re-seat the live-followed icon and proxy
          if (commitApplied(cmd)) status(`moved ${nameOf(c, p.opIndex)} — ⌘Z undoes`, "ok");
          else renderAll();
        }
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
      // a BACKGROUND tap drops a wire selection. The GL stage emits no tap for
      // empty space (a press there is an orbit gesture), so the editor reads
      // it here: a press inside the canvas box over NOTHING pickable, released
      // without travelling (not an orbit/pan). "Nothing" is judged at
      // pointerdown — the stage's own orbit-vs-node moment — never at click:
      // by then a tap may have rebuilt the facade (selectWire → setScene), and
      // a rebuilt wire has no tube until the next frame re-resolves its ends.
      let bgDown = null;
      hostEl.addEventListener("pointerdown", (e) => {
        bgDown = null;
        if (!stage || !stage.pickAt || !stage.canvas) return;
        const box = stage.canvas.parentElement;
        if (!box || !box.contains(e.target)) return;
        if (stage.pickAt(e.clientX, e.clientY) == null) bgDown = { x: e.clientX, y: e.clientY };
      });
      hostEl.addEventListener("click", (e) => {
        const d = bgDown; bgDown = null;
        if (!d || (selWire == null && selSync == null)) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
        onSceneTap(null);
      });

      // (the wire ghost rides the socket DRAG itself — onSocketDrag)

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
      // STEP DEBUGGER toolbar
      const onClick = (sel, fn) => { const b = $(sel); if (b) b.addEventListener("click", fn); };
      onClick(".fe-debug", () => { if (dbgActive()) debugStop(); else startDebug(); });
      onClick(".fe-dbg-back", () => debugStep("back", { count: 1 }));
      onClick(".fe-dbg-over", () => debugStep("over"));
      onClick(".fe-dbg-into", () => debugStep("into"));
      onClick(".fe-dbg-out", () => debugStep("out"));
      onClick(".fe-dbg-cont", () => debugStep("continue", { budget: 10000 }));
      onClick(".fe-dbg-pause", () => debugStep("pause"));
      onClick(".fe-dbg-stop", () => debugStop());
      // D5: scrub the tape on the top strip (click / drag / ←→; double-click steps)
      {
        const tr = $(".fe-dbg-tl-track");
        if (tr) {
          const go = (e) => { if (dbgActive() && !(dbg.st && dbg.st.running)) debugStep("goto", { seq: tlSeqAt(tr, e.clientX) }); };
          tr.addEventListener("pointerdown", (e) => { if (!dbgActive() || (dbg.st && dbg.st.running)) return; e.preventDefault(); tlDrag = true; try { tr.setPointerCapture(e.pointerId); } catch (e2) {} go(e); });
          tr.addEventListener("pointermove", (e) => { if (tlDrag) go(e); });
          tr.addEventListener("pointerup", () => { tlDrag = null; });
          tr.addEventListener("pointercancel", () => { tlDrag = null; });
          tr.addEventListener("dblclick", (e) => {
            if (!dbgActive() || (dbg.st && dbg.st.running)) return;
            const seq = tlSeqAt(tr, e.clientX);
            const cur = (dbg.st && typeof dbg.st.cursor === "number") ? dbg.st.cursor : 0;
            if (seq === cur + 1) debugStep("into");
            else if (seq !== cur) debugStep("goto", { seq });
          });
          tr.addEventListener("keydown", (e) => {
            if (!dbgActive()) return;
            const cur = (dbg.st && typeof dbg.st.cursor === "number") ? dbg.st.cursor : 0;
            if (e.key === "ArrowLeft") { e.preventDefault(); debugStep("goto", { seq: cur - 1 }); }
            else if (e.key === "ArrowRight") { e.preventDefault(); debugStep("goto", { seq: cur + 1 }); }
          });
        }
      }
      renderDebugBar();
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
        // STEP DEBUGGER keys — F11 into · F10 over · ⇧F11 out · F5 continue ·
        // ⇧F10 back · ⇧F5 stop. Before the field guard (F-keys type nothing)
        // and always preventDefault, so F5 never reloads the page mid-session.
        if (e.key === "F5" || e.key === "F10" || e.key === "F11") {
          e.preventDefault();
          if (e.key === "F11") debugStep(e.shiftKey ? "out" : "into");
          else if (e.key === "F10") { if (e.shiftKey) debugStep("back", { count: 1 }); else debugStep("over"); }
          else if (e.shiftKey) debugStop();
          else debugStep("continue", { budget: 10000 });
          return;
        }
        // D4: F9 toggles the selection's breakpoint (session or not)
        if (e.key === "F9") { e.preventDefault(); toggleSelectedBreakpoint(); return; }
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
        else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelection(); }
        else if (e.key === "Escape") {
          const hasSel = (hostApi && hostApi.state && hostApi.state.selectedKey) || selWire != null || selSync != null;
          if (armSrc) { cancelWireGhost(); status("wiring cancelled"); }
          else if (armSync) { cancelSyncGesture(); status("synchro cancelled"); }
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
          if (dbg) { const s = dbg.session; dbg = null; if (dbgPollT) { clearTimeout(dbgPollT); dbgPollT = null; } try { FD.client.stop(s); } catch (e) {} }
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
        onSocketDrag, undo, doc: () => doc, focusedCase, canWire: (s, d2) => doc.canWire(focusedCase(), s, d2),
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
        selectWire, selectedWire: () => selWire, sceneTap: onSceneTap, opSelect: onOpSelect, deleteSelectedWire, deleteSelection,
        // Synchros S3 surface
        selectSync, selectedSync: () => selSync, deleteSelectedSync,
        syncDrag: onSyncDrag, sceneDrag: onSceneDrag, lastSyncRefusal: () => lastSyncRefusal, syncArmed: () => !!armSync,
        syncs: () => { const c = focusedCase(); return c && Array.isArray(c.syncs) ? c.syncs.map((s) => ({ src: s.src, dest: s.dest })) : []; },
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
        // S3 old-runtimes surface
        checkRuntime, runtime: () => runtimeInfo, runtimeWarning, syncCount: flowSyncCount, syncMinFlowlang: SYNC_MIN_FLOWLANG,
        // P5 run parity surface
        startRun, runLive, lastResult: () => lastResult, liveCall: () => liveCall, coerceArg,
        rounds: () => propagationRounds(focusedCase()), dryPlan,
        changes: () => renderChanges(), refreshJournal, journalRows: () => journalRows,
        toggleJournalDiff, revertTo: (i) => journalRows[i] ? revertTo(journalRows[i]) : null,
        tokens: () => hostApi.children.filter((ch) => ch.ctl === "flowtoken").length,
        // P5 step 4c surface (case chain authoring, diagnostics, walk, frame)
        addDeck, removeDeck, setActiveDeck, activeDeck: () => activeDeck, deckCount: () => caseChain(focusRoot()).length,
        focusedPath, diagnostics: () => lastDiags.map((d) => ({ code: d.code, severity: d.severity, opIndex: d.opIndex, message: d.message })),
        walkOps, selectOp, selectedOpIndex, frameSelection, lastFrame: () => lastFrame,
        pose: () => (stage && stage.getPose ? stage.getPose() : null),
        // STEP DEBUGGER (flow step debugger P4) surface
        startDebug, debugStart, debugStep, debugStop, debugRefresh, debugPickItem,
        debugSession: () => (dbg ? dbg.session : null),
        debugState: () => (dbg ? dbg.st : null),
        debugLastRide: () => (dbg && dbg.lastRide ? JSON.parse(JSON.stringify(dbg.lastRide)) : null),
        debugView: () => { const dv = dbgDeckView(); return dv ? { fi: dv.fi, top: dv.top, case: dv.case, phase: dv.phase, ops: dv.ops.slice(), wires: dv.wires.slice(), syncs: dv.syncs.slice() } : null; },
        debugFrames: () => (dbg ? dbg.views.map((v) => ({ fi: v.fi, kind: v.kind, path: v.path, case: v.case, phase: v.phase, opName: v.opName, external: v.external, ops: v.ops.slice(), wires: v.wires.slice(), syncs: v.syncs.slice() })) : []),
        debugHostState: () => (hostApi && hostApi.state ? hostApi.state.dbg : null),
        debugPlates: () => instances.map((inst) => ({ key: inst && inst.key, dbg: inst && inst.ctx && inst.ctx.me ? inst.ctx.me._dbg : undefined })),
        debugFacade: () => lastFacadeDbg.slice(),
        debugBarText: () => { const b = $(".fe-dbg"); return b && !b.hidden ? { pos: $(".fe-dbg-pos").textContent, ev: $(".fe-dbg-ev").textContent } : null; },
        debugWarnText: () => { const w = $(".fe-dbg-warn"); return w && !w.hidden ? { text: w.textContent, title: w.title } : null; },
        focus: () => ({ depth: focusPath.length, deck: activeDeck, titles: focusPath.map((f) => f.title) }),
        // D3 inspector surface
        debugFocusFrame, debugFollowNow,
        debugInspector: () => (dbgInsp ? JSON.parse(JSON.stringify(dbgInsp)) : null),
        debugInspectorDom: () => {
          const body = $(".fe-inspect-body"); if (!body || !dbgActive()) return null;
          const rows = (sel) => { const t = body.querySelector(sel); return t ? Array.from(t.querySelectorAll("tr")).map((tr) => { const td = tr.querySelectorAll("td"); return { term: tr.dataset.term, v: td[1] ? td[1].textContent : "", mark: td[2] ? td[2].textContent : null }; }) : null; };
          const sel = body.querySelector(".fe-dbgi-sel");
          return {
            head: (body.querySelector(".fe-dbgi-head") || {}).textContent || "",
            frames: Array.from(body.querySelectorAll(".fe-dbgi-frame")).map((li) => ({ fi: +li.dataset.fi, text: li.textContent, focused: li.classList.contains("focused"), top: li.classList.contains("top") })),
            ready: Array.from(body.querySelectorAll(".fe-dbgi-pick")).map((b) => ({ kind: b.dataset.kind, index: +b.dataset.index, text: b.textContent })),
            sel: sel && sel.dataset.kind ? { kind: sel.dataset.kind, index: +sel.dataset.index, head: (sel.querySelector(".fe-dbgi-selhead") || {}).textContent || "" } : null,
            inputs: rows(".fe-dbgi-in"), outputs: rows(".fe-dbgi-out"), wire: rows(".fe-dbgi-wire"),
            args: rows(".fe-dbgi-args"), out: rows(".fe-dbgi-fout"),
            bphit: (body.querySelector(".fe-dbgi-bphit") || {}).textContent || null,
            bpToggle: (() => { const b = body.querySelector(".fe-dbgi-bp"); return b ? { on: b.dataset.on === "true", text: b.textContent } : null; })(),
            bps: Array.from(body.querySelectorAll(".fe-dbgi-bpi")).map((li) => ({ kind: li.dataset.kind, index: +li.dataset.index, case: +li.dataset.case, depth: +li.dataset.depth, text: li.textContent })),
            branchSwaps: Array.from(body.querySelectorAll(".fe-dbgi-bswap")).map((b) => b.textContent),
            tlNote: (body.querySelector(".fe-dbgi-tl-track") ? "shown" : null),
          };
        },
        dbgVal,
        // D4 breakpoints surface
        toggleBreakpoint, toggleSelectedBreakpoint, clearBreakpoints, removeBreakpointAt, sendBreakpoints, hasBreakpoint,
        breakpoints: () => bpListModel().map((x) => ({ kind: x.kind, index: x.index, case: x.case, depth: x.depth, text: x.text, entry: x.entry })),
        bpEntries: () => bpPlaces().map((p) => FD.bpEntry(p)),
        bpHostState: () => (hostApi && hostApi.state ? hostApi.state.bps : null),
        bpPlates: () => instances.map((inst) => ({ key: inst && inst.key, bp: inst && inst.ctx && inst.ctx.me ? inst.ctx.me._bp : undefined })),
        bpDots: () => lastBpDots.slice(),
        bpSent: () => (dbg && dbg.bpSent ? JSON.parse(JSON.stringify(dbg.bpSent)) : null),
        debugStopInfo: () => (dbg && dbg.stop ? JSON.parse(JSON.stringify(dbg.stop)) : null),
        debugStopText: dbgStopText,
        // D5 timeline surface
        debugBranch, debugTimeline: () => {
          const strip = $(".fe-dbg-timeline");
          const tickEls = Array.from(document.querySelectorAll(".fe-dbg-tl-tick"));
          const cur = document.querySelector(".fe-dbg-tl-cursor");
          return {
            shown: !!(strip && !strip.hidden),
            pos: ($(".fe-dbg-tl-pos") || {}).textContent || "",
            ticks: tickEls.map((t) => ({ seq: +t.dataset.seq, type: (t.className.match(/t-([a-z]+)/) || [])[1] || "", left: t.style.left, title: t.title })),
            branches: Array.from(document.querySelectorAll(".fe-dbg-tl-branch")).map((b) => ({ left: b.style.left, width: b.style.width, title: b.title })),
            cursor: cur ? { left: cur.style.left } : null,
            tape: dbgTape.filter((x) => x).map((x) => ({ seq: x.seq, type: x.type, user: !!x.user })),
          };
        },
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