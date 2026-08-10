// floweditor3d — the 3D flowlang case editor (flow3d-design, the sole flow-
// editing spec), REWIRED onto the state-shaped path (the R-4 port): the
// projection is flowproject.toScene (scene schema — sockets as child spheres,
// wires as hang LINKS between socket ids) and the renderer is scenestage, the
// same stack the scene facet and the peer app run on. Wires follow drags
// because the stage re-resolves link endpoints every rendered frame — the
// editor keeps no wire geometry at all. Everything else stands: decks, bars,
// selection/move/width/terminal gestures (§5.3), wiring with I-1/I-2
// enforcement (§5.4, pointer AND keyboard), palette/popovers/pickers, layout
// previews, run tokens (riding stage.linkCurvePoint — the 3D-5 lockstep
// contract), undo/redo, and journaled saves through the flow-body pair.
//
// Editing engages only on a WRITABLE live connection whose write API
// (dev.code) carries read_flow_body/write_flow_body; otherwise this is the viewer (mock,
// the bundled specimen, and read-only live all stay read-only).
//
// The ONLY THREE.js touchpoint is nb_three's scenestage (ids + plain-JSON
// specs); this file names no THREE type (grep-checkable, acceptance 5). The
// projection (flowdoc → scene specs) is pure and lives in
// assets/flowproject.js; the mutations (with inverses) live in
// assets/flowdoc.js.


var me = this;
var ME = document.getElementById(me.UUID);

