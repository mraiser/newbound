// flowlayout.js — auto-layout PROPOSALS for a flowlang case (flow3d-design
// §7.1). Pure: a normalized Case in, an array of proposed op positions out —
// no DOM, no THREE, no mutation. The editor previews a proposal as ghosts and
// applies it as ONE journaled mutation ("auto-layout …"); layout never runs
// implicitly (legacy planar graphs stay planar until asked).
//
// - tidy:      longest-path layering assigns y (pitch 1.6); barycenter sweeps
//              order x within layers (Sugiyama family); z is left untouched.
// - untangle:  same layering for y; independent subgraphs fan out in z
//              (soft-guided to ±1.5 — §2.2), THEN a per-layer force
//              relaxation in the xz plane resolves the crossings that remain
//              inside a component (§7.1). y is hard-pinned by layering in
//              both: *down = later* is never optimized away.
//
// The relaxation is a cooled, deterministic Fruchterman–Reingold-shaped
// sweep (no randomness — resume safety and testability) with three terms:
//
//   · wire-length attraction — every op is pulled toward the ops it wires
//     to, in x and z. Shorter wires, tighter reading.
//   · crossing repulsion in z — for each pair of wires that cross in the
//     xy projection while sharing a z band, the two wires' endpoints are
//     pushed apart in z. This is the design's thesis made mechanical: the
//     third dimension IS the crossing-resolution mechanism (§7.4 rejects
//     route-avoiding wires precisely because of this).
//   · non-overlap projection — after each cooled step, same-layer op boxes
//     that interpenetrate are separated along the axis of least penetration
//     (x by width + gap, or z by depth + gap). Hard constraint, not a force,
//     so "op bodies never overlap" is an invariant of the proposal rather
//     than a tuning outcome — the same position-based idiom as the peer
//     constellation's separation projection in assets/forcelayout.js.
//
// A case with no crossings relaxes to a no-op in z: legacy planar graphs
// that are already untangled stay exactly where component separation put
// them (verified in tools/flow3d-check.mjs).

const Y_PITCH = 1.6;
const X_GAP = 0.6;
const Z_SPAN = 1.5;
const Z_GAP = 0.9;  // min z separation for boxes overlapping in x (boxD 0.6 + air)

const RELAX = {
  iters: 60,      // cooled sweeps (see untangle: fewer on very large cases)
  attract: 0.15,  // wire-length pull per hop
  cross: 0.9,     // z push per crossing pair
  t0: 0.5,        // initial max displacement per op per sweep (cools to 0)
};

/** Op-graph edges from cons (bars excluded). Returns {out, into} adjacency. */
function opEdges(c) {
  const N = c.cmds.length;
  const out = Array.from({ length: N }, () => []);
  const into = Array.from({ length: N }, () => []);
  for (const w of c.cons) {
    const s = w.src[0], d = w.dest[0];
    if (s >= 0 && d >= 0 && s < N && d < N) { out[s].push(d); into[d].push(s); }
  }
  return { out, into };
}

/** Longest-path layering from the input bar: ops fed by no other op sit in
    layer 0; every wire descends at least one layer. Cycle-tolerant (I-2
    violations park the leftovers below — the editor must open broken flows). */
export function layerAssign(c) {
  const N = c.cmds.length;
  const { out, into } = opEdges(c);
  const indeg = into.map((a) => a.length);
  const depth = new Array(N).fill(0);
  const q = [];
  for (let i = 0; i < N; i++) if (!indeg[i]) q.push(i);
  const seen = [];
  while (q.length) {
    const u = q.shift();
    seen.push(u);
    for (const v of out[u]) {
      depth[v] = Math.max(depth[v], depth[u] + 1);
      if (--indeg[v] === 0) q.push(v);
    }
  }
  if (seen.length < N) {
    const maxD = Math.max(0, ...seen.map((i) => depth[i]));
    for (let i = 0; i < N; i++) if (!seen.includes(i)) depth[i] = maxD + 1;
  }
  return depth;
}

/** Barycenter crossing-minimization over the given layers. `layers` is an
    array of op-index arrays (mutated in place into the final order). */
