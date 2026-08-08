// pools.js — the shared nb_three batching core (3D-P4).
//
// The two stages (stage.js for flows, scenestage.js for scene facets) both
// need to draw MANY small identical things without paying a draw call each.
// That machinery was built once inside stage.js and lived only there; this
// module is it, extracted, so both stages batch the same way and a fix or a
// measurement lands once. It is the first step of the bottom-up convergence
// recorded in docs/great-refactoring.md — the two stages keep their own
// vocabularies and projections, and share the parts that are genuinely the
// same underneath.
//
// THREE is imported here, which is allowed and unchanged in spirit: this file
// lives in vendor/nb_three/ with the stages, and no THREE type crosses out of
// it — callers pass plain {x,y,z} and hex numbers, and get back ids.
//
// Both pools share one shape:
//   · slots are dense; removal is SWAP-WITH-LAST so the draw range stays
//     contiguous and no compaction pass is ever needed,
//   · `id -> slot` is a Map, `slot -> id` an array, so picking resolves a hit
//     back to a caller id in O(1),
//   · capacity doubles on demand and the old buffer's contents are copied.

import * as THREE from "./three.module.js";

const V = (p) => (p && typeof p === "object" ? p : { x: 0, y: 0, z: 0 });
const asScale = (s) =>
  typeof s === "number" ? { x: s, y: s, z: s } : { x: s.x ?? 1, y: s.y ?? 1, z: s.z ?? 1 };

/** An InstancedMesh pool: one geometry + one material, per-instance matrix
    and per-instance colour. Pick with `idAt(hit.instanceId)`.

    Two transform modes per slot, freely mixed (R-4, the scenestage
    convergence): PRS — position + non-uniform scale + optional euler
    rotation, composed here (the flow stage's axis-aligned world never sets
    a rotation and pays nothing for the option) — or a FULL world MATRIX via
    setMatrix, for nodes living in a parent hierarchy whose world transform
    the caller computes. A hidden slot is a zero write either way, so slots
    stay dense. */
// THREE caches a mesh's bounding volumes and recomputes them ONLY when they
// are null. InstancedMesh.raycast and the frustum culler both test that
// cached volume BEFORE looking at any instance, so a pool whose instances
// have moved since the volume was computed goes silently unpickable — and
// invisible — wherever they moved to. Nulling on write costs nothing (the
// recompute is lazy, once per pick, not once per write) and is the only
// thing standing between "the orbs moved" and "the orbs stopped answering
// the mouse". This bit at scale: a handful of nodes near the origin stay
// inside the first sphere by luck; a hundred spreading out do not.
function invalidate(mesh) {
  mesh.boundingSphere = null;
  mesh.boundingBox = null;
}