var readyP = new Promise(function (res) { me.ready = res; }).then(async () => {
  const { parse, propagationRounds, diffFlow } = window.NB_FLOWDOC;
  const { toScene, terminalWorld, GEO } = window.NB_FLOWPROJECT;
  const { PRIMS, FAMILIES, signature } = window.NB_FLOWPRIMS;
  const { tidy, untangle } = window.NB_FLOWLAYOUT;
  const { hasWebGL } = window.NB_WEBGL;
  // the vendored stage off its real asset URL — page-relative for tunneling
  const { mountScene } = await import("../app/asset/app/vendor/nb_three/scenestage.js");
  const jsonP = (c2, v2) => new Promise((res2) => json(c2, v2, res2));
  const invokeP = (l2, c2, m2, a2) => new Promise((res2) => invokeCommand(l2, c2, m2, a2, res2));
  const code = (m2, a2) => invokeP("dev", "code", m2, a2);
  let AUTHOR = "dev";
  jsonP("../security/current_user", null).then((r2) => {
    if (r2.status === "ok" && r2.data) AUTHOR = r2.data.displayname || r2.data.id || "dev";
  });
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
  const readFlowBody = (l2, c2, m2) => code("read_flow_body", { lib: l2, ctl: c2, cmd: m2 });
  const writeFlowBody = (l2, c2, m2, b2, { base = "", label = "" } = {}) =>
    code("write_flow_body", { lib: l2, ctl: c2, cmd: m2, body: b2, base, label, author: AUTHOR });
  const listPatches = (l2, c2, n2) => code("list_control_patches", { lib: l2, ctl: c2, limit: n2 ?? 0 });
  const readCommand = async (l2, c2, m2) => {
    const r2 = await code("read_command", { lib: l2, ctl: c2, cmd: m2 });
    if (r2.status !== "ok") return r2;
    return { status: "ok", ...(r2.data && typeof r2.data === "object" ? r2.data : {}) };
  };

const KIND_GLYPH = { primitive: "⚙", command: "▤", local: "▣", constant: "◇", match: "◇", persistent: "⛃", undefined: "▢" };
const SNAP = 0.05;
const ACCENT = "#62bd8c";   // the projection's fixed palette (flowproject SCENE_COLORS)

function init(host, { title, graph, source, onBack }) {
  const titleEl = host.querySelector(".fx-title");
  titleEl.replaceChildren(document.createTextNode((title?.prefix || "") + " "));
  const t = document.createElement("span"); t.className = "t"; t.textContent = title?.name || "flow";
  titleEl.append(t, ` ${title?.suffix ?? "(flowlang · 3D)"}`);

  const crumbsEl = host.querySelector(".fx-crumbs");
  const stageHost = host.querySelector(".fx-stage");
  const labelsEl = host.querySelector(".fx-labels");
  const tagEl = host.querySelector(".fx-tag");
  const fallbackEl = host.querySelector(".fx-fallback");
  const decksEl = host.querySelector(".fx-decks");
  const projBtn = host.querySelector(".fx-proj");
  const frameBtn = host.querySelector(".fx-frame");
  const runBtn = host.querySelector(".fx-run");
  const saveBtn = host.querySelector(".fx-save");
  const statusEl = host.querySelector(".fx-status");
  const conflictEl = host.querySelector(".fx-conflict");
  const inspectBody = host.querySelector(".fx-inspect-body");
  const diagBox = host.querySelector(".fx-diag");
  const diagList = host.querySelector(".fx-diag-list");
  const journalBox = host.querySelector(".fx-journal");
  const journalList = host.querySelector(".fx-journal-list");
  const layoutBar = host.querySelector(".fx-layout-bar");

  let doc = parse(graph);
  let stack = [{ label: "case 1", case: doc.root, path: "case" }];
  let activeDeck = 0;
  let stage = null;
  let specById = new Map();
  let specJson = new Map();       // id -> JSON of the last projected spec (delta diffing)
  const editObjs = new Map();     // control-owned stage objects (handles, ghosts)
  const labelEls = new Map();
  const wireTint = new Map();     // wire id -> original material (selection tint)
  let selectedId = null;
  let hoverId = null;
  let gesture = null;             // the in-flight pointer gesture (move/resize/wire/…)
  let pointer = { x: 0, y: 0 };

  // editing state
  let editable = false;
  let baseHash = "";
  let dirty = false;
  let saving = false;
  let undoStack = [];
  let redoStack = [];
  let pendingLabels = [];
  let handleIds = [];

  if (!hasWebGL()) return showFallback("WebGL isn’t available in this browser.");
  try {
    stage = mountScene(stageHost, {
      onTap: (id) => select(id),
      onHover: (id) => hoverTo(id),
      onDrag: (e) => routeDrag(e),
    });
  } catch (e) { return showFallback(`the 3D stage failed to start: ${e.message}`); }

  function showFallback(msg) {
    fallbackEl.hidden = false;
    fallbackEl.innerHTML = `${msg}<br><br>Open this flow in the 2D viewer instead — it reads any ` +
      `graph without WebGL. (Editing lives only in the 3D editor.)`;
    host.querySelector(".fx-back").addEventListener("click", () => onBack?.());
    return { dispose() {} };
  }

  const projArgs = () => ({ activeDeck, editable });
  /** World position of a spec — the parent chain is unrotated by construction
      (rotated bodies are leaf children of transform holders). */
  function worldOf(spec) {
    if (!spec) return null;
    let x = 0, y = 0, z = 0, s = spec;
    while (s) { x += s.pos?.x || 0; y += s.pos?.y || 0; z += s.pos?.z || 0; s = s.parent ? specById.get(s.parent) : null; }
    return { x, y, z };
  }
  const sockIdOf = (idx, which, term) =>
    idx === -1 ? `d${activeDeck}/bt-in/${term}`
    : idx === -2 ? `d${activeDeck}/bt-out/${term}`
    : `d${activeDeck}/op/${idx}/${which}/${term}`;
  const focusedCase = () => { let c = stack[stack.length - 1].case; for (let i = 0; i < activeDeck && c.nextcase; i++) c = c.nextcase; return c; };
  const focusedPath = () => { let p = stack[stack.length - 1].path; for (let i = 0; i < activeDeck; i++) p += ".next"; return p; };
  const activeSpec = (id) => id && id.startsWith(`d${activeDeck}/`);

  // ── labels (editor-owned DOM, tracked by the stage's anchor sweep) ─────────
  function clearLabels() { for (const { el } of labelEls.values()) { stage.unanchorEl(el); el.remove(); } labelEls.clear(); }
  function addLabel(id, html, cls) {
    const el = document.createElement("div");
    el.className = `fx-label ${cls}`; el.innerHTML = html;
    labelsEl.appendChild(el); stage.anchorEl(id, el);
    labelEls.set(id, { el, cls });
  }
  const opLabelHtml = (m) => `${escape(`${KIND_GLYPH[m.opType] || ""} ${m.name}`.trim())}` +
    (m.opType ? ` <span class="sub">${escape(m.opType)}</span>` : "");
  /** Reconcile DOM labels with the current projection (ops + the two bars). */
  function syncLabels() {
    const c = focusedCase();
    const want = new Map();
    for (const [id, s] of specById) {
      if (s.meta?.role === "op" && activeSpec(id) && !id.endsWith("/body"))
        want.set(id, { html: opLabelHtml(s.meta), cls: "op" });
    }
    want.set(`d${activeDeck}/bar-in`, { html: escape(`⌘ params — ${Object.keys(c.input).join(", ") || "none"}`), cls: "bar" });
    want.set(`d${activeDeck}/bar-out`, { html: escape(`⌘ return — ${Object.keys(c.output).join(", ") || "none"}`), cls: "bar" });
    for (const [id, rec] of [...labelEls]) {
      if (!want.has(id)) { stage.unanchorEl(rec.el); rec.el.remove(); labelEls.delete(id); }
    }
    for (const [id, w] of want) {
      const rec = labelEls.get(id);
      if (!rec) addLabel(id, w.html, w.cls);
      else if (rec.el.innerHTML !== w.html) rec.el.innerHTML = w.html;
    }
  }

  // ── full render (drill / deck change / conflict reload) ────────────────────
  function render() {
    closePopover(); closePicker(); cancelLayoutPreview();
    wireMode = null; gesture = null;   // setScene below disposes ghosts with the rest
    clearLabels(); handleIds = [];
    selectedId = null; hoverId = null; editObjs.clear(); wireTint.clear();
    const proj = toScene(stack[stack.length - 1].case, projArgs());
    const specs = proj.specs.filter((s) => s.kind !== "text");   // labels are the editor's richer DOM
    specById = new Map(specs.map((s) => [s.id, s]));
    specJson = new Map(specs.map((s) => [s.id, JSON.stringify(s)]));
    stage.setScene(specs, { lights: "default", grid: false });
    syncLabels();
    crumbsEl.textContent = stack.length > 1 ? stack.map((s) => s.label).join(" ▸ ") : "";
    renderDeckTabs(proj.deckCount);
    stage.setCameraMode(projBtn.getAttribute("aria-pressed") === "true" ? "front" : "persp");
    if (proj.bounds) stage.flyTo(fitPose(proj.bounds), 0);
    renderDiagnostics(); inspectEmpty();
  }

  // ── live re-project after a gesture: MINIMAL deltas ────────────────────────
  // A moved op travels as position deltas on ONE node — its sockets are
  // children (they ride the parent transform) and its wires are links between
  // socket ids (the stage re-resolves endpoints per frame), so nothing else
  // changes. Structural edits re-upsert exactly the changed specs, parents
  // first, with whatever rode a rebuilt parent re-attached after it.
  const stripPos = (s) => { const { pos, ...rest } = s; return JSON.stringify(rest); };
  function reprojectLive() {
    const proj = toScene(stack[stack.length - 1].case, projArgs());
    const specs = proj.specs.filter((s) => s.kind !== "text");
    const nextById = new Map(specs.map((s) => [s.id, s]));
    const nextJson = new Map();
    const upserts = [];
    for (const s of specs) {
      const j = JSON.stringify(s);
      nextJson.set(s.id, j);
      const pj = specJson.get(s.id);
      if (pj === j) continue;
      if (pj !== undefined) {
        const prev = specById.get(s.id);
        if (prev && stripPos(s) === stripPos(prev)) {
          for (const a of ["x", "y", "z"]) {
            const nv = s.pos?.[a] || 0;
            if ((prev.pos?.[a] || 0) !== nv) stage.applyDelta(s.id, `pos.${a}`, nv);
          }
          continue;
        }
      }
      upserts.push(s);
    }
    if (upserts.length) {
      const upIds = new Set(upserts.map((s) => s.id));
      let grew = true;
      while (grew) {   // children of a rebuilt parent lost their group — ride along
        grew = false;
        for (const s of specs) {
          if (!upIds.has(s.id) && s.parent && upIds.has(s.parent)) { upserts.push(s); upIds.add(s.id); grew = true; }
        }
      }
      const depth = (map, s) => { let d = 0, q = s.parent && map.get(s.parent); while (q) { d++; q = q.parent && map.get(q.parent); } return d; };
      upserts.sort((a, b) => depth(nextById, a) - depth(nextById, b));
      for (const s of upserts) stage.upsert(s);
    }
    const gone = [...specById.values()].filter((s) => !nextJson.has(s.id) && !s.id.startsWith("edit/"));
    const oldDepth = (s) => { let d = 0, q = s.parent && specById.get(s.parent); while (q) { d++; q = q.parent && specById.get(q.parent); } return d; };
    gone.sort((a, b) => oldDepth(b) - oldDepth(a));
    for (const s of gone) stage.removeObject(s.id);
    specById = nextById;
    specJson = nextJson;
    for (const [id, s] of editObjs) specById.set(id, s);
    syncLabels();
  }

  function renderDeckTabs(count) {
    decksEl.replaceChildren();
    if (count > 1) {
      for (let i = 0; i < count; i++) {
        const b = document.createElement("button");
        b.className = "fx-deck-tab" + (i === activeDeck ? " on" : "");
        b.textContent = `case ${i + 1}`; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(i === activeDeck));
        b.addEventListener("click", () => setActiveDeck(i));
        if (editable && i === activeDeck) {
          const x = document.createElement("span"); x.className = "x"; x.textContent = "×";
          x.title = "delete this case (splices the chain; I-4 guarded)";
          x.addEventListener("click", (e) => {
            e.stopPropagation();
            const cmd = doc.removeCase(stack[stack.length - 1].case, i);
            if (cmd.error) { setStatus(cmd.error, "bad"); return; }
            commitApplied(cmd);
            setActiveDeck(Math.max(0, i - 1));
          });
          b.appendChild(x);
        }
        decksEl.appendChild(b);
      }
    }
    if (editable) {
      const add = document.createElement("button");
      add.className = "fx-deck-tab add"; add.textContent = "+";
      add.title = "add a case — the fall-through program (`next` jumps here)";
      add.addEventListener("click", () => {
        const cmd = doc.addCase(stack[stack.length - 1].case);
        if (cmd.error) { setStatus(cmd.error, "bad"); return; }
        commitApplied(cmd);
        setActiveDeck(count); // jump to the new deck
      });
      decksEl.appendChild(add);
    }
  }
  function setActiveDeck(i) {
    let len = 0;
    for (let c = stack[stack.length - 1].case; c; c = c.nextcase) len++;
    activeDeck = Math.max(0, Math.min(len - 1, i));
    render();
  }

  // ── selection + emphasis ────────────────────────────────────────────────────
  // Nodes get the stage's emphasis box; wires (pooled tubes) get a tint —
  // the material delta is per-instance colour, so it stays cheap.
  function tintWire(id, on) {
    const s = specById.get(id);
    if (!s || s.kind !== "link") return;
    if (on) {
      if (!wireTint.has(id)) wireTint.set(id, { ...(s.material || {}) });
      stage.applyDelta(id, "material", { color: ACCENT, opacity: 0.95 });
    } else {
      const m = wireTint.get(id);
      if (m) { stage.applyDelta(id, "material", m); wireTint.delete(id); }
    }
  }
  function mark(id) {
    const s = specById.get(id);
    if (s?.kind === "link") { stage.emphasize(null); tintWire(id, true); }
    else stage.emphasize(id);
    const lbl = labelEls.get(id); if (lbl) lbl.el.classList.add("sel");
  }
  function unmark(id) {
    tintWire(id, false);
    const lbl = labelEls.get(id); if (lbl) lbl.el.classList.remove("sel");
  }
  function select(id) {
    endKeyboardWiring();   // any new selection abandons an in-flight W gesture
    if (selectedId && selectedId !== id) unmark(selectedId);
    if (popAnchorId && popAnchorId !== id) closePopover();
    selectedId = id;
    clearHandles();
    if (id) {
      mark(id);
      const spec = specById.get(id);
      inspect(spec);
      if (editable && spec?.meta?.role === "op" && activeSpec(id)) showHandles(spec.meta.opIndex);
    } else { stage.emphasize(null); inspectEmpty(); }
  }

  // ── hover / pick / drill ────────────────────────────────────────────────────
  function hoverTo(id) {
    if (id === hoverId) return;
    hoverId = id;
    stage.canvas.style.cursor = id ? "pointer" : "";
    if (id) showTag(specById.get(id));
    else tagEl.hidden = true;
  }

  stageHost.addEventListener("pointermove", (e) => {
    const r = stageHost.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!tagEl.hidden) { tagEl.style.left = pointer.x + "px"; tagEl.style.top = pointer.y + "px"; }
  });
  stageHost.addEventListener("pointerdown", () => host.focus());
  stageHost.addEventListener("dblclick", (e) => {
    const id = stage.pickAt(e.clientX, e.clientY);
    const spec = id && specById.get(id);
    if (spec?.meta?.role === "op" && spec.meta.hasLocal) drill(spec.meta.opIndex);
  });
  function drill(opIndex) {
    const op = focusedCase().cmds[opIndex];
    if (!op?.localdata) return;
    stack.push({ label: `local: ${op.name}`, case: op.localdata, path: `${focusedPath()}.cmds[${opIndex}].local` });
    activeDeck = 0; render();
  }

  // ── editing gestures (only when editable) ──────────────────────────────────
  // The stage owns the pointer (affordance-declared planes, orbit otherwise)
  // and emits start/move/end with plane points + client coords; the editor
  // routes by the spec's meta role. Drag affordances only exist when the
  // projection ran editable, so read-only connections orbit as before.
  function routeDrag(e) {
    if (e.type === "start") { gesture = editable ? beginGesture(e) : null; return; }
    if (!gesture) return;
    if (e.type === "move") gesture.move(e);
    else if (e.type === "end") { const g = gesture; gesture = null; g.end(e); }
  }

  function beginGesture(e) {
    const spec = specById.get(e.id);
    const m = spec?.meta;
    if (!m) return null;
    if (m.role === "op" && activeSpec(e.id)) return moveGesture(m);
    if (m.role === "widthHandle") return resizeGesture(m);
    if (m.role === "terminal" && activeSpec(e.id)) {
      if (e.alt) return termSlideGesture(m);
      if (m.which === "out") return wiringGesture(m);
      if (m.which === "in" && focusedCase().cons.some((w) => w.dest[0] === m.idx && w.dest[1] === m.term)) return rewireGesture(m);
    }
    return null;
  }

  function moveGesture(m) {
    const c = focusedCase(), op = c.cmds[m.opIndex];
    if (!op) return null;
    const from = { ...op.pos };
    const opId = `d${activeDeck}/op/${m.opIndex}`;
    clearHandles(); closePopover();
    const apply = (ev) => { op.pos = snapPos({ x: from.x + ev.dx, y: from.y + ev.dy, z: from.z + ev.dz }); };
    return {
      move: (ev) => { apply(ev); reprojectLive(); },
      end: (ev) => {
        apply(ev);
        const pos = { ...op.pos };
        const moved = Math.abs(pos.x - from.x) + Math.abs(pos.y - from.y) + Math.abs(pos.z - from.z) > 1e-6;
        if (moved) commitApplied({ label: `move ${op.name || "op"}`, undo: () => { op.pos = { ...from }; }, redo: () => { op.pos = pos; } });
        else reprojectLive();
        select(opId);
      },
    };
  }

  function resizeGesture(m) {
    const c = focusedCase(), op = c.cmds[m.opIndex];
    if (!op) return null;
    const from = op.width;
    return {
      move: (ev) => { op.width = Math.max(0.6, 2 * Math.abs(ev.x - op.pos.x)); reprojectLive(); patchHandles(m.opIndex); },
      end: (ev) => {
        const nw = Math.max(0.6, 2 * Math.abs(ev.x - op.pos.x)); op.width = nw;
        if (Math.abs(nw - from) > 1e-6) commitApplied({ label: `resize ${op.name || "op"}`, undo: () => { op.width = from; }, redo: () => { op.width = nw; } });
        else { reprojectLive(); patchHandles(m.opIndex); }
      },
    };
  }

  function termSlideGesture(m) {
    const c = focusedCase();
    const node = termNode(c, m); if (!node) return null;
    const from = node.x;
    const rel = (ev) => (m.idx >= 0 ? ev.x - c.cmds[m.idx].pos.x : ev.x);   // node.x is op-relative
    return {
      move: (ev) => { setTermX(c, m, rel(ev)); reprojectLive(); },
      end: (ev) => {
        const nx = setTermX(c, m, rel(ev));
        if (Math.abs(nx - from) > 1e-6) commitApplied({ label: `move terminal ${m.term}`, undo: () => { node.x = from; }, redo: () => { node.x = nx; } });
        else reprojectLive();
      },
    };
  }

  function wiringGesture(m) {
    const c = focusedCase();
    return wireDrag(c, { idx: m.idx, term: m.term }, (dest) => {
      if (dest) { const cmd = doc.addWire(c, { src: [m.idx, m.term], dest: [dest.idx, dest.term] }); if (!cmd.error) commitApplied(cmd); }
      reprojectLive();
    });
  }

  function rewireGesture(m) {
    const c = focusedCase();
    const idx = c.cons.findIndex((w) => w.dest[0] === m.idx && w.dest[1] === m.term);
    if (idx < 0) return null;
    const oldWire = c.cons[idx];
    const src = { idx: oldWire.src[0], term: oldWire.src[1] };
    c.cons.splice(idx, 1); reprojectLive();     // detach; restore on cancel
    return wireDrag(c, src, (dest) => {
      if (dest && doc.canWire(c, [src.idx, src.term], [dest.idx, dest.term]).ok) {
        const nw = { src: [src.idx, src.term], dest: [dest.idx, dest.term] };
        c.cons.push(nw);
        commitApplied({
          label: `rewire → ${nameOf(c, dest.idx)}.${dest.term}`,
          undo: () => { const k = c.cons.indexOf(nw); if (k >= 0) c.cons.splice(k, 1); c.cons.splice(idx, 0, oldWire); },
          redo: () => { const k = c.cons.indexOf(oldWire); if (k >= 0) c.cons.splice(k, 1); if (c.cons.indexOf(nw) < 0) c.cons.push(nw); },
        });
      } else { c.cons.splice(idx, 0, oldWire); }      // cancelled → restore
      reprojectLive();
    });
  }

  // ── the ghost wire: a REAL hang link to a pointer-tracking tip node ────────
  // The same wire rendering as the graph itself — the stage re-resolves the
  // link's endpoints per frame, so the ghost follows whatever the tip does.
  function showGhostWire(fromId, at) {
    const tip = { id: "edit/ghosttip", kind: "sphere", pos: { x: at.x, y: at.y, z: at.z },
      params: { radius: 0.02 }, material: { color: ACCENT, emissive: true } };
    const wire = { id: "edit/ghostwire", kind: "link", curve: "hang", from: fromId, to: "edit/ghosttip",
      r: 0.045, material: { color: ACCENT, opacity: 0.9 } };
    stage.upsert(tip); stage.upsert(wire);
    editObjs.set(tip.id, tip); editObjs.set(wire.id, wire);
    specById.set(tip.id, tip); specById.set(wire.id, wire);
  }
  function moveGhostTip(p) {
    stage.applyDelta("edit/ghosttip", "pos.x", p.x);
    stage.applyDelta("edit/ghosttip", "pos.y", p.y);
    stage.applyDelta("edit/ghosttip", "pos.z", p.z);
  }
  function hideGhostWire() {
    for (const id of ["edit/ghostwire", "edit/ghosttip"]) {
      stage.removeObject(id); editObjs.delete(id); specById.delete(id);
    }
  }

  // Shared wiring drag: the ghost link rides from the source socket; legal
  // input targets (I-1/I-2) preview; drop calls onDrop(destMeta|null).
  function wireDrag(c, src, onDrop) {
    const srcId = sockIdOf(src.idx, "out", src.term);
    const srcPos = terminalWorld(c, src.idx, "out", src.term);
    if (!srcPos || !specById.has(srcId)) { onDrop(null); return null; }
    let target = null;
    showGhostWire(srcId, srcPos);
    return {
      move: (ev) => {
        const hs = specById.get(stage.pickAt(ev.clientX, ev.clientY));
        target = null;
        let toPos = { x: ev.x, y: ev.y, z: ev.z };
        if (hs?.meta?.role === "terminal" && hs.meta.which === "in" && activeSpec(hs.id)) {
          const chk = doc.canWire(c, [src.idx, src.term], [hs.meta.idx, hs.meta.term]);
          if (chk.ok) { target = hs.meta; toPos = terminalWorld(c, hs.meta.idx, "in", hs.meta.term) || toPos; flashTag("→ wire here", { x: ev.clientX, y: ev.clientY }); }
          else flashTag("✗ " + chk.reason, { x: ev.clientX, y: ev.clientY });
        } else tagEl.hidden = true;
        moveGhostTip(toPos);
      },
      end: () => { hideGhostWire(); tagEl.hidden = true; onDrop(target); },
    };
  }

  // width handles (control-owned stage objects, shown on selection)
  function showHandles(opIndex) {
    clearHandles();
    if (!editable || opIndex == null) return;
    const op = focusedCase().cmds[opIndex]; if (!op) return;
    for (const side of [-1, 1]) {
      const id = `edit/wh/${side < 0 ? "l" : "r"}`;
      const spec = { id, kind: "box", pos: { x: op.pos.x + side * op.width / 2, y: op.pos.y, z: op.pos.z },
        params: { size: { x: 0.09, y: 0.42, z: 0.42 } }, material: { color: ACCENT, emissive: true },
        affordances: { tap: true, drag: { plane: "xy" }, hover: true },
        meta: { role: "widthHandle", opIndex, side } };
      stage.upsert(spec); handleIds.push(id); editObjs.set(id, spec); specById.set(id, spec);
    }
  }
  function patchHandles(opIndex) {
    const op = focusedCase().cmds[opIndex]; if (!op) return;
    stage.applyDelta("edit/wh/l", "pos.x", op.pos.x - op.width / 2);
    stage.applyDelta("edit/wh/r", "pos.x", op.pos.x + op.width / 2);
  }
  function clearHandles() { for (const id of handleIds) { stage.removeObject(id); editObjs.delete(id); specById.delete(id); } handleIds = []; }

  // ── authoring: palette → create (+ splice), pickers, popovers (3D-3) ───────
  let popEl = null, popAnchorId = null, pickerEl = null;

  const compound = (label, cmds) => ({
    label,
    undo: () => { for (let i = cmds.length - 1; i >= 0; i--) cmds[i].undo(); },
    redo: () => { for (const cmd of cmds) cmd.redo(); },
  });
  const node0 = () => ({ mode: "", type: "", x: 0 });
  const spread = (names, width) => {
    const n = names.length, gap = n > 1 ? Math.min(0.6, (width - 0.5) / (n - 1)) : 0;
    return Object.fromEntries(names.map((nm, i) => [nm, { mode: "", type: "", x: (i - (n - 1) / 2) * gap }]));
  };
  /** Has the focused deck a case after it (the I-4 popover gate)? */
  function chainHasNext() {
    let c = stack[stack.length - 1].case, len = 0;
    while (c) { len++; c = c.nextcase; }
    return activeDeck < len - 1;
  }
  const snapPos = (p) => ({ x: Math.round(p.x / SNAP) * SNAP, y: Math.round(p.y / SNAP) * SNAP, z: Math.round(p.z / SNAP) * SNAP });

  function installPalette() {
    for (const item of host.querySelectorAll(".fx-pal-item[data-kind]")) {
      item.addEventListener("pointerdown", (e) => startPaletteDrag(item.dataset.kind, e));
    }
    for (const btn of host.querySelectorAll(".fx-layout-btn")) {
      btn.addEventListener("click", () => previewLayout(btn.dataset.layout));
    }
    layoutBar.querySelector(".fx-layout-apply").addEventListener("click", applyLayoutPreview);
    layoutBar.querySelector(".fx-layout-cancel").addEventListener("click", cancelLayoutPreview);
  }

  // ── auto-layout: proposal → ghost preview → ONE journaled mutation (§7.1) ──
  let layoutPreview = null; // { positions, label, ghostIds }
  function previewLayout(kind) {
    if (!editable) return;
    cancelLayoutPreview(); closePopover();
    const c = focusedCase();
    if (!c.cmds.length) { setStatus("nothing to lay out", "bad"); return; }
    const prop = kind === "untangle" ? untangle(c) : tidy(c);
    const ghostIds = [];
    prop.positions.forEach((p, i) => {
      const gid = `edit/layout/${i}`;
      const spec = { id: gid, kind: "box", pos: { x: p.x, y: p.y, z: p.z },
        params: { size: { x: c.cmds[i].width, y: GEO.boxH, z: GEO.boxD } },
        material: { color: ACCENT, opacity: 0.22 } };
      stage.upsert(spec);
      editObjs.set(gid, spec); specById.set(gid, spec);
      ghostIds.push(gid);
    });
    layoutPreview = { ...prop, ghostIds };
    layoutBar.hidden = false;
    layoutBar.querySelector(".fx-layout-msg").textContent = `${prop.label} — the ghosts are the proposal`;
  }
  function applyLayoutPreview() {
    if (!layoutPreview) return;
    const { positions, label } = layoutPreview;
    cancelLayoutPreview();
    commitPop(doc.applyLayout(focusedCase(), positions, label));
  }
  function cancelLayoutPreview() {
    if (!layoutPreview) return;
    for (const gid of layoutPreview.ghostIds) { stage.removeObject(gid); editObjs.delete(gid); specById.delete(gid); }
    layoutPreview = null;
    layoutBar.hidden = true;
  }

  function startPaletteDrag(kind, ev) {
    if (!editable) return;
    if (kind === "barterm") { // bar terminals are a bar-level edit (§3.1)
      const id = `d${activeDeck}/bar-in`;
      select(id); openPopover(id);
      return;
    }
    ev.preventDefault();
    const plane = { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 } };
    let dropPos = null, spliceWire = null, over = false;
    stage.upsert({ id: "edit/ghostnew", kind: "box", pos: { x: 0, y: 0, z: 0 },
      params: { size: { x: 1.5, y: GEO.boxH, z: GEO.boxD } },
      material: { color: ACCENT, opacity: 0.22 }, visible: false });
    const onMove = (e) => {
      const r = stageHost.getBoundingClientRect();
      over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!over) { stage.applyDelta("edit/ghostnew", "visible", false); tagEl.hidden = true; dropPos = null; return; }
      const world = stage.screenToPlane(e.clientX, e.clientY, plane);
      if (!world) return;
      dropPos = snapPos(world);
      stage.applyDelta("edit/ghostnew", "pos.x", dropPos.x);
      stage.applyDelta("edit/ghostnew", "pos.y", dropPos.y);
      stage.applyDelta("edit/ghostnew", "pos.z", dropPos.z);
      stage.applyDelta("edit/ghostnew", "visible", true);
      const hs = specById.get(stage.pickAt(e.clientX, e.clientY));
      spliceWire = (hs?.meta?.role === "wire" && activeSpec(hs.id)) ? hs.meta.index : null;
      flashTag(spliceWire != null ? `splice ${kind} into this wire` : `add ${kind}`, { x: e.clientX, y: e.clientY });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      stage.removeObject("edit/ghostnew");
      tagEl.hidden = true;
      if (over && dropPos) createAt(kind, dropPos, spliceWire);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  function createAt(kind, pos, wireIdx) {
    if (kind === "primitive") return openPrimitivePicker(pos, wireIdx);
    if (kind === "command") return openCommandPicker(pos, wireIdx);
    let op = null, thenPopover = false;
    if (kind === "constant") {
      op = { name: "", type: "constant", ctype: "string", width: 1.5, pos, in: {}, out: { a: node0() } };
      thenPopover = true;
    } else if (kind === "persistent") {
      op = { name: "slot", type: "persistent", width: 1.4, pos, in: {}, out: { a: node0() } };
      thenPopover = true;
    } else if (kind === "local") {
      op = { name: "local", type: "local", width: 2.2, pos, in: { a: node0() }, out: { a: node0() },
        localdata: { input: { a: node0() }, output: { a: node0() }, cmds: [], cons: [] } };
    } else { // blank (undefined)
      op = { name: "", type: "undefined", width: 1.5, pos, in: {}, out: {} };
    }
    createOp(op, wireIdx, thenPopover);
  }

  function createOp(op, wireIdx, thenPopover) {
    const c = focusedCase();
    const add = doc.addOp(c, op);
    if (add.error) { setStatus(add.error, "bad"); return; }
    const cmds = [add];
    let label = add.label;
    if (wireIdx != null) {
      const sp = doc.spliceIntoWire(c, wireIdx, add.index);
      if (sp.error) setStatus(`created without splice: ${sp.error}`, "bad");
      else { cmds.push(sp); label = sp.label; }
    }
    commitApplied(compound(label, cmds));
    const id = `d${activeDeck}/op/${add.index}`;
    select(id);
    if (thenPopover) openPopover(id);
  }

  // ── pickers ────────────────────────────────────────────────────────────────
  function closePicker() { if (pickerEl) { pickerEl.remove(); pickerEl = null; } }
  function openPicker(title) {
    closePicker(); closePopover();
    pickerEl = document.createElement("div"); pickerEl.className = "fx-picker";
    const panel = document.createElement("div"); panel.className = "fx-picker-panel";
    const lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = title;
    panel.appendChild(lbl);
    pickerEl.appendChild(panel);
    pickerEl.addEventListener("pointerdown", (e) => { if (e.target === pickerEl) closePicker(); });
    stageHost.appendChild(pickerEl);
    return panel;
  }

  function openPrimitivePicker(pos, wireIdx) {
    const panel = openPicker("primitive — 66, from the registry");
    const search = document.createElement("input");
    search.placeholder = "search primitives…";
    const list = document.createElement("div"); list.className = "fx-picker-list";
    const renderList = (q) => {
      list.replaceChildren();
      for (const fam of FAMILIES) {
        const prims = PRIMS.filter((p) => p.family === fam &&
          (!q || p.name.toLowerCase().includes(q) || fam.includes(q)));
        if (!prims.length) continue;
        const h = document.createElement("div"); h.className = "fam lbl"; h.textContent = fam;
        list.appendChild(h);
        for (const prim of prims) {
          const b = document.createElement("button");
          const nm = document.createElement("span"); nm.textContent = `⚙ ${prim.name}`;
          const sig = document.createElement("span"); sig.className = "sig"; sig.textContent = signature(prim);
          b.append(nm, sig);
          b.addEventListener("click", () => {
            closePicker();
            const width = Math.max(1.75, prim.name.length * 0.14 + 0.7);
            createOp({ name: prim.name, type: "primitive", width, pos,
              in: spread(prim.ins, width), out: spread(prim.outs, width) }, wireIdx, false);
          });
          list.appendChild(b);
        }
      }
    };
    search.addEventListener("input", () => renderList(search.value.trim().toLowerCase()));
    panel.append(search, list);
    renderList("");
    search.focus();
  }

  async function openCommandPicker(pos, wireIdx) {
    const panel = openPicker("command call — the callee");
    const libSel = document.createElement("select");
    const ctlSel = document.createElement("select");
    const cmdSel = document.createElement("select");
    const foot = document.createElement("div"); foot.className = "fx-picker-foot";
    const go = document.createElement("button"); go.className = "fx-pop-btn"; go.textContent = "add call";
    const cancel = document.createElement("button"); cancel.className = "fx-pop-btn"; cancel.textContent = "cancel";
    cancel.addEventListener("click", closePicker);
    foot.append(cancel, go);
    panel.append(libSel, ctlSel, cmdSel, foot);
    const fill = (sel, rows, value) => {
      sel.replaceChildren(...rows.map((r) => { const o = document.createElement("option"); o.value = r.value; o.textContent = r.text; return o; }));
      if (value) sel.value = value;
    };
    const libs = await libsOf();
    if (libs instanceof Error) { setStatus("cannot list libraries", "bad"); closePicker(); return; }
    fill(libSel, libs.map((l) => ({ value: l.id, text: l.id })));
    let ctlRows = [];
    const loadCtls = async () => {
      const ctls = await controlsOf(libSel.value);
      ctlRows = ctls instanceof Error ? [] : ctls;
      fill(ctlSel, ctlRows.map((cr) => ({ value: cr.id, text: cr.name })));
      await loadCmds();
    };
    const loadCmds = async () => {
      const rec = ctlSel.value ? await readRec(libSel.value, ctlSel.value) : null;
      const cmds = rec && !(rec instanceof Error) ? (rec.cmd ?? []) : [];
      fill(cmdSel, cmds.map((cm) => ({ value: cm.id, text: cm.name })));
    };
    libSel.addEventListener("change", loadCtls);
    ctlSel.addEventListener("change", loadCmds);
    await loadCtls();
    go.addEventListener("click", async () => {
      const lib = libSel.value, ctlId = ctlSel.value, cmdId = cmdSel.value;
      const ctlName = ctlRows.find((r) => r.id === ctlId)?.name;
      const cmdName = cmdSel.options[cmdSel.selectedIndex]?.textContent;
      if (!lib || !ctlId || !cmdId) return;
      closePicker();
      // terminals from the callee's signature; outputs map by position, so
      // non-flow callees expose the single key `a` (design §1.3 / I-7).
      const rc = await readCommand(lib, ctlName, cmdName);
      const ins = rc.status === "ok" && Array.isArray(rc.params) ? rc.params.map((p) => p.name) : [];
      let outs = ["a"];
      if (rc.status === "ok" && rc.type === "flow") {
        const fb = await readFlowBody(lib, ctlName, cmdName);
        if (fb.status === "ok" && fb.exists && fb.body?.output) outs = Object.keys(fb.body.output);
      }
      const width = Math.max(1.75, cmdName.length * 0.12 + 0.8);
      createOp({ name: cmdName, type: "command", cmd: `${lib}:${ctlId}:${cmdId}`, width, pos,
        in: spread(ins, width), out: spread(outs.length ? outs : ["a"], width) }, wireIdx, false);
    });
  }

  // ── edit popovers (§5.5 — DOM, anchored, real inputs) ──────────────────────
  function closePopover() { if (popEl) { stage.unanchorEl(popEl); popEl.remove(); popEl = null; popAnchorId = null; } }
  function openPopover(id) {
    closePopover();
    if (!editable) return;
    const spec = specById.get(id);
    const role = spec?.meta?.role;
    if (!spec || !["op", "terminal", "bar"].includes(role)) return;
    popEl = document.createElement("div"); popEl.className = "fx-pop";
    const panel = document.createElement("div"); panel.className = "fx-pop-panel";
    popEl.appendChild(panel);
    if (role === "op") buildOpPopover(panel, spec.meta);
    else if (role === "terminal") buildTerminalPopover(panel, spec.meta);
    else buildBarPopover(panel, spec.meta);
    stageHost.appendChild(popEl);
    stage.anchorEl(id, popEl);
    popAnchorId = id;
  }
  function refreshPopover() {
    if (!popEl) return;
    const id = popAnchorId;
    if (id && specById.has(id)) openPopover(id); else closePopover();
  }
  /** Apply a mutation from a popover control; errors land in the status line. */
  function commitPop(cmd) {
    if (!cmd || cmd.error) { setStatus(cmd?.error || "no change", "bad"); refreshPopover(); return false; }
    commitApplied(cmd);
    return true;
  }
  const popRow = (panel, labelText, control) => {
    const row = document.createElement("div"); row.className = "fx-pop-row";
    const lab = document.createElement("span"); lab.textContent = labelText;
    row.append(lab, control); panel.appendChild(row);
    return control;
  };
  const popButton = (panel, text, danger, fn) => {
    const row = document.createElement("div"); row.className = "fx-pop-row";
    const b = document.createElement("button"); b.className = "fx-pop-btn" + (danger ? " danger" : "");
    b.textContent = text; b.addEventListener("click", fn);
    row.appendChild(b); panel.appendChild(row);
    return b;
  };
  const popText = (panel, text) => {
    const p = document.createElement("p"); p.className = "fx-pop-sentence"; p.textContent = text;
    panel.appendChild(p);
  };
  const mkSelect = (options, value) => {
    const s = document.createElement("select");
    for (const o of options) { const el = document.createElement("option"); el.value = o; el.textContent = o || "—"; s.appendChild(el); }
    s.value = value ?? options[0];
    return s;
  };
  const mkInput = (value, placeholder) => {
    const i = document.createElement("input");
    i.value = value ?? ""; if (placeholder) i.placeholder = placeholder;
    i.addEventListener("keydown", (e) => { if (e.key === "Enter") i.blur(); e.stopPropagation(); });
    return i;
  };
  const nextName = (map) => { for (const ch of "abcdefghijklmnopqrstuvwxyz") if (!(ch in map)) return ch; return `t${Object.keys(map).length}`; };

  function buildOpPopover(panel, m) {
    const c = focusedCase(); const i = m.opIndex; const op = c.cmds[i];
    if (!op) return;
    const lbl = document.createElement("span"); lbl.className = "lbl";
    lbl.textContent = `${op.type} · edit`;
    panel.appendChild(lbl);
    const isConst = op.type === "constant" || op.type === "match";
    const nameLabel = isConst ? "literal" : op.type === "persistent" ? "slot" : "name";
    const nameIn = popRow(panel, nameLabel, mkInput(op.name, nameLabel));
    nameIn.addEventListener("change", () => { if (nameIn.value !== op.name) commitPop(doc.renameOp(c, i, nameIn.value)); });
    if (isConst) {
      const ctypes = op.type === "match" ? ["int", "decimal", "boolean", "string", "null"]
        : ["int", "decimal", "boolean", "string", "object", "array"];
      const ct = popRow(panel, "ctype", mkSelect(ctypes, op.ctype));
      ct.addEventListener("change", () => commitPop(doc.setCtype(c, i, ct.value)));
      const toggle = document.createElement("button"); toggle.className = "fx-pop-btn";
      toggle.textContent = op.type === "match" ? "→ constant (drop the input)" : "→ matcher (gains input a)";
      toggle.addEventListener("click", () => commitPop(doc.setMatcher(c, i, op.type !== "match")));
      const row = document.createElement("div"); row.className = "fx-pop-row"; row.appendChild(toggle); panel.appendChild(row);
    }
    if (op.type !== "constant") {
      const rules = ["", "next", "terminate", "fail", "finish"];
      const rule = popRow(panel, "condition", mkSelect(rules, op.condition?.rule ?? ""));
      const val = popRow(panel, "fires when", mkSelect(["true", "false"], String(op.condition?.value ?? true)));
      const hasNext = chainHasNext();
      if (!hasNext) [...rule.options].find((o) => o.value === "next").disabled = true; // I-4: unrepresentable
      const sentence = document.createElement("p"); sentence.className = "fx-pop-sentence";
      const updateSentence = () => {
        sentence.textContent = rule.value
          ? `when this op’s match = ${val.value} → ${conditionSentence(rule.value, val.value).split("→ ")[1]}`
          : "no condition — evaluates and passes through.";
      };
      updateSentence();
      panel.appendChild(sentence);
      const applyCond = () => commitPop(doc.setCondition(c, i,
        rule.value ? { rule: rule.value, value: val.value === "true" } : null,
        { chainHasNext: hasNext }));
      rule.addEventListener("change", applyCond);
      val.addEventListener("change", () => { if (rule.value) applyCond(); else updateSentence(); });
    }
    const terms = document.createElement("div"); terms.className = "fx-pop-terms";
    const addIn = document.createElement("button"); addIn.textContent = "+ input";
    addIn.addEventListener("click", () => commitPop(doc.addTerminal(c, i, "in", nextName(op.in))));
    const addOut = document.createElement("button"); addOut.textContent = "+ output";
    addOut.addEventListener("click", () => commitPop(doc.addTerminal(c, i, "out", nextName(op.out))));
    terms.append(addIn, addOut);
    panel.appendChild(terms);
    popText(panel, "click a socket to rename it, set list/loop mode, or delete it");
    if (op.type === "local") popButton(panel, "drill ▸ into the sub-flow", false, () => { closePopover(); drill(i); });
    const wires = doc.wiresTouching(c, i);
    popButton(panel, `delete op${wires ? ` · removes ${wires} wire${wires > 1 ? "s" : ""}` : ""}`, true, () => {
      closePopover();
      if (commitPop(doc.removeOp(c, i))) { select(null); setStatus("deleted — ⌘Z undoes", "ok"); }
    });
  }

  function buildTerminalPopover(panel, m) {
    const c = focusedCase();
    const isBar = m.idx < 0;
    const map = m.idx === -1 ? c.input : m.idx === -2 ? c.output : (m.which === "in" ? c.cmds[m.idx]?.in : c.cmds[m.idx]?.out);
    const node = map?.[m.term];
    if (!node) return;
    const lbl = document.createElement("span"); lbl.className = "lbl";
    lbl.textContent = `terminal · ${isBar ? (m.idx === -1 ? "parameter" : "return") : (m.which === "in" ? "input" : "output")}`;
    panel.appendChild(lbl);
    const nameIn = popRow(panel, "name", mkInput(m.term));
    nameIn.addEventListener("change", () => {
      if (nameIn.value && nameIn.value !== m.term) {
        closePopover();
        commitPop(doc.renameTerminal(c, m.idx, m.which, m.term, nameIn.value));
      }
    });
    const typeIn = popRow(panel, "type", mkInput(node.type, "object · integer · string · …"));
    typeIn.addEventListener("change", () => commitPop(doc.setTerminalType(c, m.idx, m.which, m.term, typeIn.value)));
    if (!isBar) {
      const mode = popRow(panel, "mode", mkSelect(["regular", "list", "loop"], node.mode || "regular"));
      let pairSel = null;
      if (m.which === "out") {
        const ins = Object.keys(c.cmds[m.idx].in);
        pairSel = popRow(panel, "loop ⟲ input", mkSelect(ins.length ? ins : [""], node.loop));
        pairSel.disabled = mode.value !== "loop";
      }
      const applyMode = () => {
        if (pairSel) pairSel.disabled = mode.value !== "loop";
        // "regular" persists as the empty-string mode (the from_data default)
        commitPop(doc.setTerminalMode(c, m.idx, m.which, m.term,
          mode.value === "regular" ? "" : mode.value, pairSel?.value));
      };
      mode.addEventListener("change", applyMode);
      pairSel?.addEventListener("change", () => { if (mode.value === "loop") applyMode(); });
    } else {
      popText(panel, "the bars are the signature — renaming or retyping this renames the command’s " + (m.idx === -1 ? "parameter" : "return"));
    }
    popButton(panel, "delete terminal", true, () => {
      closePopover();
      if (commitPop(doc.removeTerminal(c, m.idx, m.which, m.term))) select(null);
    });
  }

  function buildBarPopover(panel, m) {
    const c = focusedCase();
    const isIn = m.which === "input";
    const idx = isIn ? -1 : -2;
    const map = isIn ? c.input : c.output;
    const lbl = document.createElement("span"); lbl.className = "lbl";
    lbl.textContent = isIn ? "params — the signature" : "return — the signature";
    panel.appendChild(lbl);
    const terms = document.createElement("div"); terms.className = "fx-pop-terms";
    for (const term of Object.keys(map)) {
      const b = document.createElement("button");
      b.textContent = `${term}${map[term].type ? ` : ${map[term].type}` : ""}`;
      b.addEventListener("click", () => {
        const sockId = `d${activeDeck}/bt-${isIn ? "in" : "out"}/${term}`;
        select(sockId); openPopover(sockId);
      });
      terms.appendChild(b);
    }
    panel.appendChild(terms);
    const nameIn = mkInput("", "name");
    const typeIn = mkInput("", "type");
    const add = document.createElement("button"); add.className = "fx-pop-btn"; add.textContent = "add";
    add.addEventListener("click", () => {
      if (!nameIn.value.trim()) return;
      commitPop(doc.addTerminal(c, idx, isIn ? "out" : "in", nameIn.value.trim(), typeIn.value.trim()));
    });
    const row = document.createElement("div"); row.className = "fx-pop-row";
    row.append(nameIn, typeIn, add); panel.appendChild(row);
    popText(panel, isIn
      ? "adding a parameter allocates the next free slot; the save derives the command’s params from this bar"
      : "the save derives the command’s returntype from this bar");
  }

  // ── run: invoke_command + deliveries in propagation order (3D-5, §3.5) ─────
  const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
  let running = false;

  function openRunPicker() {
    const params = Object.entries(doc.root.input);
    if (!params.length) return doRun({});
    const panel = openPicker("run — arguments (the params bar)");
    const inputs = new Map();
    for (const [name, node] of params) {
      const row = document.createElement("div"); row.className = "fx-pop-row";
      const lab = document.createElement("span"); lab.textContent = `${name} : ${node.type || "any"}`;
      const inp = mkInput("", node.type || "value");
      inputs.set(name, { inp, type: node.type });
      row.append(lab, inp); panel.appendChild(row);
    }
    const foot = document.createElement("div"); foot.className = "fx-picker-foot";
    const cancel = document.createElement("button"); cancel.className = "fx-pop-btn"; cancel.textContent = "cancel";
    cancel.addEventListener("click", closePicker);
    const go = document.createElement("button"); go.className = "fx-pop-btn"; go.textContent = "run ▸";
    go.addEventListener("click", () => {
      const args = {};
      for (const [name, { inp, type }] of inputs) args[name] = coerceArg(inp.value, type);
      closePicker();
      doRun(args);
    });
    foot.append(cancel, go); panel.appendChild(foot);
    panel.querySelector("input")?.focus();
  }

  function coerceArg(raw, type) {
    const t = (type || "").toLowerCase();
    if (t === "integer" || t === "int") { const n = parseInt(raw, 10); return isNaN(n) ? raw : n; }
    if (t === "decimal" || t === "float") { const n = parseFloat(raw); return isNaN(n) ? raw : n; }
    if (t === "boolean") return raw === "true";
    if (t === "object" || t === "array") { try { return JSON.parse(raw); } catch { return raw; } }
    return raw;
  }

  async function doRun(args) {
    if (running || !editable) return;
    running = true;
    runBtn.disabled = true; runBtn.classList.add("running"); runBtn.textContent = "running…";
    const started = performance.now();
    const resP = invokeP(source.lib, source.ctl, source.cmd, args);
    // the schedule is local (design §3.5: deliveries in propagation order —
    // the platform returns only the result); animate while the call flies.
    if (stack.length === 1 && activeDeck === 0) {
      try { await animateRun(propagationRounds(doc.root).rounds); } catch { /* never block the result */ }
    }
    const r = await resP;
    const ms = Math.round(performance.now() - started);
    running = false;
    runBtn.disabled = false; runBtn.classList.remove("running"); runBtn.textContent = "run ▸";
    if (r.status === "ok") { setStatus(`ran · ${ms}ms`, "ok"); inspectRunResult(r, args, ms); }
    else setStatus(`run failed: ${r.msg}`, "bad");
  }

  async function animateRun(rounds) {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    for (const round of rounds) {
      const wires = round
        .map((k) => ({ k, id: `d${activeDeck}/wire/${k}` }))
        .filter((w) => specById.has(w.id));
      if (!wires.length) continue;
      if (reduced) {
        // step-through highlighting instead of motion (§5.6)
        for (const w of wires) tintWire(w.id, true);
        await sleepMs(340);
        for (const w of wires) if (w.id !== selectedId) tintWire(w.id, false);
      } else {
        // tokens ride the stage's OWN spline (linkCurvePoint — lockstep with
        // the rendered tube by construction, the 3D-5 contract)
        for (const w of wires) {
          const at = stage.linkCurvePoint(w.id, 0) || { x: 0, y: 0, z: 0 };
          stage.upsert({ id: `edit/run/${w.k}`, kind: "sphere", pos: at,
            params: { radius: 0.09 }, material: { color: ACCENT, emissive: true } });
        }
        const T = 420, t0 = performance.now();
        await new Promise((res) => {
          const tick = () => {
            const t = Math.min(1, (performance.now() - t0) / T);
            for (const w of wires) {
              const pt = stage.linkCurvePoint(w.id, t);
              if (pt) {
                stage.applyDelta(`edit/run/${w.k}`, "pos.x", pt.x);
                stage.applyDelta(`edit/run/${w.k}`, "pos.y", pt.y);
                stage.applyDelta(`edit/run/${w.k}`, "pos.z", pt.z);
              }
            }
            if (t < 1) requestAnimationFrame(tick); else res();
          };
          requestAnimationFrame(tick);
        });
        for (const w of wires) stage.removeObject(`edit/run/${w.k}`);
      }
    }
  }

  function inspectRunResult(r, args, ms) {
    inspectBody.replaceChildren();
    const n = document.createElement("div"); n.className = "fi-name"; n.textContent = "run result";
    const badge = document.createElement("span"); badge.className = "fi-kind"; badge.textContent = `ok · ${ms}ms`;
    inspectBody.append(n, badge);
    const payload = { ...r };
    delete payload.status; delete payload.pid;
    const pre = document.createElement("pre"); pre.className = "fi-pre";
    pre.textContent = JSON.stringify("data" in payload && Object.keys(payload).length === 1 ? payload.data : payload, null, 1);
    inspectBody.append(pre);
    const p = document.createElement("p"); p.className = "fi-sentence";
    p.textContent = `args: ${JSON.stringify(args)} — the tokens replay the propagation ORDER; per-wire values aren't reported by the platform.`;
    inspectBody.append(p);
  }

  // ── the in-editor journal (facet "flow" on the control's _patches) ─────────
  async function refreshJournal() {
    if (!editable || !source) { journalBox.hidden = true; return; }
    const r = await listPatches(source.lib, source.ctl, 30);
    if (r.status !== "ok") { journalBox.hidden = true; return; }
    const rows = (r.patches || []).filter((p) => p.facet === "flow" && p.cmd === source.cmd).slice(0, 12);
    journalBox.hidden = rows.length === 0;
    journalList.replaceChildren();
    for (const p of rows) {
      const li = document.createElement("li");
      const row = document.createElement("div"); row.className = "jl-row";
      // the label is the disclosure: a journal entry's real content is WHAT
      // CHANGED, and the label is only the author's word for it
      const label = document.createElement("button"); label.className = "jl-label";
      label.setAttribute("aria-expanded", "false");
      label.innerHTML = `<span class="jl-caret" aria-hidden="true">▸</span>` +
        `<span>${escape(p.label || p.patch_id || "—")}</span>`;
      const author = document.createElement("span"); author.className = "jl-author";
      author.textContent = p.author || "";
      row.append(label, author);
      if (p.old) { // no `old` = the creation entry — nothing to revert to
        const rv = document.createElement("button"); rv.className = "jl-revert"; rv.textContent = "revert";
        rv.title = "write this entry's before-state as a NEW journaled patch";
        rv.addEventListener("click", () => revertTo(p));
        row.appendChild(rv);
      }
      li.appendChild(row);
      const diffBox = document.createElement("div"); diffBox.className = "jl-diff"; diffBox.hidden = true;
      li.appendChild(diffBox);
      label.addEventListener("click", () => toggleDiff(p, label, diffBox));
      journalList.appendChild(li);
    }
  }

  // ── journal diff (3D-P3): what an entry actually did, structurally ─────────
  const DIFF_GLYPH = { "op+": "+", "op-": "−", "op~": "~", "wire+": "⌁", "wire-": "⌁",
    sig: "▤", "deck+": "▤", "deck-": "▤" };
  const DIFF_CLASS = { "op+": "add", "op-": "del", "op~": "mod", "wire+": "add",
    "wire-": "del", sig: "mod", "deck+": "add", "deck-": "del" };
  function toggleDiff(p, label, box) {
    const open = label.getAttribute("aria-expanded") === "true";
    // accordion: only one entry open, or the strip grows past the rail
    for (const other of journalList.querySelectorAll(".jl-label[aria-expanded='true']")) {
      other.setAttribute("aria-expanded", "false");
      other.querySelector(".jl-caret").textContent = "▸";
      other.closest("li").querySelector(".jl-diff").hidden = true;
    }
    if (open) return;
    label.setAttribute("aria-expanded", "true");
    label.querySelector(".jl-caret").textContent = "▾";
    box.hidden = false;
    if (box.dataset.built) return;
    box.dataset.built = "1";
    box.replaceChildren(...renderDiff(p));
  }
  function renderDiff(p) {
    const out = [];
    const note = (t) => { const el = document.createElement("p"); el.className = "jl-note"; el.textContent = t; return el; };
    if (!p.new) return [note("this entry recorded no body")];
    if (!p.old) {   // creation entry: summarize what was created
      const c = parse(p.new).root;
      return [note(`created · ${c.cmds.length} op${c.cmds.length === 1 ? "" : "s"}, ` +
        `${c.cons.length} wire${c.cons.length === 1 ? "" : "s"}`)];
    }
    const { changes, counts } = diffFlow(p.old, p.new);
    if (!changes.length) return [note("no structural change (formatting or identical bodies)")];
    const head = document.createElement("p"); head.className = "jl-note";
    head.textContent = `+${counts.added} −${counts.removed} ~${counts.changed}`;
    out.push(head);
    const ul = document.createElement("ul"); ul.className = "jl-diff-list";
    const MAX = 12;
    for (const ch of changes.slice(0, MAX)) {
      const li = document.createElement("li");
      li.className = "jl-ch jl-" + (DIFF_CLASS[ch.kind] || "mod");
      const g = document.createElement("span"); g.className = "jl-g"; g.textContent = DIFF_GLYPH[ch.kind] || "·";
      const t = document.createElement("span");
      t.textContent = (changes.some((x) => x.deck !== ch.deck) ? `case ${ch.deck + 1}: ` : "") + ch.text;
      li.append(g, t); ul.appendChild(li);
    }
    out.push(ul);
    if (changes.length > MAX) out.push(note(`…and ${changes.length - MAX} more`));
    return out;
  }

  async function revertTo(p) {
    let body;
    try { body = typeof p.old === "string" ? JSON.parse(p.old) : p.old; }
    catch { setStatus("journal entry has no readable body", "bad"); return; }
    const cur = await readFlowBody(source.lib, source.ctl, source.cmd);
    const w = await writeFlowBody(source.lib, source.ctl, source.cmd, body,
      { base: cur.status === "ok" ? (cur.hash || "") : "", label: `revert: ${p.label || p.patch_id}` });
    if (w.status !== "ok") { setStatus(`revert failed: ${w.msg}`, "bad"); return; }
    doc = parse(body); baseHash = w.hash || "";
    stack = [{ label: "case 1", case: doc.root, path: "case" }]; activeDeck = 0;
    undoStack = []; redoStack = []; pendingLabels = []; dirty = false;
    render(); updateEditUi(); refreshJournal();
    setStatus("reverted — as a new journal entry", "ok");
  }

  // ── mutation bookkeeping / undo / redo ─────────────────────────────────────
  function commitApplied(cmd) { undoStack.push(cmd); redoStack = []; pendingLabels.push(cmd.label); dirty = true; afterMutation(); }
  function undo() { if (!editable || !undoStack.length) return; const cmd = undoStack.pop(); cmd.undo(); redoStack.push(cmd); dirty = true; afterMutation(); }
  function redo() { if (!editable || !redoStack.length) return; const cmd = redoStack.pop(); cmd.redo(); undoStack.push(cmd); dirty = true; afterMutation(); }
  function afterMutation() {
    cancelLayoutPreview();
    reprojectLive(); renderDiagnostics();
    if (selectedId && specById.has(selectedId)) {
      mark(selectedId);
      const s = specById.get(selectedId);
      if (editable && s?.meta?.role === "op" && activeSpec(selectedId)) showHandles(s.meta.opIndex);
    } else { selectedId = null; clearHandles(); stage.emphasize(null); inspectEmpty(); }
    refreshPopover();
    updateEditUi();
  }

  // ── saving (write_flow_body, base-hash → stale_base → conflict) ─────────────
  async function save() {
    if (!editable || !dirty || saving) return;
    saving = true; updateEditUi();
    const label = pendingLabels.slice(-8).join("; ") || "flow edit";
    const r = await writeFlowBody(source.lib, source.ctl, source.cmd, doc.serialize(), { base: baseHash, label });
    saving = false;
    if (r.status === "ok") { baseHash = r.hash || baseHash; dirty = false; pendingLabels = []; setStatus(`saved · ${r.patch_id || "ok"}`, "ok"); refreshJournal(); }
    else if (r.msg === "stale_base") { showConflict(); }
    else setStatus(`save failed: ${r.msg}`, "bad");
    updateEditUi();
  }

  function showConflict() {
    conflictEl.hidden = false;
    conflictEl.querySelector(".fx-conflict-msg").textContent = "this flow changed on the server since you loaded it";
    conflictEl.querySelector(".fx-conflict-theirs").onclick = async () => {
      const r = await readFlowBody(source.lib, source.ctl, source.cmd);
      if (r.status === "ok" && r.exists) {
        doc = parse(r.body); baseHash = r.hash || "";
        stack = [{ label: "case 1", case: doc.root, path: "case" }]; activeDeck = 0;
        undoStack = []; redoStack = []; pendingLabels = []; dirty = false;
        conflictEl.hidden = true; render(); updateEditUi(); setStatus("loaded theirs — your edits discarded", "bad");
      }
    };
    conflictEl.querySelector(".fx-conflict-mine").onclick = async () => {
      const r = await readFlowBody(source.lib, source.ctl, source.cmd);
      const base = r.status === "ok" ? (r.hash || "") : "";
      const w = await writeFlowBody(source.lib, source.ctl, source.cmd, doc.serialize(), { base, label: (pendingLabels.slice(-8).join("; ") || "flow edit") + " (overwrite)" });
      conflictEl.hidden = true;
      if (w.status === "ok") { baseHash = w.hash || baseHash; dirty = false; pendingLabels = []; setStatus("overwrote — mine saved", "ok"); refreshJournal(); }
      else setStatus(`overwrite failed: ${w.msg}`, "bad");
      updateEditUi();
    };
  }

  let _statusTimer = 0;
  function setStatus(text, cls) {
    statusEl.textContent = text; statusEl.className = "fx-status" + (cls ? " " + cls : "");
    clearTimeout(_statusTimer); _statusTimer = setTimeout(() => { statusEl.textContent = ""; statusEl.className = "fx-status"; }, 4000);
  }
  function updateEditUi() {
    host.classList.toggle("editing", editable);
    runBtn.hidden = !editable;
    saveBtn.hidden = !editable;
    saveBtn.disabled = !dirty || saving;
    saveBtn.classList.toggle("dirty", dirty && !saving);
    saveBtn.textContent = saving ? "saving…" : dirty ? "save" : "saved";
    host.querySelector(".fx-edit-note").hidden = !editable;
    host.querySelector(".fx-ro-note").hidden = editable;
    host.querySelectorAll(".fx-edit-keys").forEach((el) => { el.hidden = !editable; });
    host.querySelector(".fx-layout-lbl").hidden = !editable;
    host.querySelector(".fx-layout-btns").hidden = !editable;
  }

  // node/terminal helpers for gestures
  function termNode(c, m) { if (m.idx === -1) return c.input[m.term]; if (m.idx === -2) return c.output[m.term]; const op = c.cmds[m.idx]; return op && (m.which === "in" ? op.in : op.out)[m.term]; }
  function setTermX(c, m, x) {
    const node = termNode(c, m); if (!node) return 0;
    let nx = x;
    if (m.idx >= 0) { const half = c.cmds[m.idx].width / 2 - 0.1; nx = Math.max(-half, Math.min(half, x)); }
    node.x = nx; return nx;
  }
  function nameOf(c, idx) { return idx === -1 ? "params" : idx === -2 ? "return" : (c.cmds[idx]?.name || `op${idx}`); }

  // ── tags / inspector ────────────────────────────────────────────────────────
  function flashTag(text, p) {
    tagEl.textContent = text; tagEl.hidden = false;
    const r = stageHost.getBoundingClientRect();
    tagEl.style.left = (p.x - r.left) + "px"; tagEl.style.top = (p.y - r.top) + "px";
  }
  function showTag(spec) {
    if (!spec) { tagEl.hidden = true; return; }
    const m = spec.meta || {};
    let text = "";
    if (m.role === "op") text = `op · ${m.opType} ${KIND_GLYPH[m.opType] || ""}`.trim();
    else if (m.role === "terminal") text = `terminal · ${m.term}${editable && m.which === "out" ? " — drag to wire" : ""}`;
    else if (m.role === "wire") text = `wire · ${wireText(m)}${editable ? " — Del to remove" : ""}`;
    else if (m.role === "bar") text = `${m.which} bar — the signature`;
    else if (m.role === "flag") text = `condition · ${m.rule}`;
    else if (m.role === "loop") text = `loop · ${m.out} → ${m.in}`;
    else if (m.role === "widthHandle") text = "drag — width";
    else return (tagEl.hidden = true);
    tagEl.textContent = text; tagEl.hidden = false;
    tagEl.style.left = pointer.x + "px"; tagEl.style.top = pointer.y + "px";
  }

  function wireText(m) {
    const c = focusedCase(), w = m.con;
    const destNode = w.dest[0] >= 0 ? c.cmds[w.dest[0]]?.in[w.dest[1]] : c.output[w.dest[1]];
    return `${w.dest[1]} : ${destNode?.type || "?"}`;
  }

  function inspectEmpty() {
    inspectBody.innerHTML = `<p class="fx-empty">Select an element. Local sub-flows drill in on ` +
      `double-click or <kbd>Enter</kbd> — you are inside the program, not looking at a picture of it.` +
      (editable ? ` Drag an op to move, an output socket to wire — or select one and ` +
        `press <kbd>W</kbd> to wire without the pointer.` : ``) + `</p>`;
  }
  function inspect(spec) {
    if (!spec) return inspectEmpty();
    const m = spec.meta || {};
    inspectBody.replaceChildren();
    if (m.role === "op") return inspectOp(m);
    if (m.role === "wire") return inspectSimple("wire", wireText(m), {
      from: `${nameOf(focusedCase(), m.con.src[0])} · ${m.con.src[1]}`,
      to: `${nameOf(focusedCase(), m.con.dest[0])} · ${m.con.dest[1]}`,
    }, editable ? "Press Delete to remove this wire." : undefined);
    if (m.role === "terminal") return inspectSimple("terminal", m.term, { side: m.which === "in" ? "input" : "output" }, editable ? "Alt+drag to move along the edge; drag an output to wire." : undefined);
    if (m.role === "bar") {
      const c = focusedCase(); const nodes = m.which === "input" ? c.input : c.output;
      return inspectSimple(m.which === "input" ? "params" : "return", m.which === "input" ? "params" : "return",
        Object.fromEntries(Object.entries(nodes).map(([k, n]) => [k, n.type || "?"])),
        "The bars are the command’s signature — renaming a terminal renames the parameter.");
    }
    if (m.role === "flag") return inspectSimple("condition", m.rule, { rule: m.rule, "fires when match =": String(m.value) }, conditionSentence(m.rule, m.value));
    if (m.role === "loop") return inspectSimple("loop", `${m.out} → ${m.in}`, {}, "A loop-mode output feeds the named input each iteration (§2.6).");
    if (m.role === "widthHandle") return inspectSimple("width", "drag handle", {}, "Drag to resize the op (min 0.6).");
  }
  function inspectOp(m) {
    const name = document.createElement("div"); name.className = "fi-name"; name.textContent = `${KIND_GLYPH[m.opType] || ""} ${m.name}`.trim();
    const badge = document.createElement("span"); badge.className = "fi-kind"; badge.textContent = m.opType;
    inspectBody.append(name, badge);
    const rows = {};
    if (m.ctype) rows.ctype = m.ctype;
    if (m.cmd) rows["command id"] = m.cmd;
    const op = focusedCase().cmds[m.opIndex];
    rows.inputs = Object.keys(op.in).join(", ") || "—";
    rows.outputs = Object.keys(op.out).join(", ") || "—";
    if (op.condition) rows.condition = `${op.condition.rule} when match=${op.condition.value}`;
    appendDl(rows);
    if (m.opType === "local") { const p = document.createElement("p"); p.className = "fi-sentence"; p.textContent = "double-click the glass case (or Enter) to drill into this sub-flow"; inspectBody.append(p); }
    if (m.opType === "command" && m.cmd) { const parts = String(m.cmd).split(":"); if (parts.length === 3) { const a = document.createElement("a"); a.className = "fi-open"; a.href = `#/bench/${parts[0]}/${parts[1]}`; a.textContent = "open ▸ the callee’s bench"; inspectBody.append(a); } }
    if (m.opType === "command" && Object.keys(op.out).length > 1) { const w = document.createElement("p"); w.className = "fi-sentence"; w.textContent = "⚠ multi-output command call — outputs map positionally over unordered callee keys (I-7)."; inspectBody.append(w); }
    if (editable) { const p = document.createElement("p"); p.className = "fi-sentence"; p.textContent = "drag to move · side handles resize · alt+drag a socket to move a terminal"; inspectBody.append(p); }
  }
  function inspectSimple(kind, name, rows, sentence) {
    const n = document.createElement("div"); n.className = "fi-name"; n.textContent = name;
    const badge = document.createElement("span"); badge.className = "fi-kind"; badge.textContent = kind;
    inspectBody.append(n, badge);
    if (sentence) { const p = document.createElement("p"); p.className = "fi-sentence"; p.textContent = sentence; inspectBody.append(p); }
    appendDl(rows);
  }
  function appendDl(rows) {
    const dl = document.createElement("dl");
    for (const [k, v] of Object.entries(rows)) { const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; dl.append(dt, dd); }
    inspectBody.append(dl);
  }
  function conditionSentence(rule, value) {
    const act = { next: "run the next case", terminate: "end the flow", fail: "fail (a match-failure of the caller)", finish: "end the loop iteration" }[rule] || rule;
    return `when this op’s match = ${value} → ${act}.`;
  }
  function renderDiagnostics() {
    const diags = doc.diagnosticsFor(focusedPath());
    if (!diags.length) { diagBox.hidden = true; return; }
    diagBox.hidden = false; diagList.replaceChildren();
    for (const d of diags) {
      const li = document.createElement("li"); li.className = d.severity;
      const code = document.createElement("span"); code.className = "code"; code.textContent = d.code;
      const msg = document.createElement("span"); msg.textContent = d.message;
      li.append(code, msg); diagList.appendChild(li);
    }
  }

  // ── camera / projection toolbar ────────────────────────────────────────────
  function setProjection(ortho) { projBtn.setAttribute("aria-pressed", String(ortho)); projBtn.textContent = ortho ? "front-ortho" : "persp"; stage.setCameraMode(ortho ? "front" : "persp"); }
  projBtn.addEventListener("click", () => setProjection(projBtn.getAttribute("aria-pressed") !== "true"));
  frameBtn.addEventListener("click", frameDeck);
  runBtn.addEventListener("click", openRunPicker);
  saveBtn.addEventListener("click", save);
  function frameDeck() { const proj = toScene(stack[stack.length - 1].case, projArgs()); if (proj.bounds) stage.flyTo(fitPose(proj.bounds), 320); }
  function fitPose(b) {
    const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, cz = (b.min.z + b.max.z) / 2;
    const r = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, 1);
    // the old front-on framing, expressed over the orbit: horizontal, down −Z
    return { target: { x: cx, y: cy, z: cz }, dist: r * 1.6, theta: 0, phi: Math.PI / 2 };
  }

  // ── keyboard ────────────────────────────────────────────────────────────────
  function topoOrder(c) {
    const N = c.cmds.length, indeg = new Array(N).fill(0), adj = new Map();
    for (const w of c.cons) { const s = w.src[0], d = w.dest[0]; if (s >= 0 && d >= 0) { indeg[d]++; (adj.get(s) || adj.set(s, []).get(s)).push(d); } }
    const q = []; for (let i = 0; i < N; i++) if (!indeg[i]) q.push(i);
    const order = [];
    while (q.length) { const u = q.shift(); order.push(u); for (const v of adj.get(u) || []) if (--indeg[v] === 0) q.push(v); }
    for (let i = 0; i < N; i++) if (!order.includes(i)) order.push(i);
    return order;
  }
  // ── keyboard wiring (§5.6: W starts, arrows choose, Enter commits) ─────────
  // The pointer gesture previews legality and REJECTS bad drops; the keyboard
  // path instead only ever OFFERS legal targets — canWire (I-1 fan-in, I-2 no
  // cycle) filters the candidate list up front, so arrowing can't land on an
  // illegal socket. Same doc.addWire/commitApplied commit as the drag.
  let wireMode = null;   // { src:{idx,term}, cands:[spec], k }

  function outTerminalOf(spec) {
    const m = spec?.meta;
    if (!m) return null;
    if (m.role === "terminal" && m.which === "out") return { idx: m.idx, term: m.term };
    if (m.role === "op") {                     // an op: take its first output
      const op = focusedCase().cmds[m.opIndex];
      const t = op && Object.keys(op.out)[0];
      return t ? { idx: m.opIndex, term: t } : null;
    }
    return null;
  }

  function startKeyboardWiring() {
    if (!editable || !selectedId || !activeSpec(selectedId)) return;
    const src = outTerminalOf(specById.get(selectedId));
    if (!src) return setStatus("select an output socket (or an op) to wire from", "bad");
    const c = focusedCase();
    const cands = [...specById.values()]
      .filter((s) => s.meta?.role === "terminal" && s.meta.which === "in" && activeSpec(s.id))
      .filter((s) => doc.canWire(c, [src.idx, src.term], [s.meta.idx, s.meta.term]).ok)
      // reading order: top to bottom, then left to right — predictable arrows
      .sort((a, b) => { const wa = worldOf(a), wb = worldOf(b); return (wb.y - wa.y) || (wa.x - wb.x); });
    if (!cands.length) return setStatus("no legal target for this output (I-1/I-2)", "bad");
    const from = terminalWorld(c, src.idx, "out", src.term);
    // start on the NEAREST legal target so one Enter is usually the whole job
    let k = 0, best = Infinity;
    cands.forEach((s, i) => {
      const w = worldOf(s);
      const d = Math.hypot(w.x - from.x, w.y - from.y, w.z - from.z);
      if (d < best) { best = d; k = i; }
    });
    wireMode = { src, cands, k };
    showGhostWire(sockIdOf(src.idx, "out", src.term), from);
    showWireCandidate();
  }

  function showWireCandidate() {
    if (!wireMode) return;
    const c = focusedCase();
    const { src, cands, k } = wireMode;
    const t = cands[k];
    const to = terminalWorld(c, t.meta.idx, "in", t.meta.term);
    if (to) moveGhostTip(to);
    stage.emphasize(t.id);
    setStatus(`wire → ${nameOf(c, t.meta.idx)}.${t.meta.term} · ${k + 1}/${cands.length}` +
      ` · ←→ choose · Enter wires · Esc cancels`, "ok");
  }

  function moveWireCandidate(dir) {
    if (!wireMode) return;
    wireMode.k = (wireMode.k + dir + wireMode.cands.length) % wireMode.cands.length;
    showWireCandidate();
  }

  function commitKeyboardWire() {
    if (!wireMode) return;
    const c = focusedCase();
    const { src, cands, k } = wireMode;
    const dest = cands[k].meta;
    endKeyboardWiring();
    const cmd = doc.addWire(c, { src: [src.idx, src.term], dest: [dest.idx, dest.term] });
    if (cmd.error) return setStatus(`wire refused: ${cmd.error}`, "bad");
    commitApplied(cmd);
    setStatus(`wired → ${nameOf(c, dest.idx)}.${dest.term} — ⌘Z undoes`, "ok");
  }

  function endKeyboardWiring() {
    if (!wireMode) return;
    hideGhostWire();
    wireMode = null;
    if (selectedId && specById.has(selectedId)) mark(selectedId);
    else stage.emphasize(null);
  }

  let walkIdx = -1;
  function walkOps(dir) {
    const c = focusedCase(); if (!c.cmds.length) return;
    const order = topoOrder(c);
    walkIdx = (walkIdx + dir + order.length) % order.length;
    const id = `d${activeDeck}/op/${order[walkIdx]}`;
    select(id);
    const w = worldOf(specById.get(id));
    if (w) stage.flyTo({ target: w }, 220);
  }

  host.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); save(); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
    // wire mode owns the arrows/Enter/Esc while it is up (§5.6)
    if (wireMode) {
      switch (e.key) {
        case "ArrowRight": case "ArrowDown": case "Tab":
          e.preventDefault(); moveWireCandidate(e.shiftKey ? -1 : 1); return;
        case "ArrowLeft": case "ArrowUp":
          e.preventDefault(); moveWireCandidate(-1); return;
        case "Enter": e.preventDefault(); commitKeyboardWire(); return;
        case "Escape": e.preventDefault(); endKeyboardWiring(); setStatus("wiring cancelled"); return;
        default: break;
      }
    }
    switch (e.key) {
      case "w": case "W": if (editable) { e.preventDefault(); startKeyboardWiring(); } break;
      case "2": setProjection(true); break;
      case "3": setProjection(false); break;
      case "f": case "F": {
        const w = selectedId && worldOf(specById.get(selectedId));
        if (w) stage.flyTo({ target: w }, 240); else frameDeck();
        break;
      }
      case "a": case "A": frameDeck(); break;
      case "[": setActiveDeck(activeDeck - 1); break;
      case "]": setActiveDeck(activeDeck + 1); break;
      case "Tab": e.preventDefault(); walkOps(e.shiftKey ? -1 : 1); break;
      case "Enter": {
        const s = selectedId && specById.get(selectedId);
        if (!s) break;
        if (editable && ["op", "terminal", "bar"].includes(s.meta?.role)) openPopover(selectedId);
        else if (s.meta?.role === "op" && s.meta.hasLocal) drill(s.meta.opIndex);
        break;
      }
      case "Delete": case "Backspace": {
        if (!editable || !selectedId) break;
        const s = specById.get(selectedId);
        if (!activeSpec(selectedId)) break;
        if (s?.meta?.role === "wire") { e.preventDefault(); const cmd = doc.removeWire(focusedCase(), s.meta.index); if (!cmd.error) { commitApplied(cmd); select(null); } }
        else if (s?.meta?.role === "op") {
          e.preventDefault();
          const wires = doc.wiresTouching(focusedCase(), s.meta.opIndex);
          const cmd = doc.removeOp(focusedCase(), s.meta.opIndex);
          if (!cmd.error) { commitApplied(cmd); select(null); setStatus(`deleted${wires ? ` (+${wires} wire${wires > 1 ? "s" : ""})` : ""} — ⌘Z undoes`, "ok"); }
        }
        break;
      }
      case "Escape":
        if (layoutPreview) cancelLayoutPreview();
        else if (pickerEl) closePicker();
        else if (popEl) closePopover();
        else if (selectedId) select(null);
        else if (activeDeck > 0) setActiveDeck(0);
        else if (stack.length > 1) { stack.pop(); activeDeck = 0; render(); }
        else onBack?.();
        break;
      default: return;
    }
  });
  host.querySelector(".fx-back").addEventListener("click", () => { if (stack.length > 1) { stack.pop(); activeDeck = 0; render(); } else onBack?.(); });

  // ── enable editing on a writable live connection with the flow-body API ─────
  async function enableEditing() {
    if (!source) return updateEditUi();
    const r = await readFlowBody(source.lib, source.ctl, source.cmd);
    if (r.status === "ok" && r.exists && r.body) {
      doc = parse(r.body); baseHash = r.hash || ""; editable = true;
      stack = [{ label: "case 1", case: doc.root, path: "case" }]; activeDeck = 0;
      render();
      refreshJournal();
    }
    updateEditUi();
  }

  // ── lifecycle (the stage runs its own ResizeObserver) ──────────────────────
  installPalette();
  render(); host.focus(); updateEditUi();
  enableEditing();

  return { dispose() { clearLabels(); stage.dispose(); } };
}

function escape(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

  return init(ME, ME.DATA || {});
}).catch(function (e) {
  console.log("floweditor3d failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