function barycenterSweeps(c, layers, into, out, sweeps = 4) {
  const orderIndex = new Map(); // op -> position within its layer
  const reindex = () => layers.forEach((L) => L.forEach((op, k) => orderIndex.set(op, k)));
  reindex();
  const bary = (op, neighbors) => {
    const ns = neighbors[op].filter((n) => orderIndex.has(n));
    if (!ns.length) return orderIndex.get(op);
    return ns.reduce((s, n) => s + orderIndex.get(n), 0) / ns.length;
  };
  for (let s = 0; s < sweeps; s++) {
    const downward = s % 2 === 0;
    const seq = downward ? layers : [...layers].reverse();
    for (const L of seq) {
      const scores = new Map(L.map((op) => [op, bary(op, downward ? into : out)]));
      L.sort((a, b) => scores.get(a) - scores.get(b) || a - b);
      reindex();
    }
  }
}

/** Pack a layer's ops along x around a center: widths + X_GAP, centered. */
function packX(c, layer, centerX = 0) {
  const widths = layer.map((i) => c.cmds[i].width || 1.5);
  const total = widths.reduce((s, w) => s + w, 0) + X_GAP * Math.max(0, layer.length - 1);
  let cursor = centerX - total / 2;
  const xs = new Map();
  layer.forEach((i, k) => {
    xs.set(i, cursor + widths[k] / 2);
    cursor += widths[k] + X_GAP;
  });
  return xs;
}

function layersOf(c, depth) {
  const maxD = Math.max(0, ...depth);
  const layers = Array.from({ length: maxD + 1 }, () => []);
  depth.forEach((d, i) => layers[d].push(i));
  // deterministic initial order: current x
  for (const L of layers) L.sort((a, b) => (c.cmds[a].pos.x - c.cmds[b].pos.x) || (a - b));
  return layers;
}

const yOf = (depth, maxD) => (maxD / 2 - depth) * Y_PITCH;

/** The "tidy" proposal: layered y, barycenter-ordered x, z untouched. */
export function tidy(c) {
  const N = c.cmds.length;
  if (!N) return { label: "auto-layout: tidy", positions: [] };
  const depth = layerAssign(c);
  const { out, into } = opEdges(c);
  const layers = layersOf(c, depth);
  barycenterSweeps(c, layers, into, out);
  const maxD = Math.max(...depth);
  const positions = new Array(N);
  for (const L of layers) {
    const xs = packX(c, L);
    for (const i of L) positions[i] = { x: xs.get(i), y: yOf(depth[i], maxD), z: c.cmds[i].pos.z };
  }
  return { label: "auto-layout: tidy", positions };
}

/** Connected components over the undirected op graph. */
export function components(c) {
  const N = c.cmds.length;
  const { out, into } = opEdges(c);
  const comp = new Array(N).fill(-1);
  let k = 0;
  for (let i = 0; i < N; i++) {
    if (comp[i] !== -1) continue;
    const stack = [i];
    while (stack.length) {
      const u = stack.pop();
      if (comp[u] !== -1) continue;
      comp[u] = k;
      for (const v of out[u]) stack.push(v);
      for (const v of into[u]) stack.push(v);
    }
    k++;
  }
  return { comp, count: k };
}

// ── the relaxation (§7.1's second half) ────────────────────────────────────

/** Op-to-op wires as {s, d, k} (k = a stable index for deterministic ties),
    skipping bar wires and self-loops. */
function opWires(c) {
  const N = c.cmds.length;
  const ws = [];
  c.cons.forEach((w, k) => {
    const s = w.src[0], d = w.dest[0];
    if (s >= 0 && d >= 0 && s < N && d < N && s !== d) ws.push({ s, d, k });
  });
  return ws;
}

/** A wire's x (or z) where it crosses the horizontal plane at layer `level`,
    by linear interpolation between its endpoints' depths. The wire renders as
    a curve; crossings read from the chord, which is what the eye follows. */
function atLevel(w, level, depth, pos, axis) {
  const ds = depth[w.s], dd = depth[w.d];
  if (ds === dd) return pos[w.s][axis];
  const t = (level - ds) / (dd - ds);
  return pos[w.s][axis] + (pos[w.d][axis] - pos[w.s][axis]) * t;
}

/** Wires bucketed by the band they pass through: band `d` is the slab between
    layer d and layer d+1. A wire spanning several layers appears in each band
    it traverses, so long wires are tested against everything they pass. */