export class InstancePool {
  constructor(scene, { geometry, material, capacity = 512, poolKind = "instance" } = {}) {
    this.scene = scene;
    this.geom = geometry;
    this.mat = material;
    this.poolKind = poolKind;
    this.capacity = capacity;
    this.ids = [];              // slot -> id
    this.slotOf = new Map();    // id -> slot
    this.st = [];               // slot -> {p, s, q|null, m|null, vis}
    this._m = new THREE.Matrix4();
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this._p = new THREE.Vector3();
    this._sv = new THREE.Vector3();
    this._qi = new THREE.Quaternion();
    this._c = new THREE.Color();
    this._make(0);
  }
  _make(count) {
    this.mesh = new THREE.InstancedMesh(this.geom, this.mat, this.capacity);
    this.mesh.count = count;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.userData.poolKind = this.poolKind;
    this.scene.add(this.mesh);
  }
  _grow() {
    const old = this.mesh;
    // Growing REPLACES the InstancedMesh, so anything a caller stamped on
    // the old mesh's userData has to come with it. scenestage tags each pool
    // with `scenePool` (instanceId -> node id) and `affordant` (whether the
    // pick ray may touch it), both at construction — losing them turns a
    // pool silently unpickable the moment it outgrows its first capacity,
    // while it keeps rendering perfectly. Nothing looks wrong; the scene
    // just stops answering the mouse.
    const carried = Object.assign({}, old.userData);
    this.capacity *= 2;
    this.scene.remove(old);
    this._make(old.count);
    Object.assign(this.mesh.userData, carried);
    for (let i = 0; i < old.count; i++) {
      old.getMatrixAt(i, this._m); this.mesh.setMatrixAt(i, this._m);
      if (old.instanceColor) { old.getColorAt(i, this._c); this.mesh.setColorAt(i, this._c); }
    }
    old.dispose();
    this._dirty();
  }
  _dirty() {
    this.mesh.instanceMatrix.needsUpdate = true;
    invalidate(this.mesh);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  _write(slot) {
    const st = this.st[slot];
    if (!st.vis) { this.mesh.setMatrixAt(slot, this._zero); return; }
    if (st.m) { this.mesh.setMatrixAt(slot, st.m); return; }
    this._p.set(st.p.x, st.p.y, st.p.z);
    this._sv.set(st.s.x, st.s.y, st.s.z);
    this._m.compose(this._p, st.q || this._qi.identity(), this._sv);
    this.mesh.setMatrixAt(slot, this._m);
  }
  get count() { return this.mesh.count; }

  add(id, pos, scale, hex, rot) {
    if (this.mesh.count >= this.capacity) this._grow();
    const slot = this.mesh.count++;
    const q = rot ? new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0)) : null;
    this.ids[slot] = id; this.slotOf.set(id, slot);
    this.st[slot] = { p: V(pos), s: asScale(scale), q, m: null, vis: true };
    this._write(slot);
    this.mesh.setColorAt(slot, this._c.set(hex));
    this._dirty();
  }
  move(id, pos) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    const st = this.st[slot];
    st.p = V(pos); st.m = null;
    this._write(slot);
    this.mesh.instanceMatrix.needsUpdate = true;
    invalidate(this.mesh);
  }
  /** Resize in place (op bodies vary by width; scene nodes by their scale). */
  setScale(id, scale, pos) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    const st = this.st[slot];
    st.s = asScale(scale); if (pos !== undefined) st.p = V(pos); st.m = null;
    this._write(slot);
    this.mesh.instanceMatrix.needsUpdate = true;
    invalidate(this.mesh);
  }
  /** Per-slot euler rotation (scene nodes spin; flow ops never do). */
  setRotation(id, rot) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    const st = this.st[slot];
    st.q = rot ? new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0)) : null;
    st.m = null;
    this._write(slot);
    this.mesh.instanceMatrix.needsUpdate = true;
    invalidate(this.mesh);
  }
  /** A full world matrix (16 column-major floats) — parented nodes whose
      world transform the caller computes (the scenestage sweep). An explicit
      matrix write means "place it here, visible": it clears a prior hide,
      so a freshly added node stays zero until its first sweep and never
      needs a separate show call. */
  setMatrix(id, elements) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    const st = this.st[slot];
    if (!st.m) st.m = new THREE.Matrix4();
    st.m.fromArray(elements);
    st.vis = true;
    this._write(slot);
    this.mesh.instanceMatrix.needsUpdate = true;
    invalidate(this.mesh);
  }
  setColor(id, hex) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    this.mesh.setColorAt(slot, this._c.set(hex));
    this.mesh.instanceColor.needsUpdate = true;
  }
  /** Hiding is a zero write: keeps the slot dense (no restructuring on a
      visibility toggle, which is a hot path for hover/selection gizmos). */
  setVisible(id, v) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    this.st[slot].vis = !!v;
    this._write(slot);
    this.mesh.instanceMatrix.needsUpdate = true;
    invalidate(this.mesh);
  }
  remove(id) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    const last = this.mesh.count - 1;
    if (slot !== last) {
      this.mesh.getMatrixAt(last, this._m); this.mesh.setMatrixAt(slot, this._m);
      if (this.mesh.instanceColor) { this.mesh.getColorAt(last, this._c); this.mesh.setColorAt(slot, this._c); }
      const movedId = this.ids[last];
      this.ids[slot] = movedId; this.slotOf.set(movedId, slot); this.st[slot] = this.st[last];
    }
    this.mesh.count = last;
    this.ids.length = last; this.st.length = last;
    this.slotOf.delete(id);
    this._dirty();
  }
  idAt(instanceId) { return this.ids[instanceId]; }
  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose(); this.geom.dispose(); this.mat.dispose();
  }
}

/** A merged fixed-topology tube pool: every tube has the same segment/radial
    counts, so one index template offset per slot builds the whole buffer and
    an update rewrites just that slot's vertex range. Pick with
    `idAtFace(hit.faceIndex)`.

    `curve(from, to)` is injected — the flow stage hangs its wires vertically,
    a scene stage may want straight connectors — so the pool never knows what
    the tubes MEAN. */
