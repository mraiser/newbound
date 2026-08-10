// flowproject.js — the projection: a flowdoc Case → a flat list of nb_three
// stage SPECS (plain JSON; flow3d-design Part II). Pure: no THREE, no DOM, no
// network — a case in, declarative specs out (design §4.1). This module is the
// home of the geometry CONSTANTS (op heights, deck pitch, socket radii — §6.2)
// and it is what the front-ortho parity check exercises (acceptance 2): op
// bodies sit at (pos.x, pos.y, pos.z) and terminals at (pos.x + node.x,
// pos.y ± halfH, pos.z), so the z=0 front projection is the 2D viewer's picture.

// ── geometry constants (versioned with the editor, never persisted) ─────────
//
// LIBRARY control — headless: defines window.NB_FLOWPROJECT once (idempotent across
// installs). Consumers list this control as a hidden data-control child
// div and use the global from their ready.

var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function () {
  if (window.NB_FLOWPROJECT) return;
  window.NB_FLOWPROJECT = (function () {

const GEO = {
  deckPitch: 8,          // nextcase decks recede in −Z at this pitch (§2.4)
  barGap: 1.2,           // bar sits this far beyond the outermost op (§3.1)
  socketR: 0.06,
  boxH: 0.6, boxD: 0.6,          // primitive/command/undefined
  capH: 0.5, capR: 0.25,         // constant/match
  glassH: 0.7, glassD: 0.7,      // local
  cylH: 0.7,                     // persistent
  flagH: 0.35,
  wireR: 0.035,
  miniPad: 0.86,         // miniature fills this fraction of the glass box
};

const KIND_OF = {
  primitive: "box", command: "spine-box", constant: "capsule",
  match: "wedge-capsule", local: "glass-box", persistent: "cylinder",
  undefined: "ghost-box",
};
const GLYPH_OF = {
  primitive: "⚙", command: "▤", local: "▣", constant: "◇",
  match: "◇", persistent: "⛃", undefined: "▢",
};

/** Half the world height of an op body by type — where its top/bottom edges
    (and thus its sockets) sit. */
function halfH(opType) {
  if (opType === "constant" || opType === "match") return GEO.capH / 2;
  if (opType === "local") return GEO.glassH / 2;
  if (opType === "persistent") return GEO.cylH / 2;
  return GEO.boxH / 2;
}

function opBodyParams(op) {
  const w = op.width;
  switch (op.type) {
    case "constant": case "match": return { w, r: GEO.capR };
    case "local": return { w, h: GEO.glassH, d: GEO.glassD };
    case "persistent": return { r: Math.min(w, 0.7) / 2, h: GEO.cylH };
    default: return { w, h: GEO.boxH, d: GEO.boxD };
  }
}

const opMaterial = (op) =>
  op.type === "local" ? "glass" : op.type === "undefined" ? "ghost" : "paper";

/** World position of a terminal socket. idx: op index, or -1 (input bar) /
    -2 (output bar). which: "in" | "out". Returns {x,y,z} or null. */
function terminalPos(c, idx, which, term, bars, deckZ) {
  if (idx === -1) { const n = c.input[term]; return n ? { x: n.x, y: bars.inY, z: deckZ } : null; }
  if (idx === -2) { const n = c.output[term]; return n ? { x: n.x, y: bars.outY, z: deckZ } : null; }
  const op = c.cmds[idx];
  if (!op) return null;
  const node = which === "in" ? op.in[term] : op.out[term];
  if (!node) return null;
  const h = halfH(op.type);
  return { x: op.pos.x + (node.x || 0), y: op.pos.y + (which === "in" ? h : -h), z: op.pos.z + deckZ };
}

function barGeometry(c) {
  // input bar hangs above the highest op top; output bar below the lowest
  // bottom (§3.1). Bars are derived frames — no persisted position.
  let top = 0, bot = 0;
  if (c.cmds.length) {
    top = -Infinity; bot = Infinity;
    for (const op of c.cmds) {
      top = Math.max(top, op.pos.y + halfH(op.type));
      bot = Math.min(bot, op.pos.y - halfH(op.type));
    }
  }
  const inY = (c.cmds.length ? top : 0) + GEO.barGap;
  const outY = (c.cmds.length ? bot : 0) - GEO.barGap;
  const span = (nodes) => {
    const xs = Object.values(nodes).map((n) => n.x || 0);
    return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  };
  return { inY, outY, inLen: span(c.input) + 1, outLen: span(c.output) + 1 };
}

/** Project one case at a given deck depth into `out`. `active` decks get
    sockets, wires, flags, labels and picking; background decks are ghosted
    silhouettes (§2.4). */
function projectCase(c, deckZ, active, out, prefix, casePath) {
  const bars = barGeometry(c);
  const push = (s) => out.specs.push(s);
  const mat = active ? null : "ghost";

  // ── deck ground: dot grid + rounded-rect outline (§2.3) ──
  const xs = c.cmds.map((o) => o.pos.x);
  const gx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
  const wSpan = xs.length ? Math.max(3, Math.max(...xs) - Math.min(...xs) + 3) : 6;
  const ySpan = bars.inY - bars.outY;
  const groundY = bars.outY - 1.6;
  if (active) {
    push({ id: `${prefix}/grid`, kind: "grid", position: { x: gx, y: groundY, z: deckZ }, params: { w: wSpan + 2, d: 6, pitch: 0.2 }, pickable: false });
  }
  push({ id: `${prefix}/outline`, kind: "outline", position: { x: gx, y: groundY, z: deckZ }, params: { w: wSpan + 2, d: 6 }, pickable: false, material: mat });

  // ── bars (the command's signature) ──
  push({ id: `${prefix}/bar-in`, kind: "rail", position: { x: 0, y: bars.inY, z: deckZ },
    params: { length: Math.max(2, bars.inLen) }, material: mat || "graphite", pickable: active,
    label: active ? { role: "bar", which: "input", text: `⌘ params — ${Object.keys(c.input).join(", ") || "none"}` } : null,
    meta: { role: "bar", which: "input", casePath } });
  push({ id: `${prefix}/bar-out`, kind: "rail", position: { x: 0, y: bars.outY, z: deckZ },
    params: { length: Math.max(2, bars.outLen) }, material: mat || "graphite", pickable: active,
    label: active ? { role: "bar", which: "output", text: `⌘ return — ${Object.keys(c.output).join(", ") || "none"}` } : null,
    meta: { role: "bar", which: "output", casePath } });
  if (active) {
    for (const [term, n] of Object.entries(c.input))
      push({ id: `${prefix}/bt-in/${term}`, kind: "socket", position: { x: n.x, y: bars.inY, z: deckZ }, params: { r: GEO.socketR, wired: true, mode: n.mode }, pickable: true, meta: { role: "terminal", idx: -1, which: "out", term, casePath } });
    for (const [term, n] of Object.entries(c.output))
      push({ id: `${prefix}/bt-out/${term}`, kind: "socket", position: { x: n.x, y: bars.outY, z: deckZ }, params: { r: GEO.socketR, wired: true, mode: n.mode }, pickable: true, meta: { role: "terminal", idx: -2, which: "in", term, casePath } });
  }

  // ── operations ──
  c.cmds.forEach((op, i) => {
    const id = `${prefix}/op/${i}`;
    const kind = KIND_OF[op.type] || "box";
    push({
      id, kind, position: { x: op.pos.x, y: op.pos.y, z: op.pos.z + deckZ },
      params: opBodyParams(op),
      material: mat || opMaterial(op),
      pickable: active,
      label: active ? { role: "op", text: `${GLYPH_OF[op.type] || ""} ${op.name}`.trim(), sub: op.type } : null,
      meta: { role: "op", opIndex: i, opType: op.type, name: op.name, hasLocal: !!op.localdata, ctype: op.ctype, cmd: op.cmd, casePath },
    });
    if (!active) return;
    const h = halfH(op.type);
    // sockets: inputs on the top edge, outputs on the bottom edge
    for (const [term, n] of Object.entries(op.in))
      push({ id: `${id}/in/${term}`, kind: "socket", position: { x: op.pos.x + (n.x || 0), y: op.pos.y + h, z: op.pos.z + deckZ }, params: { r: GEO.socketR, wired: true, mode: n.mode }, pickable: true, meta: { role: "terminal", idx: i, which: "in", term, casePath } });
    for (const [term, n] of Object.entries(op.out))
      push({ id: `${id}/out/${term}`, kind: "socket", position: { x: op.pos.x + (n.x || 0), y: op.pos.y - h, z: op.pos.z + deckZ }, params: { r: GEO.socketR, wired: true, mode: n.mode }, pickable: true, meta: { role: "terminal", idx: i, which: "out", term, casePath } });
    // condition flag at the op's top-+X corner (§2.3)
    if (op.condition && op.condition.rule) {
      push({ id: `${id}/flag`, kind: "flag", position: { x: op.pos.x + op.width / 2, y: op.pos.y + h, z: op.pos.z + deckZ }, params: { rule: op.condition.rule, height: GEO.flagH }, pickable: true, meta: { role: "flag", opIndex: i, rule: op.condition.rule, value: op.condition.value, casePath } });
      // a `next` rule grows a jump pipe diving into the next deck (§2.4)
      if (op.condition.rule === "next" && c.nextcase)
        push({ id: `${id}/jump`, kind: "jump-pipe", position: { x: 0, y: 0, z: 0 }, params: { from: { x: op.pos.x + op.width / 2, y: op.pos.y + h + GEO.flagH, z: op.pos.z + deckZ }, to: { x: 0, y: bars.inY, z: deckZ - GEO.deckPitch } }, pickable: false, meta: { role: "jump", opIndex: i } });
    }
    // loop pairs → a helix return along the +X side (§2.6)
    for (const [term, n] of Object.entries(op.out)) {
      if (n.mode === "loop" && n.loop && op.in[n.loop]) {
        push({ id: `${id}/helix/${term}`, kind: "helix", position: { x: 0, y: 0, z: 0 },
          params: { from: { x: op.pos.x + (n.x || 0), y: op.pos.y - h, z: op.pos.z + deckZ }, to: { x: op.pos.x + (op.in[n.loop].x || 0), y: op.pos.y + h, z: op.pos.z + deckZ }, radius: 0.2 },
          pickable: true, meta: { role: "loop", opIndex: i, out: term, in: n.loop, casePath } });
      }
    }
    // local sub-flow: a simplified miniature inside the glass box (LOD "mid")
    if (op.type === "local" && op.localdata) {
      projectMiniature(op.localdata, id, out);
    }
  });

  // ── wires (vertical-tangent tubes) ──
  if (active) {
    c.cons.forEach((w, wi) => {
      const from = terminalPos(c, w.src[0], "out", w.src[1], bars, deckZ) || terminalPos(c, w.src[0], "in", w.src[1], bars, deckZ);
      const to = terminalPos(c, w.dest[0], "in", w.dest[1], bars, deckZ) || terminalPos(c, w.dest[0], "out", w.dest[1], bars, deckZ);
      if (!from || !to) return;
      const destNode = w.dest[0] >= 0 ? c.cmds[w.dest[0]]?.in[w.dest[1]] : c.output[w.dest[1]];
      push({ id: `${prefix}/wire/${wi}`, kind: "tube", position: { x: 0, y: 0, z: 0 }, params: { from, to, r: GEO.wireR }, material: "wire", pickable: true,
        label: { role: "wire", text: `${w.dest[1]} : ${destNode?.type || "?"}`, mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 } },
        meta: { role: "wire", index: wi, con: w, casePath } });
    });
  }

  // bounds for framing (active deck)
  if (active) {
    let minX = -1.5, maxX = 1.5, minY = bars.outY, maxY = bars.inY;
    for (const op of c.cmds) {
      minX = Math.min(minX, op.pos.x - op.width / 2); maxX = Math.max(maxX, op.pos.x + op.width / 2);
      minY = Math.min(minY, op.pos.y - halfH(op.type)); maxY = Math.max(maxY, op.pos.y + halfH(op.type));
    }
    out.bounds = { min: { x: minX, y: minY, z: deckZ - 0.5 }, max: { x: maxX, y: maxY, z: deckZ + 0.5 } };
  }
}

/** A local's miniature, parented to its glass box in the box's LOCAL frame
    (LOD, §7.5): op-body silhouettes (level "mid", visible by default) plus
    op-to-op wires (level "full" — the control shows them only up close and
    hides everything beyond the far threshold; the DOM label's ▣ glyph is the
    far representation). */
function projectMiniature(sub, glassId, out) {
  const ops = sub.cmds;
  if (!ops.length) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const op of ops) { minX = Math.min(minX, op.pos.x); maxX = Math.max(maxX, op.pos.x); minY = Math.min(minY, op.pos.y); maxY = Math.max(maxY, op.pos.y); }
  const w = Math.max(maxX - minX, 0.1), hgt = Math.max(maxY - minY, 0.1);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const scale = Math.min(GEO.glassH * GEO.miniPad / hgt, (GEO.glassH * GEO.miniPad) / w, 0.25);
  const at = (op) => ({ x: (op.pos.x - cx) * scale, y: (op.pos.y - cy) * scale, z: 0 });
  ops.forEach((op, i) => {
    out.specs.push({
      id: `${glassId}/mini/${i}`, parent: glassId, kind: "box",
      position: at(op),
      params: { w: Math.max(0.06, op.width * scale * 0.7), h: 0.06, d: 0.06 },
      material: "paper", pickable: false, meta: { role: "mini", opIndex: i },
    });
  });
  // full-LOD wires (op→op only; the mini has no bars). Parented tubes stay
  // individual meshes in the wrapper — they never hit the wire pool.
  sub.cons.forEach((wr, k) => {
    const s = wr.src[0], d = wr.dest[0];
    if (s < 0 || d < 0 || !ops[s] || !ops[d]) return;
    out.specs.push({
      id: `${glassId}/miniwire/${k}`, parent: glassId, kind: "tube",
      position: { x: 0, y: 0, z: 0 },
      params: { from: at(ops[s]), to: at(ops[d]), r: 0.008 },
      material: "wire", pickable: false, visible: false,
      meta: { role: "miniwire", index: k },
    });
  });
}

/**
 * Project a case (its whole nextcase chain as a receding deck stack) to specs.
 * @param {object} rootCase a normalized flowdoc Case
 * @param {object} opts { activeDeck?: number } — which deck of the chain is front
 * @returns {{specs: object[], bounds: object, deckCount: number}}
 */
function project(rootCase, opts = {}) {
  const out = { specs: [], bounds: null, deckCount: 0 };
  const active = opts.activeDeck ?? 0;
  let c = rootCase, deck = 0;
  const chain = [];
  while (c) { chain.push(c); c = c.nextcase; }
  out.deckCount = chain.length;
  chain.forEach((cs, idx) => {
    // active deck sits at z=0; others recede in −Z relative to it
    const deckZ = (idx - active) * -GEO.deckPitch;
    projectCase(cs, deckZ, idx === active, out, `d${idx}`, deckLabel(idx));
  });
  return out;
}

const deckLabel = (i) => (i === 0 ? "case" : "case".padEnd(0) + `.next`.repeat(i));

/** Front-ortho screen projection of a world point at scale S (px/unit), y-down,
    with a chosen screen origin. This is the exact mapping the parity check uses
    to compare against the 2D viewer (S = 140). Pure math, exported for tests. */
function frontOrtho(worldPt, S, originX, originY) {
  return { x: worldPt.x * S + originX, y: -worldPt.y * S + originY };
}

/** World position of a terminal on the ACTIVE deck (deckZ = 0) — for the
    editor's wiring ghost and terminal drags. idx: op index, or -1 (params bar) /
    -2 (return bar). which: "in" | "out". Returns {x,y,z} | null. */
function terminalWorld(c, idx, which, term) {
  return terminalPos(c, idx, which, term, barGeometry(c), 0);
}

/** A point on a wire's spline at t ∈ [0,1] — the SAME vertical-tangent cubic
    the stage builds its tubes from (§3.2: tangent magnitude 0.4·length,
    clamped 0.5–2), replicated as pure math so execution tokens (3D-5) ride
    exactly the rendered tube. Keep in lockstep with stage._curveVertical. */
function wireCurvePoint(from, to, t) {
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const m = Math.max(0.5, Math.min(2, 0.4 * len));
  const p1 = { x: from.x, y: from.y - m, z: from.z };
  const p2 = { x: to.x, y: to.y + m, z: to.z };
  const u = 1 - t;
  const b = (a, b1, c2, d) => u * u * u * a + 3 * u * u * t * b1 + 3 * u * t * t * c2 + t * t * t * d;
  return { x: b(from.x, p1.x, p2.x, to.x), y: b(from.y, p1.y, p2.y, to.y), z: b(from.z, p1.z, p2.z, to.z) };
}

// ── the state-shaped projection (R-4: the flow port on the scene stack) ─────
// The same Case, projected into the SCENE SCHEMA instead of stage specs: ops
// are scene nodes (tap/drag/hover affordances, flow meta riding the spec),
// sockets are CHILD spheres of their op, and wires are curve:"hang" LINKS
// BETWEEN SOCKET NODES — the scene stack re-resolves link endpoints every
// rendered frame, so wires follow a dragged op with no editor bookkeeping.
// Composites decompose into parented primitives (the converged scenestage
// pools parented, rotated nodes: a constant's capsule is a z-rotated
// cylinder). Decks are parent nodes; children live in deck-local
// coordinates, so the receding stack is one transform per deck.
//
// Fidelity notes (honest, DEVIATIONS 19): loop helixes render as hang links
// (not side helixes), jump pipes and the deck ground grid/outline are not
// yet projected, and miniature wires (LOD "full") are omitted — the mid-LOD
// miniature boxes ride along parented to their glass op.

const SCENE_COLORS = {
  paper: "#f6f4ee", ghost: "#3a424c", glassTint: "#62bd8c",
  graphite: "#2d343c", wire: "#8a94a0", socket: "#f0a63c", flag: "#c15a5a",
};

function opSceneNode(op, i, deckId, prefix, active, editable, push) {
  const id = `${prefix}/op/${i}`;
  const h = halfH(op.type);
  const base = {
    id, parent: deckId,
    pos: { x: op.pos.x, y: op.pos.y, z: op.pos.z },
    affordances: active
      ? (editable ? { tap: true, drag: { plane: "xy", altPlane: "xz" }, hover: true }
                  : { tap: true, hover: true })
      : undefined,
    meta: { role: "op", opIndex: i, opType: op.type, name: op.name,
      hasLocal: !!op.localdata, ctype: op.ctype, cmd: op.cmd },
  };
  const mat = (c, extra) => ({ color: c, flat: true, ...(extra || {}) });
  const ghosted = active ? null : { opacity: 0.35 };
  switch (op.type) {
    case "constant": case "match":
      // the op node is a pure TRANSFORM HOLDER (the deck-node idiom): the
      // capsule body rotates, but sockets/tag/flag parented to the op must
      // stay axis-aligned — a rotated parent would swing them around z
      push({ ...base, kind: "box", params: { size: { x: 0.001, y: 0.001, z: 0.001 } },
        material: mat(SCENE_COLORS.graphite) });
      push({ id: `${id}/body`, parent: id, kind: "cylinder", rot: { x: 0, y: 0, z: Math.PI / 2 },
        params: { radius: GEO.capR, height: op.width },
        material: mat(active ? SCENE_COLORS.paper : SCENE_COLORS.ghost, ghosted),
        affordances: base.affordances, meta: base.meta });
      break;
    case "local":
      push({ ...base, kind: "box",
        params: { size: { x: op.width, y: GEO.glassH, z: GEO.glassD } },
        material: mat(SCENE_COLORS.glassTint, { opacity: active ? 0.28 : 0.15 }) });
      break;
    case "persistent":
      push({ ...base, kind: "cylinder",
        params: { radius: Math.min(op.width, 0.7) / 2, height: GEO.cylH },
        material: mat(active ? SCENE_COLORS.paper : SCENE_COLORS.ghost, ghosted) });
      break;
    default: // primitive / command / undefined
      push({ ...base, kind: "box",
        params: { size: { x: op.width, y: GEO.boxH, z: GEO.boxD } },
        material: op.type === "undefined"
          ? mat(SCENE_COLORS.ghost, { opacity: 0.45 })
          : mat(active ? SCENE_COLORS.paper : SCENE_COLORS.ghost, ghosted) });
      if (op.type === "command") {
        push({ id: `${id}/spine`, parent: id, kind: "box",
          pos: { x: 0, y: GEO.boxH / 2 + 0.02, z: 0 },
          params: { size: { x: op.width, y: 0.04, z: GEO.boxD } },
          material: mat(SCENE_COLORS.graphite) });
      }
  }
  if (active) {
    push({ id: `${id}/tag`, parent: id, kind: "text",
      pos: { x: 0, y: h + 0.22, z: 0 },
      text: { text: `${GLYPH_OF[op.type] || ""} ${op.name}`.trim(), size: 0.85 } });
    if (op.type === "local" && op.localdata) {
      const sub = op.localdata, ops = sub.cmds || [];
      if (ops.length) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const o2 of ops) { minX = Math.min(minX, o2.pos.x); maxX = Math.max(maxX, o2.pos.x); minY = Math.min(minY, o2.pos.y); maxY = Math.max(maxY, o2.pos.y); }
        const w = Math.max(maxX - minX, 0.1), hg = Math.max(maxY - minY, 0.1);
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const scale = Math.min((GEO.glassH * GEO.miniPad) / hg, (GEO.glassH * GEO.miniPad) / w, 0.25);
        ops.forEach((o2, k) => push({
          id: `${id}/mini/${k}`, parent: id, kind: "box",
          pos: { x: (o2.pos.x - cx) * scale, y: (o2.pos.y - cy) * scale, z: 0 },
          params: { size: { x: Math.max(0.06, o2.width * scale * 0.7), y: 0.06, z: 0.06 } },
          material: mat(SCENE_COLORS.paper) }));
      }
    }
  }
  return h;
}