function bandIndex(c, depth) {
  const bands = new Map();
  for (const w of opWires(c)) {
    const lo = Math.min(depth[w.s], depth[w.d]);
    const hi = Math.max(depth[w.s], depth[w.d]);
    for (let d = lo; d < hi; d++) {
      if (!bands.has(d)) bands.set(d, []);
      bands.get(d).push(w);
    }
  }
  return bands;
}

/** Crossings that are still VISUALLY crossings: the two wires swap x order
    across a band (they cross in the front projection) AND sit within `zGap`
    of each other there (z hasn't resolved them). This is the objective the
    relaxation minimizes — exported so callers and tests can measure it. */
export function countCrossings(c, depth, positions, zGap = Z_GAP) {
  const bands = bandIndex(c, depth);
  let n = 0;
  for (const [d, ws] of bands) {
    for (let i = 0; i < ws.length; i++) {
      for (let j = i + 1; j < ws.length; j++) {
        const A = ws[i], B = ws[j];
        if (A.s === B.s || A.s === B.d || A.d === B.s || A.d === B.d) continue;
        const top = atLevel(A, d, depth, positions, "x") - atLevel(B, d, depth, positions, "x");
        const bot = atLevel(A, d + 1, depth, positions, "x") - atLevel(B, d + 1, depth, positions, "x");
        if (top * bot >= 0) continue;             // no swap: no crossing
        const zA = atLevel(A, d + 0.5, depth, positions, "z");
        const zB = atLevel(B, d + 0.5, depth, positions, "z");
        if (Math.abs(zA - zB) >= zGap) continue;  // resolved in depth
        n++;
      }
    }
  }
  return n;
}

/** Hard non-overlap for same-layer op boxes: separate along the axis of least
    penetration (x by half-widths + X_GAP, z by Z_GAP). Mutates `pos`.

    Gauss–Seidel: resolving one pair can re-break another (three boxes in a
    layer are a three-body contact), so the sweep repeats — the same reason
    forcelayout substeps its projection. A z push that the ±zSpan clamp can't
    deliver falls back to x, or the pair would stall overlapping forever. */