export class TubePool {
  constructor(scene, { curve, seg = 16, rad = 6, capacity = 256,
                       opacity = 0.6, poolKind = "tube" } = {}) {
    this.scene = scene;
    this.curve = curve || ((from, to) => new THREE.LineCurve3(
      new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(to.x, to.y, to.z)));
    this.SEG = seg; this.RAD = rad;
    this.poolKind = poolKind;
    this.vertsPer = (seg + 1) * (rad + 1);
    this.facesPer = seg * rad * 2;
    this.idxPer = this.facesPer * 3;
    this.capacity = capacity;
    this.count = 0;
    this.ids = []; this.slotOf = new Map();
    this.params = [];    // slot -> {from, to, r, hex}, for updates and restores
    const t = new THREE.TubeGeometry(
      new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0)), seg, 1, rad, false);
    this.template = Array.from(t.index.array);
    t.dispose();
    this._alloc();
    this.mesh = new THREE.Mesh(this.geometry,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity }));
    this.mesh.frustumCulled = false;   // ranges span the scene; skip per-frame bounds
    this.mesh.userData.poolKind = this.poolKind;
    this.scene.add(this.mesh);
  }
  _alloc() {
    const v = this.capacity * this.vertsPer;
    this.geometry = new THREE.BufferGeometry();
    this.pos = new Float32Array(v * 3);
    this.nrm = new Float32Array(v * 3);
    this.col = new Float32Array(v * 3);
    const idx = new Uint32Array(this.capacity * this.idxPer);
    for (let s = 0; s < this.capacity; s++) {
      const vBase = s * this.vertsPer, iBase = s * this.idxPer;
      for (let k = 0; k < this.idxPer; k++) idx[iBase + k] = this.template[k] + vBase;
    }
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute("normal", new THREE.BufferAttribute(this.nrm, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.geometry.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geometry.setDrawRange(0, this.count * this.idxPer);
    invalidate(this.geometry);
  }
  _grow() {
    const oldPos = this.pos, oldNrm = this.nrm, oldCol = this.col, oldGeom = this.geometry;
    this.capacity *= 2;
    this._alloc();
    this.pos.set(oldPos); this.nrm.set(oldNrm); this.col.set(oldCol);
    oldGeom.dispose();
    this.mesh.geometry = this.geometry;
    this.geometry.setDrawRange(0, this.count * this.idxPer);
    invalidate(this.geometry);
  }
  _paint(slot, hex) {
    const c = new THREE.Color(hex);
    const base = slot * this.vertsPer * 3;
    for (let i = 0; i < this.vertsPer; i++) {
      const o = base + i * 3;
      this.col[o] = c.r; this.col[o + 1] = c.g; this.col[o + 2] = c.b;
    }
    this.geometry.attributes.color.needsUpdate = true;
  }
  _write(slot, from, to, r, hex) {
    const g = new THREE.TubeGeometry(this.curve(from, to), this.SEG, r, this.RAD, false);
    const base = slot * this.vertsPer * 3;
    this.pos.set(g.attributes.position.array, base);
    this.nrm.set(g.attributes.normal.array, base);
    g.dispose();
    this._paint(slot, hex);
    this.geometry.attributes.position.needsUpdate = true;
    invalidate(this.geometry);
    this.geometry.attributes.normal.needsUpdate = true;
  }
  add(id, from, to, r, hex) {
    if (this.count >= this.capacity) this._grow();
    const slot = this.count++;
    this.ids[slot] = id; this.slotOf.set(id, slot);
    this.params[slot] = { from, to, r, hex };
    this._write(slot, from, to, r, hex);
    this.geometry.setDrawRange(0, this.count * this.idxPer);
    invalidate(this.geometry);
  }
  update(id, from, to, r) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    const p = this.params[slot];
    p.from = from; p.to = to; if (r !== undefined) p.r = r;
    this._write(slot, p.from, p.to, p.r, p.hex);
  }
  setColor(id, hex) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    this.params[slot].hex = hex;
    this._paint(slot, hex);
  }
  remove(id) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    const last = this.count - 1;
    if (slot !== last) {
      const vb = this.vertsPer * 3;
      this.pos.copyWithin(slot * vb, last * vb, (last + 1) * vb);
      this.nrm.copyWithin(slot * vb, last * vb, (last + 1) * vb);
      this.col.copyWithin(slot * vb, last * vb, (last + 1) * vb);
      const movedId = this.ids[last];
      this.ids[slot] = movedId; this.slotOf.set(movedId, slot);
      this.params[slot] = this.params[last];
      this.geometry.attributes.position.needsUpdate = true;
    invalidate(this.geometry);
      this.geometry.attributes.normal.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }
    this.count = last;
    this.ids.length = last; this.params.length = last;
    this.slotOf.delete(id);
    this.geometry.setDrawRange(0, this.count * this.idxPer);
    invalidate(this.geometry);
  }
  idAtFace(faceIndex) { return this.ids[Math.floor(faceIndex / this.facesPer)]; }
  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose(); this.mesh.material.dispose();
  }
}

/** A merged LineSegments pool for EDGE OUTLINES. InstancedMesh cannot hold
    LineSegments, so op-body outlines — half of every op's draw-call cost —
    need their own batch: one template of unit-shape edge vertices, written
    per slot transformed by (position, scale), with per-slot colour.

    `template` is a Float32Array of the unit shape's edge vertices (pairs of
    endpoints, as EdgesGeometry produces). Every slot shares its topology,
    which is what makes a range rewrite cheap. */
