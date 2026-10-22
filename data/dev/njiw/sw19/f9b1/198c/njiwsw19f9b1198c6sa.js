// flowproject.js — the projection: a flowdoc Case → a flat list of nb_three
// stage SPECS (plain JSON; flow3d-design Part II). Pure: no THREE, no DOM, no
// network — a case in, declarative specs out (design §4.1). This module is the
// home of the geometry CONSTANTS (op heights, deck pitch, socket radii — §6.2)
// and it is what the front-ortho parity check exercises (acceptance 2): op
// bodies sit at (pos.x, pos.y, pos.z) and terminals at (pos.x + node.x,
// pos.y ± halfH, pos.z), so the z=0 front projection is the 2D viewer's picture.

// ── geometry constants (versioned with the editor, never persisted) ─────────
//
// LIBRARY control — headless: the api rides this control's own element
// (zero-globals doctrine). Consumers mount it as a hidden data-control
// child div and read the element's api.

var me = this;
var ME = document.getElementById(me.UUID);

(function () {

const GEO = {
  deckPitch: 8,          // nextcase decks recede in −Z at this pitch (§2.4)
  barGap: 1.2,           // bar sits this far beyond the outermost op (§3.1)
  socketR: 0.065,
  // the PROGRAPH ICON, extruded: one family for every op kind. A SHELL (its
  // rim reads as the icon's outline) with a FACE standing proud of it front
  // and back; the kind rides Prograph's own marks on the face (see
  // opSceneNode). opH/opD are the OUTER extents — terminals straddle the
  // shell's top edge and roots its bottom edge (±opH/2) for every kind. The
  // icon is nearly as deep as it is tall: a block, not a card.
  opH: 0.5, opD: 0.42, rim: 0.035,
  // sockets sit on the block's FRONT edges (z = opD/2), straddling the top
  // (terminals) and bottom (roots) edge of the face: at mid-depth a deep
  // block hides its bottom sockets from any raised camera
  sockZ: 0.21,
  inlay: 0.014,          // depth of face-mounted marks (primitive posts, local frame)
  barH: 0.16,            // input/output bars: strips spanning the case, sockets on the inner edge
  ctlS: 0.3,             // a condition's control tab, set at the op's right end
  // the CASE WINDOW: a plate behind each deck that the ops stand off and drop
  // an offset shadow onto (shadow offset = this × the standoff)
  plateGap: 0.32, plateT: 0.08, plateMargin: 0.45, shadow: 0.2,
  // legacy project() body sizes — kept equal to the icon so both paths agree
  boxH: 0.5, boxD: 0.42,
  capH: 0.5, capR: 0.25,
  glassH: 0.5, glassD: 0.42,
  cylH: 0.5,
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

/** Half the world height of an op body — where its top/bottom edges (and
    thus its sockets) sit. Prograph icons share ONE height across kinds; the
    type stays in the signature for callers. */
function halfH(opType) {
  return GEO.opH / 2;
}

/** The outer box {x,y,z} of an op's icon — what a dev:flownode pick proxy
    sizes itself to, so a tap lands exactly on the drawn icon. */
function opBox(op) {
  const w = Math.max((op && op.width) || 1, op && op.type === "persistent" ? GEO.opH + 0.1 : 0.4);
  return { x: w, y: GEO.opH, z: GEO.opD };
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
  if (idx === -1) { const n = c.input[term]; return n ? { x: n.x, y: bars.inSockY, z: deckZ + GEO.sockZ } : null; }
  if (idx === -2) { const n = c.output[term]; return n ? { x: n.x, y: bars.outSockY, z: deckZ + GEO.sockZ } : null; }
  const op = c.cmds[idx];
  if (!op) return null;
  const node = which === "in" ? op.in[term] : op.out[term];
  if (!node) return null;
  const h = halfH(op.type);
  return { x: op.pos.x + (node.x || 0), y: op.pos.y + (which === "in" ? h : -h), z: op.pos.z + deckZ + GEO.sockZ };
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
  // Prograph's bars span the whole case: centred over every op (control
  // tabs included) and the bar's own terminals, with a margin
  let lo = Infinity, hi = -Infinity;
  for (const op of c.cmds) {
    const w = op.width || 1;
    lo = Math.min(lo, op.pos.x - w / 2);
    hi = Math.max(hi, op.pos.x + w / 2 + (op.condition && op.condition.rule ? GEO.ctlS + 0.05 : 0));
  }
  for (const n of [...Object.values(c.input), ...Object.values(c.output)]) { lo = Math.min(lo, n.x || 0); hi = Math.max(hi, n.x || 0); }
  if (!isFinite(lo)) { lo = -1; hi = 1; }
  lo -= 0.4; hi += 0.4;
  if (hi - lo < 2) { const m = (lo + hi) / 2; lo = m - 1; hi = m + 1; }
  // inSockY/outSockY: the bar sockets sit on the bar's INNER edge — the input
  // bar's roots hang beneath it, the output bar's terminals stand on it
  return { inY, outY, inLen: span(c.input) + 1, outLen: span(c.output) + 1,
    inSockY: inY - GEO.barH / 2, outSockY: outY + GEO.barH / 2, x: (lo + hi) / 2, len: hi - lo };
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
      push({ id: `${prefix}/bt-in/${term}`, kind: "socket", position: { x: n.x, y: bars.inSockY, z: deckZ }, params: { r: GEO.socketR, wired: true, mode: n.mode }, pickable: true, meta: { role: "terminal", idx: -1, which: "out", term, casePath } });
    for (const [term, n] of Object.entries(c.output))
      push({ id: `${prefix}/bt-out/${term}`, kind: "socket", position: { x: n.x, y: bars.outSockY, z: deckZ }, params: { r: GEO.socketR, wired: true, mode: n.mode }, pickable: true, meta: { role: "terminal", idx: -2, which: "in", term, casePath } });
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

// Op look (PROGRAPH, extruded). Every kind is the same icon — a SHELL whose
// rim reads as the outline, a FACE standing proud of it front and back —
// told apart by Prograph's own marks on that face: a primitive's ‖ end
// posts, a constant's solid lid (nothing comes in), a matcher's solid sill
// (nothing goes out), a local's double outline (a case lives inside), a
// persistent's oval. The icon is a BLOCK and every part is lit and
// flat-shaded, so its top, sides and front each catch the light differently;
// ops stand off the deck's case-window plate and drop an offset shadow onto
// it. A condition is Prograph's CONTROL: a small box at the op's right end,
// ✓/✗ for the outcome it fires on, tinted by the rule it raises.
//
// Colours are ROLES resolved from the bench tokens (app:tokens, where the
// dev app's colours live): each role names the tokens.css property it
// tracks, with that token's v1 value as the fallback. The module stays pure
// — a DOM-side caller passes opts.tokens = (name) => value to follow the
// live tokens; without it the v1 values (the dark bench) apply.
// The scene is LIT: measured on the default stage lights, a front face
// renders at about ½ its colour and a top face at about ⅔ — so each surface
// role names the token one step lighter than where it should land on screen
// (faces land near --panel-3, the plate near --panel, above --ground).
const SCENE_TOKENS = {
  face: ["--text-faint", "#5c6672"],   // the icon face
  undefFace: ["--panel-3", "#2d343c"], // an undefined op: an empty slot
  rim: ["--text-dim", "#8a94a0"],      // the shell — the icon's outline
  ink: ["--text", "#d8dee6"],          // kind marks, sockets
  faint: ["--text-faint", "#5c6672"],  // an undefined op's outline
  plate: ["--line", "#333b44"],        // the case window
  plateRim: ["--text-faint", "#5c6672"],
  wire: ["--text-dim", "#8a94a0"],
  ghost: ["--panel-3", "#2d343c"],     // background decks
  shadow: ["--ground", "#171a1e"],
  next: ["--f-3d", "#62bd8c"], terminate: ["--danger", "#c15a5a"],
  fail: ["--f-js", "#ead16c"], finish: ["--f-css", "#56a3d9"],
};

/** The scene palette: every SCENE_TOKENS role resolved through read(name)
    (e.g. a getComputedStyle getPropertyValue), else its v1 value. */
function scenePalette(read) {
  const pal = {};
  for (const [role, [name, v1]] of Object.entries(SCENE_TOKENS)) {
    let v = "";
    if (typeof read === "function") { try { v = String(read(name) || "").trim(); } catch (e) { v = ""; } }
    pal[role] = /^#[0-9a-f]{3,8}$/i.test(v) ? v : v1;
  }
  return pal;
}

/** The text an op's icon shows: constants/matchers show their LITERAL
    (strings quoted, as Prograph does), every other kind its name. */
function opLabel(op) {
  const v = op.name == null ? "" : String(op.name);
  if (op.type === "constant" || op.type === "match") {
    if (op.ctype === "string" || op.ctype === undefined) return `“${v}”`;
    return v === "" ? "∅" : v;
  }
  if (op.type === "undefined") return v || "?";
  return v;
}

function opSceneNode(op, i, deckId, prefix, active, editable, push, pal, plateZ) {
  pal = pal || scenePalette();
  const id = `${prefix}/op/${i}`;
  const H = GEO.opH, D = GEO.opD, r = GEO.rim, h = halfH(op.type);
  const W = opBox(op).x;
  const fw = W - 2 * r, fh = H - 2 * r;
  const zf = D / 2 + GEO.inlay / 2;          // face-mounted marks sit ON the face
  const z0 = (op.pos && op.pos.z) || 0;
  // the op node is a pure TRANSFORM HOLDER (the deck-node idiom): the icon's
  // parts, sockets, label, shadow and control tab all parent to it
  push({ id, parent: deckId, kind: "box",
    pos: { x: op.pos.x, y: op.pos.y, z: op.pos.z },
    params: { size: { x: 0.001, y: 0.001, z: 0.001 } },
    material: { color: pal.rim, flat: true },
    affordances: active
      ? (editable ? { tap: true, drag: { plane: "xy", altPlane: "xz" }, hover: true }
                  : { tap: true, hover: true })
      : undefined,
    meta: { role: "op", opIndex: i, opType: op.type, name: op.name,
      hasLocal: !!op.localdata, ctype: op.ctype, cmd: op.cmd } });
  const part = (sfx, kind, pos, params, material, rot) => push({ id: `${id}/${sfx}`, parent: id,
    kind, pos, ...(rot ? { rot } : {}), params, material, meta: { role: "op-part", opIndex: i, part: sfx } });
  const lit = (color, extra) => ({ color, flat: true, ...(extra || {}) });
  const ROUND = { x: Math.PI / 2, y: 0, z: 0 };   // a cylinder turned to face +z: a round end
  // a w×hh×d slab at `at`: a box, or (oval) a stadium — a box between two
  // z-facing round caps, the persistent's shape
  const slab = (sfx, w, hh, d, at, mat, oval) => {
    if (!oval) { part(sfx, "box", { ...at }, { size: { x: w, y: hh, z: d } }, mat); return; }
    const cx = (w - hh) / 2;
    part(sfx, "box", { ...at }, { size: { x: Math.max(0.001, w - hh), y: hh, z: d } }, mat);
    part(sfx + "l", "cylinder", { x: at.x - cx, y: at.y, z: at.z }, { radius: hh / 2, height: d }, mat, ROUND);
    part(sfx + "r", "cylinder", { x: at.x + cx, y: at.y, z: at.z }, { radius: hh / 2, height: d }, mat, ROUND);
  };
  const O = { x: 0, y: 0, z: 0 };
  const oval = op.type === "persistent";
  // background decks: one ghosted silhouette per op, nothing else
  if (!active) {
    slab("face", W, H, D, O, lit(pal.ghost, { opacity: 0.35 }), oval);
    return h;
  }
  const undef = op.type === "undefined";
  slab("ink", W, H, D - 0.04, O, lit(undef ? pal.faint : pal.rim), oval);
  slab("face", fw, fh, D, O, lit(undef ? pal.undefFace : pal.face), oval);
  if (typeof plateZ === "number") {
    // the offset shadow on the case-window plate — a child of the op, so it
    // rides a drag; the offset grows with the op's standoff from the plate
    const o = GEO.shadow * Math.max(0, z0 - plateZ);
    slab("shadow", W, H, 0.004, { x: o, y: -o, z: plateZ - z0 + 0.012 }, lit(pal.shadow, { opacity: 0.75 }), oval);
  }
  let labelY = 0;
  const inlay = (sfx, x, y, sx, sy) => {        // a mark set on the face, front AND back
    part(sfx, "box", { x, y, z: zf }, { size: { x: sx, y: sy, z: GEO.inlay } }, lit(pal.ink));
    part(sfx + "_b", "box", { x, y, z: -zf }, { size: { x: sx, y: sy, z: GEO.inlay } }, lit(pal.ink));
  };
  switch (op.type) {
    case "primitive": {            // ‖ name ‖ — a post set in from each end
      const px = fw / 2 - 0.075;
      inlay("postl", -px, 0, 0.03, fh);
      inlay("postr", px, 0, 0.03, fh);
      break;
    }
    case "constant":               // nothing comes in: a solid LID (proud of the shell, no z-fight)
      part("lid", "box", { x: 0, y: h - 0.052, z: 0 }, { size: { x: W + 0.004, y: 0.116, z: D + 0.004 } }, lit(pal.ink));
      labelY = -0.04;
      break;
    case "match":                  // nothing goes out: a solid SILL
      part("sill", "box", { x: 0, y: -h + 0.052, z: 0 }, { size: { x: W + 0.004, y: 0.116, z: D + 0.004 } }, lit(pal.ink));
      labelY = 0.04;
      break;
    case "local": {                // a case lives inside: a DOUBLE outline
      const ix = fw / 2 - 0.05, iy = fh / 2 - 0.05, t = 0.022;
      inlay("frt", 0, iy, 2 * ix + t, t);
      inlay("frb", 0, -iy, 2 * ix + t, t);
      inlay("frl", -ix, 0, t, 2 * iy);
      inlay("frr", ix, 0, t, 2 * iy);
      break;
    }
  }
  // the name INSIDE the icon (Prograph) — centred on the face; the editor's
  // css styles labels by meta.role/opType/lit
  push({ id: `${id}/tag`, parent: id, kind: "text",
    pos: { x: 0, y: labelY, z: D / 2 + 0.02 },
    text: { text: opLabel(op), size: 0.85 },
    meta: { role: "label", opIndex: i, opType: op.type, lit: op.type === "constant" || op.type === "match" } });
  if (op.condition && op.condition.rule) {
    const s = GEO.ctlS, tx = W / 2 + 0.05 + s / 2;
    part("ctl", "box", { x: tx, y: 0, z: 0 }, { size: { x: s, y: s, z: D - 0.04 } }, lit(pal.rim));
    // the tab's face is unlit so the rule colour reads true at any angle
    part("ctlface", "box", { x: tx, y: 0, z: 0 }, { size: { x: s - 2 * r, y: s - 2 * r, z: D } },
      { color: pal[op.condition.rule] || pal.terminate, emissive: true });
    push({ id: `${id}/flag`, parent: id, kind: "text",
      pos: { x: tx, y: 0, z: D / 2 + 0.02 },
      text: { text: op.condition.value ? "✓" : "✗", size: 0.85 },
      meta: { role: "flag", opIndex: i, rule: op.condition.rule, value: op.condition.value } });
  }
  return h;
}

/** One socket — Prograph's terminal (top edge) or root (bottom edge): a small
    bead — plus its multiplex annotation, drawn OUTSIDE the edge: a list
    terminal's "…" (three dots), a loop terminal's arrowhead. */
function pushSocket(push, id, parent, pos, node, editable, meta, pal) {
  pal = pal || scenePalette();
  push({ id, parent, kind: "sphere", pos, params: { radius: GEO.socketR },
    material: { color: pal.ink },
    affordances: editable ? { tap: true, hover: true, drag: { plane: "xy", altPlane: "xy" } }
                          : { tap: true, hover: true },
    meta });
  const mode = node && node.mode;
  const away = meta.which === "in" ? 1 : -1;    // terminals: above the edge; roots: below
  if (mode === "list") {
    for (const k of [-1, 0, 1]) push({ id: `${id}/mux${k + 1}`, parent, kind: "sphere",
      pos: { x: pos.x + k * 0.05, y: pos.y + away * 0.12, z: pos.z }, params: { radius: 0.018 },
      material: { color: pal.ink }, meta: { role: "mux", mode } });
  } else if (mode === "loop") {
    push({ id: `${id}/mux`, parent, kind: "cone",
      pos: { x: pos.x + 0.12, y: pos.y, z: pos.z }, rot: { x: 0, y: 0, z: away > 0 ? Math.PI : 0 },
      params: { radius: 0.04, height: 0.09 },
      material: { color: pal.ink, flat: true }, meta: { role: "mux", mode } });
  }
}

/**
 * Project a case chain into the SCENE SCHEMA (scenestage vocabulary): the
 * state-shaped flow view. Same signature family as project().
 * @returns {{specs: object[], bounds: object, deckCount: number}}
 */
function toScene(rootCase, opts = {}) {
  const activeDeck = opts.activeDeck ?? 0;
  const editable = opts.editable ?? true;
  const pal = scenePalette(opts.tokens);
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
      material: { color: pal.plateRim },
      meta: { role: "deck", index: idx } });

    // the CASE WINDOW: a plate behind the deck (sized to the bars, which span
    // every op) that the ops stand off and shadow onto. plateZ is its FRONT
    // face, deck-local, behind the rearmost op whatever untangle did to z.
    let backZ = 0;
    for (const op of c.cmds) backZ = Math.min(backZ, (op.pos && op.pos.z) || 0);
    const plateZ = backZ - GEO.opD / 2 - GEO.plateGap;
    const pw = bars.len + 2 * GEO.plateMargin;
    const ph = bars.inY - bars.outY + GEO.barH + 2 * GEO.plateMargin;
    const pid = `${prefix}/plate`;
    push({ id: pid, parent: deckId, kind: "box",
      pos: { x: bars.x, y: (bars.inY + bars.outY) / 2, z: plateZ - GEO.plateT / 2 },
      params: { size: { x: pw, y: ph, z: GEO.plateT } },
      material: { color: pal.plateRim, flat: true, ...(active ? {} : { opacity: 0.3 }) },
      meta: { role: "plate" } });
    if (active) push({ id: `${pid}/face`, parent: pid, kind: "box",
      pos: { x: 0, y: 0, z: 0.004 },
      params: { size: { x: pw - 0.08, y: ph - 0.08, z: GEO.plateT } },
      material: { color: pal.plate, flat: true },
      meta: { role: "plate-face" } });

    // bars (the signature) — Prograph's input/output bars: strips spanning
    // the case, built like the icons, their sockets on the inner edge
    const rail = (which, y) => {
      const bid = `${prefix}/bar-${which}`;
      push({ id: bid, parent: deckId, kind: "box",
        pos: { x: bars.x, y, z: 0 },
        params: { size: { x: bars.len, y: GEO.barH, z: GEO.opD - 0.04 } },
        material: { color: pal.rim, flat: true, ...(active ? {} : { opacity: 0.35 }) },
        affordances: active ? { tap: true } : undefined,
        meta: { role: "bar", which: which === "in" ? "input" : "output" } });
      if (!active) return;
      push({ id: `${bid}/face`, parent: bid, kind: "box",
        pos: { x: 0, y: 0, z: 0 },
        params: { size: { x: bars.len - 2 * GEO.rim, y: GEO.barH - 2 * GEO.rim, z: GEO.opD } },
        material: { color: pal.face, flat: true },
        meta: { role: "bar-face", which: which === "in" ? "input" : "output" } });
      const o = GEO.shadow * -plateZ;
      push({ id: `${bid}/shadow`, parent: bid, kind: "box",
        pos: { x: o, y: -o, z: plateZ + 0.012 },
        params: { size: { x: bars.len, y: GEO.barH, z: 0.004 } },
        material: { color: pal.shadow, flat: true, opacity: 0.75 },
        meta: { role: "shadow" } });
    };
    rail("in", bars.inY);
    rail("out", bars.outY);

    c.cmds.forEach((op, i) => {
      const h = opSceneNode(op, i, deckId, prefix, active, editable, push, pal, plateZ);
      if (!active) return;
      const opId = `${prefix}/op/${i}`;
      for (const [term, n] of Object.entries(op.in))
        pushSocket(push, `${opId}/in/${term}`, opId, { x: n.x || 0, y: h, z: GEO.sockZ }, n, editable,
          { role: "terminal", idx: i, which: "in", term }, pal);
      for (const [term, n] of Object.entries(op.out))
        pushSocket(push, `${opId}/out/${term}`, opId, { x: n.x || 0, y: -h, z: GEO.sockZ }, n, editable,
          { role: "terminal", idx: i, which: "out", term }, pal);
    });

    if (active) {
      for (const [term, n] of Object.entries(c.input))
        pushSocket(push, `${prefix}/bt-in/${term}`, deckId, { x: n.x || 0, y: bars.inSockY, z: GEO.sockZ }, n, editable,
          { role: "terminal", idx: -1, which: "out", term }, pal);
      for (const [term, n] of Object.entries(c.output))
        pushSocket(push, `${prefix}/bt-out/${term}`, deckId, { x: n.x || 0, y: bars.outSockY, z: GEO.sockZ }, n, editable,
          { role: "terminal", idx: -2, which: "in", term }, pal);

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
          material: { color: pal.wire },
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

// ── toSceneDoc: flowdoc Case → a scene FACET (P0 of the scene-stack conversion)
//
// The DERIVED view (decision 4: the flow body stays authoritative; this facet
// is regenerated on load, never the source of truth). Pure, like project():
// a Case in, a scenedoc-compatible scene facet out — no THREE, no DOM. It
// reuses the SAME geometry constants and terminal math as toScene, so the
// front-ortho parity (acceptance 2) holds by construction: op bodies at
// (pos.x, pos.y, pos.z), terminals at (pos.x + node.x, pos.y ± halfH, pos.z),
// decks receding −Z at GEO.deckPitch.
//
// Output shape is a scene facet (app:scenedoc Part II): {env, nodes, state}.
// Nodes are scenedoc-vocabulary entries — group decks, per-type op bodies
// (box / rotated-cylinder constant / glass local / cylinder persistent),
// command spines, text tags, sphere sockets, and hang LINKS between socket
// ids (the scene stack re-resolves endpoints each frame, so wires follow
// drags free).
//
// IMPLEMENTATION — parity by construction: toSceneDoc DELEGATES to toScene
// (the R-4 spec path) and converts its flat spec list into scenedoc nodes.
// toScene's spec shapes are already scenedoc-native (box size.x/y/z, cylinder
// radius/height, cone radius/height, sphere radius, text text/size, link
// from/to), so the op bodies, terminals, bars, and wires land at IDENTICAL
// world positions on both paths — the front-ortho parity check (acceptance 2)
// compares these two projections and they agree to the last decimal because
// they ARE the same geometry. ids mirror toScene's (`d0/op/3/in/term`), so
// behavior code maps a scene node back to (deck, idx, which, term) exactly as
// the legacy editor does — that mapping IS the P2 gesture bridge.
//
// `editable` switches socket/op drag affordances on, `activeDeck` picks the
// deck that carries bars, terminals, wires, tags, and miniatures (the rest
// ghost) — the same semantics toScene gives the legacy editor.
function toSceneDoc(flow, { editable = false, activeDeck = 0, tokens = null } = {}) {
  const c = flow && flow.root ? flow.root : flow;   // accept a FlowDoc or a Case
  const { specs, deckCount } = toScene(c, { activeDeck, editable, tokens });

  // scenedoc node ids must satisfy NAME_RE (^[a-z][a-z0-9_]*$) — no slashes.
  // Slug toScene's hierarchical spec id (`d0/op/3/in/term`) into a flat,
  // collision-free scenedoc id (`d0_op_3_in_term`), remapping id, parent, and
  // link from/to through the SAME transform so the graph stays connected. The
  // original spec id rides along as meta.sid — behavior code maps a scene node
  // back to (deck, idx, which, term) exactly as the legacy editor does (the
  // P2 gesture bridge reads meta, and meta.sid is its stable handle).
  const NAME_RE = /^[a-z][a-z0-9_]*$/;
  const slug = (sid) => {
    let s = String(sid).replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    if (!/^[a-z]/.test(s)) s = "n_" + s;
    return NAME_RE.test(s) ? s : s.replace(/[^a-z0-9_]/g, "_");
  };

  // spec → scenedoc node. Verbatim copy of the scenedoc-native fields; the
  // only structural transform is the deck placeholder, which becomes a
  // scenedoc GROUP (a pure transform holder — its tiny box gizmo was a
  // stage-only shim). Ids/parents/endpoints are slugged per above.
  const nodes = specs.map((s) => {
    const meta = s.meta ? { ...s.meta, sid: s.id } : { sid: s.id };
    if (s.meta && s.meta.role === "deck") {
      return { id: slug(s.id), kind: "group", pos: s.pos, meta };
    }
    const n = { id: slug(s.id), kind: s.kind };
    if (s.parent !== undefined) n.parent = slug(s.parent);
    if (s.pos) n.pos = s.pos;
    if (s.rot) n.rot = s.rot;
    if (s.scale) n.scale = s.scale;
    if (s.params) n.params = s.params;
    if (s.text) n.text = s.text;
    if (s.kind === "link") { n.from = slug(s.from); n.to = slug(s.to);
      if (s.curve !== undefined) n.curve = s.curve;
      if (s.r !== undefined) n.r = s.r; }
    if (s.material) n.material = s.material;
    if (s.affordances) n.affordances = s.affordances;
    n.meta = meta;
    return n;
  });

  // derived scene facet. state (a scenedoc FIELD ARRAY) carries the chain
  // geometry a host/camera needs.
  return {
    env: { camera: { pos: { x: 0, y: 0, z: 12 }, target: { x: 0, y: 0, z: 0 } },
      grid: true, lights: "default" },
    nodes,
    state: [
      { name: "deck_count", type: "number", value: deckCount },
      { name: "active_deck", type: "number", value: activeDeck },
    ],
  };
}

    Object.assign(me, { GEO, halfH, opBox, opLabel, scenePalette, SCENE_TOKENS, project, frontOrtho, terminalWorld, wireCurvePoint, toScene, toSceneDoc });
  })();