function separateLayers(c, depth, pos, zSpan, zGap, passes = 16, eps = 1e-7) {
  const byLayer = new Map();
  depth.forEach((d, i) => { if (!byLayer.has(d)) byLayer.set(d, []); byLayer.get(d).push(i); });
  for (let p = 0; p < passes; p++) {
    let moved = false;
    for (const L of byLayer.values()) {
      for (let a = 0; a < L.length; a++) {
        for (let b = a + 1; b < L.length; b++) {
          const i = L[a], j = L[b];
          const needX = ((c.cmds[i].width || 1.5) + (c.cmds[j].width || 1.5)) / 2 + X_GAP;
          const dx = pos[j].x - pos[i].x, dz = pos[j].z - pos[i].z;
          const penX = needX - Math.abs(dx), penZ = zGap - Math.abs(dz);
          if (penX <= eps || penZ <= eps) continue;       // already clear on an axis
          const zSign = dz === 0 ? (i < j ? -1 : 1) : Math.sign(dz);
          // room the clamp actually leaves for the z correction
          const room = (zSign > 0 ? zSpan - pos[j].z : pos[j].z + zSpan)
                     + (zSign > 0 ? pos[i].z + zSpan : zSpan - pos[i].z);
          if (penZ <= penX && room >= penZ - 1e-12) {
            const s = zSign * penZ / 2;
            pos[i].z = Math.max(-zSpan, Math.min(zSpan, pos[i].z - s));
            pos[j].z = Math.max(-zSpan, Math.min(zSpan, pos[j].z + s));
          } else {
            const s = (dx === 0 ? (i < j ? -1 : 1) : Math.sign(dx)) * penX / 2;
            pos[i].x -= s; pos[j].x += s;
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

/** Per-layer force relaxation in the xz plane (§7.1). Pure: takes proposed
    positions, returns NEW ones with y copied through untouched. */
export function relax(c, depth, positions, opts = {}) {
  const o = { ...RELAX, zSpan: Z_SPAN, zGap: Z_GAP, ...opts };
  const N = c.cmds.length;
  const pos = positions.map((p) => ({ ...p }));
  if (N < 2 || o.iters < 1) return pos;
  const wires = opWires(c);
  const bands = bandIndex(c, depth);
  const fx = new Float64Array(N), fz = new Float64Array(N);

  for (let it = 0; it < o.iters; it++) {
    const temp = o.t0 * (1 - it / o.iters);   // cooling: big moves early
    fx.fill(0); fz.fill(0);

    // wire-length attraction (xz; y is the layering and never moves)
    for (const w of wires) {
      const dx = pos[w.d].x - pos[w.s].x, dz = pos[w.d].z - pos[w.s].z;
      fx[w.s] += dx * o.attract; fz[w.s] += dz * o.attract;
      fx[w.d] -= dx * o.attract; fz[w.d] -= dz * o.attract;
    }

    // crossing repulsion: push crossing wire pairs apart in DEPTH
    for (const [d, ws] of bands) {
      for (let i = 0; i < ws.length; i++) {
        for (let j = i + 1; j < ws.length; j++) {
          const A = ws[i], B = ws[j];
          if (A.s === B.s || A.s === B.d || A.d === B.s || A.d === B.d) continue;
          const top = atLevel(A, d, depth, pos, "x") - atLevel(B, d, depth, pos, "x");
          const bot = atLevel(A, d + 1, depth, pos, "x") - atLevel(B, d + 1, depth, pos, "x");
          if (top * bot >= 0) continue;
          const zA = atLevel(A, d + 0.5, depth, pos, "z");
          const zB = atLevel(B, d + 0.5, depth, pos, "z");
          const gap = zA - zB;
          if (Math.abs(gap) >= o.zGap) continue;
          // deterministic sign: current order, else the stable wire index
          const sign = Math.abs(gap) > 1e-9 ? Math.sign(gap) : (A.k < B.k ? 1 : -1);
          const push = o.cross * (o.zGap - Math.abs(gap)) / o.zGap;
          fz[A.s] += sign * push; fz[A.d] += sign * push;
          fz[B.s] -= sign * push; fz[B.d] -= sign * push;
        }
      }
    }

    // cooled step: displacement magnitude capped by the temperature
    for (let i = 0; i < N; i++) {
      const m = Math.hypot(fx[i], fz[i]);
      if (m < 1e-12) continue;
      const s = Math.min(m, temp) / m;
      pos[i].x += fx[i] * s;
      pos[i].z = Math.max(-o.zSpan, Math.min(o.zSpan, pos[i].z + fz[i] * s));
    }

    separateLayers(c, depth, pos, o.zSpan, o.zGap);
  }
  return pos;
}

/** The "untangle" proposal: tidy's layering for y; independent subgraphs fan
    out in z within ±Z_SPAN; x packed per component (centered at 0 — depth
    separates them); then the per-layer xz relaxation resolves what remains
    INSIDE each component (§7.1). */
export function untangle(c) {
  const N = c.cmds.length;
  if (!N) return { label: "auto-layout: untangle", positions: [] };
  const depth = layerAssign(c);
  const { out, into } = opEdges(c);
  const { comp, count } = components(c);
  const maxD = Math.max(...depth);
  const positions = new Array(N);
  for (let k = 0; k < count; k++) {
    const members = [];
    for (let i = 0; i < N; i++) if (comp[i] === k) members.push(i);
    const z = count > 1 ? -Z_SPAN + (2 * Z_SPAN * k) / (count - 1) : 0;
    // per-component layering order (reuse global depths; local barycenter)
    const layers = layersOf(c, depth).map((L) => L.filter((i) => comp[i] === k)).filter((L) => L.length);
    barycenterSweeps(c, layers, into, out);
    for (const L of layers) {
      const xs = packX(c, L);
      for (const i of L) positions[i] = { x: xs.get(i), y: yOf(depth[i], maxD), z };
    }
    void members;
  }
  // …then relax: component separation handles ACROSS components, the sweep
  // handles WITHIN one. Big cases cool faster (the pair work is per band).
  const relaxed = relax(c, depth, positions, { iters: N > 200 ? 24 : RELAX.iters });
  return { label: "auto-layout: untangle", positions: relaxed };
}
