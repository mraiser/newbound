// forcelayout.js — a pure force-directed layout for constellations of peers
// (scene-facet-design Part X; the flowlayout precedent: layout lives OUTSIDE
// the facet — a host steps this at ~10Hz, writes positions into the scene's
// each-field, and matched linear eases chain the waypoints into continuous
// motion). No DOM, no THREE.
//
// The model loosely mimics the physics that binds atoms in a molecule
// (the owner's framing): 1/d² repulsion grows as peers approach, so
// connected peers are drawn together but keep a minimum distance. Two
// stability guarantees make that hold at ANY host cadence:
//
//   · SUBSTEPPING — each step() integrates N small sub-steps internally,
//     so the stiff short-range repulsion is sampled while the barrier is
//     being climbed (one big step tunnels through it, then explodes).
//   · SEPARATION PROJECTION (position-based dynamics) — after integrating
//     forces, any pair closer than dMin is pushed apart to exactly dMin
//     and the closing velocity component is cancelled. Forces make the
//     spacing organic; the projection makes "orbs never merge" an
//     invariant by construction, not a parameter-tuning outcome.
//
// The sim runs in the XZ plane (y stays whatever the item carries).
// Units: world units and seconds; forces are accelerations (unit mass).

const DEFAULTS = {
  repel: 4.0,        // pairwise repulsion strength (repel/d²)
  spring: 1.2,       // connection spring strength (toward restLength)
  restLength: 2.4,   // connection rest length
  anchor: 0.35,      // pull toward origin for anchored items
  anchorFree: 0.06,  // weak pull for everything else — free items reach a
                     // force-balance orbit instead of drifting forever
                     // (perpetual terminal-velocity drift defeats settle)
  damping: 3.0,      // per-second exponential velocity damping
  maxSpeed: 2.0,     // world units per second
  bounds: 8,         // positions clamped to ±bounds
  dMin: 1.2,         // hard minimum separation (the projection invariant)
  substeps: 8,       // sub-integrations per step() call
};

/** One sim step, PURE: returns a NEW array of items with updated x/z (and
    vx/vz velocities carried between steps). `items` are {id, x?, z?, vx?,
    vz?, anchored?}; `connections` are {a, b} of item ids. `dt` = the wall
    time this step covers, in seconds (the host's push interval). Unplaced
    items get deterministic ring seeds (no randomness — resume safety and
    testability). */
export function step(items, connections, dt = 0.1, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const n = items.length;
  const out = items.map((it, i) => {
    const seeded = typeof it.x === "number" && typeof it.z === "number";
    const angle = (2 * Math.PI * i) / Math.max(1, n);
    return {
      ...it,
      x: seeded ? it.x : Math.cos(angle) * 3,
      z: seeded ? it.z : Math.sin(angle) * 3,
      vx: typeof it.vx === "number" ? it.vx : 0,
      vz: typeof it.vz === "number" ? it.vz : 0,
    };
  });
  const byId = new Map(out.map((it) => [it.id, it]));
  const h = dt / o.substeps;
  const damp = Math.exp(-o.damping * h);

  for (let s = 0; s < o.substeps; s++) {
    // forces
    for (const a of out) { a._fx = 0; a._fz = 0; }
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        const dx = a.x - b.x, dz = a.z - b.z;
        const d2 = Math.max(0.04, dx * dx + dz * dz);
        const d = Math.sqrt(d2);
        const f = o.repel / d2;
        a._fx += (dx / d) * f; a._fz += (dz / d) * f;
        b._fx -= (dx / d) * f; b._fz -= (dz / d) * f;
      }
    }
    for (const a of out) {
      const g = a.anchored ? o.anchor : o.anchorFree;
      a._fx -= a.x * g; a._fz -= a.z * g;
    }
    for (const c of connections) {
      const a = byId.get(c.a), b = byId.get(c.b);
      if (!a || !b || a === b) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.max(0.2, Math.hypot(dx, dz));
      const f = o.spring * (d - o.restLength);
      a._fx += (dx / d) * f; a._fz += (dz / d) * f;
      b._fx -= (dx / d) * f; b._fz -= (dz / d) * f;
    }
    // integrate; at the bounds, kill the outward velocity component (or a
    // wall-pinned item accumulates speed forever and never settles)
    for (const a of out) {
      a.vx = (a.vx + a._fx * h) * damp;
      a.vz = (a.vz + a._fz * h) * damp;
      const sp = Math.hypot(a.vx, a.vz);
      if (sp > o.maxSpeed) { a.vx *= o.maxSpeed / sp; a.vz *= o.maxSpeed / sp; }
      let nx = a.x + a.vx * h, nz = a.z + a.vz * h;
      if (nx > o.bounds) { nx = o.bounds; if (a.vx > 0) a.vx = 0; }
      else if (nx < -o.bounds) { nx = -o.bounds; if (a.vx < 0) a.vx = 0; }
      if (nz > o.bounds) { nz = o.bounds; if (a.vz > 0) a.vz = 0; }
      else if (nz < -o.bounds) { nz = -o.bounds; if (a.vz < 0) a.vz = 0; }
      a.x = nx; a.z = nz;
    }
    // separation projection: enforce dMin, cancel closing velocity
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        let dx = b.x - a.x, dz = b.z - a.z;
        let d = Math.hypot(dx, dz);
        if (d >= o.dMin) continue;
        if (d < 1e-9) { dx = 1; dz = 0; d = 1e-9; } // coincident: deterministic axis
        const nx = dx / d, nz = dz / d;
        const push = (o.dMin - d) / 2;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
        const closing = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (closing < 0) {
          a.vx += nx * closing / 2; a.vz += nz * closing / 2;
          b.vx -= nx * closing / 2; b.vz -= nz * closing / 2;
        }
      }
    }
  }
  for (const a of out) { delete a._fx; delete a._fz; }
  return out;
}

/** Total kinetic energy — the settle detector (stop stepping under epsilon
    and let the constellation truly rest; wake on membership changes). */
export function energy(items) {
  let e = 0;
  for (const it of items) e += (it.vx ?? 0) ** 2 + (it.vz ?? 0) ** 2;
  return e;
}