export class LinePool {
  constructor(scene, { template, capacity = 256, poolKind = "line",
                       dashed = false } = {}) {
    this.scene = scene;
    this.template = template;
    this.vertsPer = template.length / 3;
    this.capacity = capacity;
    this.count = 0;
    this.poolKind = poolKind;
    this.ids = []; this.slotOf = new Map();
    this.params = [];        // slot -> {pos, scale, hex}
    this._c = new THREE.Color();
    this._alloc();
    const mat = dashed
      ? new THREE.LineDashedMaterial({ vertexColors: true, dashSize: 0.06, gapSize: 0.04 })
      : new THREE.LineBasicMaterial({ vertexColors: true });
    this.mesh = new THREE.LineSegments(this.geometry, mat);
    this.mesh.frustumCulled = false;   // the range spans the deck
    this.mesh.userData.poolKind = poolKind;
    this.scene.add(this.mesh);
  }
  _alloc() {
    this.geometry = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.capacity * this.vertsPer * 3);
    this.col = new Float32Array(this.capacity * this.vertsPer * 3);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.geometry.setDrawRange(0, this.count * this.vertsPer);
    invalidate(this.geometry);
  }
  _grow() {
    const oldPos = this.pos, oldCol = this.col, oldGeom = this.geometry;
    this.capacity *= 2;
    this._alloc();
    this.pos.set(oldPos); this.col.set(oldCol);
    oldGeom.dispose();
    this.mesh.geometry = this.geometry;
    this.geometry.setDrawRange(0, this.count * this.vertsPer);
    invalidate(this.geometry);
  }
  _write(slot, pos, scale) {
    const s = asScale(scale), p = V(pos);
    const base = slot * this.vertsPer * 3;
    for (let i = 0; i < this.vertsPer; i++) {
      const t = i * 3, o = base + t;
      this.pos[o] = this.template[t] * s.x + p.x;
      this.pos[o + 1] = this.template[t + 1] * s.y + p.y;
      this.pos[o + 2] = this.template[t + 2] * s.z + p.z;
    }
    this.geometry.attributes.position.needsUpdate = true;
    invalidate(this.geometry);
  }
  _paint(slot, hex) {
    this._c.set(hex);
    const base = slot * this.vertsPer * 3;
    for (let i = 0; i < this.vertsPer; i++) {
      const o = base + i * 3;
      this.col[o] = this._c.r; this.col[o + 1] = this._c.g; this.col[o + 2] = this._c.b;
    }
    this.geometry.attributes.color.needsUpdate = true;
  }
  add(id, pos, scale, hex) {
    if (this.count >= this.capacity) this._grow();
    const slot = this.count++;
    this.ids[slot] = id; this.slotOf.set(id, slot);
    this.params[slot] = { pos: V(pos), scale: asScale(scale), hex };
    this._write(slot, pos, scale);
    this._paint(slot, hex);
    this.geometry.setDrawRange(0, this.count * this.vertsPer);
    invalidate(this.geometry);
  }
  move(id, pos) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    this.params[slot].pos = V(pos);
    this._write(slot, this.params[slot].pos, this.params[slot].scale);
  }
  setScale(id, scale) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    this.params[slot].scale = asScale(scale);
    this._write(slot, this.params[slot].pos, this.params[slot].scale);
  }
  setColor(id, hex) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    this.params[slot].hex = hex;
    this._paint(slot, hex);
  }
  /** Hiding collapses the slot to a point — keeps slots dense, same trick as
      InstancePool's zero scale. */
  setVisible(id, v) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    const p = this.params[slot];
    this._write(slot, p.pos, v ? p.scale : { x: 0, y: 0, z: 0 });
  }
  remove(id) {
    const slot = this.slotOf.get(id);
    if (slot === undefined) return;
    const last = this.count - 1;
    if (slot !== last) {
      const vb = this.vertsPer * 3;
      this.pos.copyWithin(slot * vb, last * vb, (last + 1) * vb);
      this.col.copyWithin(slot * vb, last * vb, (last + 1) * vb);
      const movedId = this.ids[last];
      this.ids[slot] = movedId; this.slotOf.set(movedId, slot);
      this.params[slot] = this.params[last];
      this.geometry.attributes.position.needsUpdate = true;
    invalidate(this.geometry);
      this.geometry.attributes.color.needsUpdate = true;
    }
    this.count = last;
    this.ids.length = last; this.params.length = last;
    this.slotOf.delete(id);
    this.geometry.setDrawRange(0, this.count * this.vertsPer);
    invalidate(this.geometry);
  }
  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose(); this.mesh.material.dispose();
  }
}

/** The unit-shape edge template a LinePool needs, from any geometry. */
export function edgeTemplate(geometry) {
  const e = new THREE.EdgesGeometry(geometry);
  const arr = Float32Array.from(e.attributes.position.array);
  e.dispose();
  return arr;
}