/**
 * Project a case chain into the SCENE SCHEMA (scenestage vocabulary): the
 * state-shaped flow view. Same signature family as project().
 * @returns {{specs: object[], bounds: object, deckCount: number}}
 */
function toScene(rootCase, opts = {}) {
  const activeDeck = opts.activeDeck ?? 0;
  const editable = opts.editable ?? true;
  const specs = [];
  const push = (s) => specs.push(s);
  let bounds = null;
  const chain = [];
  let c0 = rootCase;
  while (c0) { chain.push(c0); c0 = c0.nextcase; }
  chain.forEach((c, idx) => {
    const active = idx === activeDeck;
    const prefix = `d${idx}`;
    const deckId = `${prefix}/deck`;
    const deckZ = (idx - activeDeck) * -GEO.deckPitch;
    const bars = barGeometry(c);
    push({ id: deckId, kind: "box", pos: { x: 0, y: 0, z: deckZ },
      params: { size: { x: 0.001, y: 0.001, z: 0.001 } },
      material: { color: SCENE_COLORS.graphite },
      meta: { role: "deck", index: idx } });

    // bars (the signature) — thin boxes; their terminals are deck children
    const rail = (which, y, len) => push({
      id: `${prefix}/bar-${which}`, parent: deckId, kind: "box",
      pos: { x: 0, y, z: 0 },
      params: { size: { x: Math.max(2, len), y: 0.06, z: 0.2 } },
      material: { color: SCENE_COLORS.graphite, flat: true, ...(active ? {} : { opacity: 0.35 }) },
      affordances: active ? { tap: true } : undefined,
      meta: { role: "bar", which: which === "in" ? "input" : "output" } });
    rail("in", bars.inY, bars.inLen);
    rail("out", bars.outY, bars.outLen);

    c.cmds.forEach((op, i) => {
      const h = opSceneNode(op, i, deckId, prefix, active, editable, push);
      if (!active) return;
      const opId = `${prefix}/op/${i}`;
      for (const [term, n] of Object.entries(op.in)) push({
        id: `${opId}/in/${term}`, parent: opId, kind: "sphere",
        pos: { x: n.x || 0, y: h, z: 0 }, params: { radius: GEO.socketR },
        material: { color: SCENE_COLORS.socket, emissive: true },
        affordances: editable ? { tap: true, hover: true, drag: { plane: "xy", altPlane: "xy" } }
                              : { tap: true, hover: true },
        meta: { role: "terminal", idx: i, which: "in", term } });
      for (const [term, n] of Object.entries(op.out)) push({
        id: `${opId}/out/${term}`, parent: opId, kind: "sphere",
        pos: { x: n.x || 0, y: -h, z: 0 }, params: { radius: GEO.socketR },
        material: { color: SCENE_COLORS.socket, emissive: true },
        affordances: editable ? { tap: true, hover: true, drag: { plane: "xy", altPlane: "xy" } }
                              : { tap: true, hover: true },
        meta: { role: "terminal", idx: i, which: "out", term } });
      if (op.condition && op.condition.rule) push({
        id: `${opId}/flag`, parent: opId, kind: "cone",
        pos: { x: op.width / 2, y: h + GEO.flagH / 2, z: 0 },
        params: { radius: 0.08, height: GEO.flagH },
        material: { color: SCENE_COLORS.flag, emissive: true },
        affordances: { tap: true, hover: true },
        meta: { role: "flag", opIndex: i, rule: op.condition.rule, value: op.condition.value } });
    });

    if (active) {
      for (const [term, n] of Object.entries(c.input)) push({
        id: `${prefix}/bt-in/${term}`, parent: deckId, kind: "sphere",
        pos: { x: n.x || 0, y: bars.inY, z: 0 }, params: { radius: GEO.socketR },
        material: { color: SCENE_COLORS.socket, emissive: true },
        affordances: editable ? { tap: true, hover: true, drag: { plane: "xy", altPlane: "xy" } }
                              : { tap: true, hover: true },
        meta: { role: "terminal", idx: -1, which: "out", term } });
      for (const [term, n] of Object.entries(c.output)) push({
        id: `${prefix}/bt-out/${term}`, parent: deckId, kind: "sphere",
        pos: { x: n.x || 0, y: bars.outY, z: 0 }, params: { radius: GEO.socketR },
        material: { color: SCENE_COLORS.socket, emissive: true },
        affordances: editable ? { tap: true, hover: true, drag: { plane: "xy", altPlane: "xy" } }
                              : { tap: true, hover: true },
        meta: { role: "terminal", idx: -2, which: "in", term } });

      // wires: hang links BETWEEN SOCKET NODES — endpoint tracking is the
      // scene stack's own job (loop pairs render as hang links; see notes)
      const socketId = (idx2, which, term) =>
        idx2 === -1 ? `${prefix}/bt-in/${term}`
        : idx2 === -2 ? `${prefix}/bt-out/${term}`
        : `${prefix}/op/${idx2}/${which}/${term}`;
      c.cons.forEach((wr, wi) => {
        const from = socketId(wr.src[0], "out", wr.src[1]);
        const to = socketId(wr.dest[0], "in", wr.dest[1]);
        push({ id: `${prefix}/wire/${wi}`, kind: "link", curve: "hang",
          from, to, r: GEO.wireR,
          material: { color: SCENE_COLORS.wire, opacity: 0.75 },
          affordances: { tap: true, hover: true },
          meta: { role: "wire", index: wi, con: wr } });
      });

      let minX = -1.5, maxX = 1.5, minY = bars.outY, maxY = bars.inY;
      for (const op of c.cmds) {
        minX = Math.min(minX, op.pos.x - op.width / 2); maxX = Math.max(maxX, op.pos.x + op.width / 2);
        minY = Math.min(minY, op.pos.y - halfH(op.type)); maxY = Math.max(maxY, op.pos.y + halfH(op.type));
      }
      bounds = { min: { x: minX, y: minY, z: deckZ - 0.5 }, max: { x: maxX, y: maxY, z: deckZ + 0.5 } };
    }
  });
  return { specs, bounds, deckCount: chain.length };
}

    return { GEO, halfH, project, frontOrtho, terminalWorld, wireCurvePoint, toScene };
  })();
};
