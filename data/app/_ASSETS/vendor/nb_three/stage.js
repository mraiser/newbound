// stage.js — nb_three's single THREE.js touchpoint (flow3d-design §4.2 +
// Appendix B). Callers speak ids, plain-JSON specs, DOM-flavored events; no
// THREE class, vector, or event crosses this line in either direction
// (flow3d-design §7.2, acceptance 5). THREE is imported ONLY here.
//
// The kind vocabulary IS the flow visual language, not raw geometry:
//   box · spine-box · capsule · wedge-capsule · cylinder · glass-box ·
//   ghost-box · rail · socket · ring · tube · helix · flag · jump-pipe ·
//   grid · outline · token
// Materials are TOKENS resolved against the bench palette by the theme table:
//   paper · graphite · glass · ghost · accent · ink · wire ·
//   hue:<facet> · state:<good|danger|sky|ink>
//
// Rendering is ON-DEMAND: a frame is drawn on state/camera/drag/animation
// change, never on a free-running loop (flow3d-design §7.2, §7.4). Idle scene
// = zero GPU work.

import * as THREE from "./three.module.js";
import { InstancePool, LinePool, TubePool, edgeTemplate } from "./pools.js";

// ── the theme table: bench palette hexes (source of truth: assets/tokens.css /
//    DESIGN §5.2). setTheme(tokens) overrides any key at runtime. ────────────
const DEFAULT_THEME = {
  ground: "#171a1e", panel: "#1f242a", panel2: "#262c33",
  line: "#333b44", lineSoft: "#2a313a",
  text: "#d8dee6", textDim: "#8a94a0", textFaint: "#5c6672",
  paper: "#f6f4ee", paperEdge: "#d9d2c4", ink: "#2a2620", inkDim: "#7a7264",
  accent: "#f0a63c", accentDim: "#a9762e",
  "hue:html": "#e2725b", "hue:css": "#56a3d9", "hue:js": "#ead16c",
  "hue:data": "#a78bda", "hue:3d": "#62bd8c", "hue:cmd": "#d96ba0",
  "hue:commands": "#d96ba0",
  good: "#4fae6e", danger: "#c15a5a", sky: "#56a3d9",
};

const REDUCED_MOTION = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const V = (p) => new THREE.Vector3(p?.x ?? 0, p?.y ?? 0, p?.z ?? 0);
const plainV = (v) => ({ x: v.x, y: v.y, z: v.z });

export function mount(host, opts = {}) {
  return new Stage(host, opts);
}

// Namespaced entry so callers can write nb_three.stage.mount(...) too.
export const stage = { mount };

class Stage {
  constructor(host, opts) {
    this.host = host;
    this.theme = { ...DEFAULT_THEME, ...(opts.theme || {}) };
    this.objects = new Map();   // id -> { spec, group, meta }
    this.anchors = [];          // { id, el, occlusionFade }
    this.pickables = new Set(); // ids that raycast
    this._geomCache = new Map();
    this._matCache = new Map();
    this._hoverCb = null;
    this._pickCb = null;
    this._cameraCb = null;
    this._activeDrag = null;
    this._anim = null;
    this._needsRender = false;
    this._raf = 0;
    this._disposed = false;

    // renderer — preserveDrawingBuffer so screenshot() works after an
    // on-demand render (an IDE can afford the small cost).
    this.renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2));
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.touchAction = "none";
    host.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.ground);
    // subtle depth fog toward the ground so background decks recede (§2.3)
    this.scene.fog = new THREE.Fog(this.theme.ground, 14, 42);

    // cameras — perspective 40° default, plus a front-ortho for the parity
    // view (§2.7). Both share the same target.
    this.persp = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
    this.ortho = new THREE.OrthographicCamera(-5, 5, 5, -5, -100, 400);
    this.projection = "persp";
    this.camera = this.persp;
    this.target = new THREE.Vector3(0, 0, 0);
    this.persp.position.set(0, 0, 12);
    this.ortho.position.set(0, 0, 12);
    this.orthoHalfHeight = 5;

    // lighting: warm hemisphere (paper reads warm) + a soft directional key.
    // No shadow maps in v1 (§2.3).
    const hemi = new THREE.HemisphereLight(0xfff4e2, 0x20262c, 1.05);
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(3, 8, 6);
    this.scene.add(hemi, key);

    this.raycaster = new THREE.Raycaster();
    this._installPointer();
    this.resize();
    this._syncCamera();
    this._requestRender();
    if (opts.onReady) opts.onReady(this);
  }

  // ── material / geometry resolution (pooled) ───────────────────────────────
  _color(hex) { return new THREE.Color(hex); }

  _material(token = "paper") {
    if (this._matCache.has(token)) return this._matCache.get(token);
    const t = this.theme;
    let mat;
    const lambert = (hex, extra = {}) =>
      new THREE.MeshLambertMaterial({ color: this._color(hex), ...extra });
    if (token === "paper") mat = lambert(t.paper);
    else if (token === "graphite") mat = lambert(t.panel);
    else if (token === "graphite2") mat = lambert(t.panel2);
    else if (token === "ink") mat = lambert(t.ink);
    else if (token === "accent") mat = lambert(t.accent, { emissive: this._color(t.accentDim), emissiveIntensity: 0.35 });
    else if (token === "glass") mat = lambert(t.paper, { transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false });
    else if (token === "ghost") mat = lambert(t.paper, { transparent: true, opacity: 0.22, depthWrite: false });
    else if (token === "wire") mat = new THREE.MeshBasicMaterial({ color: this._color(t.textDim), transparent: true, opacity: 0.6 });
    else if (token === "token") mat = new THREE.MeshBasicMaterial({ color: this._color(t.accent) });
    else if (token.startsWith("hue:")) mat = lambert(t[token] || t["hue:cmd"]);
    else if (token.startsWith("state:")) {
      const s = token.slice(6);
      mat = lambert(t[s] || t.ink);
    } else mat = lambert(t.paper);
    this._matCache.set(token, mat);
    return mat;
  }

  _lineMat(token = "edge", dashed = false) {
    const key = `line:${token}:${dashed}`;
    if (this._matCache.has(key)) return this._matCache.get(key);
    const t = this.theme;
    const hex = token === "edge" ? t.paperEdge
      : token === "line" ? t.line
      : token === "accent" ? t.accent
      : token === "sky" ? t.sky
      : this.theme[token] || t.paperEdge;
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color: this._color(hex), dashSize: 0.08, gapSize: 0.06 })
      : new THREE.LineBasicMaterial({ color: this._color(hex) });
    this._matCache.set(key, mat);
    return mat;
  }

  _geom(key, build) {
    if (this._geomCache.has(key)) return this._geomCache.get(key);
    const g = build();
    this._geomCache.set(key, g);
    return g;
  }

  // ── declarative scene objects ─────────────────────────────────────────────
  // sockets and wires batch through the SHARED nb_three core (pools.js) —
  // scenestage draws its collections with the same two pools.
  _socketPool() {
    return this.socketPool ?? (this.socketPool = new InstancePool(this.scene, {
      geometry: new THREE.SphereGeometry(1, 12, 8),
      material: new THREE.MeshLambertMaterial({ color: 0xffffff }),
      capacity: 512, poolKind: "socket",
    }));
  }
  _wirePool() {
    return this.wirePool ?? (this.wirePool = new TubePool(this.scene, {
      curve: (from, to) => this._curveVertical(from, to),
      seg: 16, rad: 6, capacity: 256, opacity: 0.6, poolKind: "wire",
    }));
  }
  _socketColor(spec) { return spec.emphasis ? this.theme.accent : (spec.params?.wired ? this.theme.paper : this.theme.panel); }
  _wireColor(spec) { return spec.emphasis ? this.theme.accent : this.theme.textDim; }

  /** Op-BODY pools, keyed by (kind, material): every op body is one instance
      of a UNIT box scaled to its w/h/d, and its edge outline one slot of a
      merged LineSegments buffer. Framed, a 500-op case cost 1000 draw calls
      (a body mesh AND an outline each) — that is the half of §7.2's budget
      the socket/wire pools never touched. */
  _bodyPool(key, material) {
    this.bodyPools = this.bodyPools || new Map();
    let p = this.bodyPools.get(key);
    if (!p) {
      p = new InstancePool(this.scene, {
        geometry: new THREE.BoxGeometry(1, 1, 1),
        material: this._material(material).clone(),
        capacity: 256, poolKind: "body:" + key,
      });
      this.bodyPools.set(key, p);
    }
    return p;
  }
  _edgePool(token, dashed) {
    const key = token + (dashed ? ":dashed" : "");
    this.edgePools = this.edgePools || new Map();
    let p = this.edgePools.get(key);
    if (!p) {
      p = new LinePool(this.scene, {
        template: edgeTemplate(this._geom("box:1:1:1", () => new THREE.BoxGeometry(1, 1, 1))),
        capacity: 256, dashed, poolKind: "edge:" + key,
      });
      this.edgePools.set(key, p);
    }
    return p;
  }
  _edgeHex(token) { return this.theme[token === "edge" ? "line" : token] ?? this.theme.line; }

  /** Pool-eligible specs: numerous identical kinds at the scene root. Parented
      instances (e.g. glass-case miniature wires) stay individual meshes.
      `box` is the pooled OP BODY — the common kind, a plain rectangle with no
      child geometry. spine-box and glass-box carry children (a spine, a
      miniature) and stay individual until those have pools of their own;
      ghost-box is edges ONLY, so it has no instance to raycast and would
      need a separate pick proxy — it stays individual too (it is the rare
      "undefined" op). */
  _poolKindOf(spec) {
    if (spec.parent) return null;
    if (spec.kind === "socket") return "socket";
    if (spec.kind === "tube" && (spec.material ?? "wire") === "wire") return "wire";
    if (spec.kind === "box") return "body";
    return null;
  }

  _bodyScale(spec) {
    const p = spec.params || {};
    return { x: p.w ?? 1.5, y: p.h ?? 0.6, z: p.d ?? 0.6 };
  }
  _bodyKeyOf(spec) { return spec.material || "paper"; }
  _bodyHex(spec) {
    return spec.emphasis ? this.theme.accent : (this.theme[this._bodyKeyOf(spec)] ?? this.theme.paper);
  }

  _upsertPooled(id, spec, poolKind) {
    const prev = this.objects.get(id);
    if (prev) this._removeRec(id, prev);
    const rec = { spec: { ...spec }, pooled: poolKind, position: V(spec.position), extras: null, meta: { pickTargets: [] } };
    if (poolKind === "socket") {
      const r = spec.params?.r ?? 0.06;
      this._socketPool().add(id, rec.position, r, this._socketColor(spec));
      if (spec.visible === false) this.socketPool.setVisible(id, false, rec.position);
      // list/loop rings are rare — individual meshes riding the socket position
      const mode = spec.params?.mode;
      if (mode === "list" || mode === "loop") {
        const g = new THREE.Group();
        g.add(this._ring(0.09));
        if (mode === "loop") { const r2 = this._ring(0.11); r2.position.y = 0.03; g.add(r2); }
        g.position.copy(rec.position);
        this.scene.add(g);
        rec.extras = g;
      }
    } else if (poolKind === "wire") {
      const p = spec.params || {};
      this._wirePool().add(id, p.from, p.to, p.r ?? 0.035, this._wireColor(spec));
    } else {
      // op body: a unit box scaled to w/h/d, plus its outline in a line pool
      const scale = this._bodyScale(spec);
      rec.bodyKey = this._bodyKeyOf(spec);
      rec.edgeKey = "edge"; rec.dashed = false;
      this._bodyPool(rec.bodyKey, rec.bodyKey).add(id, rec.position, scale, this._bodyHex(spec));
      this._edgePool(rec.edgeKey, false).add(id, rec.position, scale, this._edgeHex(rec.edgeKey));
      if (spec.visible === false) {
        this.bodyPools.get(rec.bodyKey).setVisible(id, false, rec.position);
        this.edgePools.get(rec.edgeKey).setVisible(id, false);
      }
    }
    this.objects.set(id, rec);
    if (spec.pickable) this.pickables.add(id); else this.pickables.delete(id);
    this._requestRender();
    return id;
  }

  upsert(id, spec) {
    if (this._disposed) return;
    const poolKind = this._poolKindOf(spec);
    if (poolKind) return this._upsertPooled(id, spec, poolKind);
    const prev = this.objects.get(id);
    if (prev) this._removeRec(id, prev);
    const group = new THREE.Group();
    group.name = id;
    group.position.copy(V(spec.position));
    if (spec.visible === false) group.visible = false;
    this._build(group, spec);
    const parent = spec.parent && this.objects.get(spec.parent);
    (parent ? parent.group : this.scene).add(group);
    const meta = { pickTargets: [] };
    group.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) { o.userData.id = id; meta.pickTargets.push(o); } });
    this.objects.set(id, { spec: { ...spec }, group, meta });
    if (spec.pickable) this.pickables.add(id); else this.pickables.delete(id);
    if (spec.emphasis) this._applyEmphasis(id, spec.emphasis);
    this._requestRender();
    return id;
  }

  /** Transactional batch of partial deltas: {id, position?, params?, material?,
      emphasis?, visible?, parent?}. Cheap fields (position/visible/emphasis)
      update in place; geometry-affecting fields (kind/params/material) rebuild. */
  patch(specs) {
    if (this._disposed) return;
    for (const delta of specs) {
      const id = delta.id;
      const rec = this.objects.get(id);
      if (!rec) { this.upsert(id, delta); continue; }
      if (rec.pooled === "wire") {
        // wire updates are the drag hot path: rewrite the merged range in place
        if (delta.params) {
          const p = { ...(rec.spec.params || {}), ...delta.params };
          rec.spec.params = p;
          this.wirePool.update(id, p.from, p.to, p.r);
        }
        if (delta.emphasis !== undefined) { rec.spec.emphasis = delta.emphasis; this.wirePool.setColor(id, this._wireColor(rec.spec)); }
        if (delta.kind !== undefined || delta.material !== undefined || delta.parent !== undefined) this.upsert(id, { ...rec.spec, ...delta });
        continue;
      }
      if (rec.pooled === "body" || rec.pooled === "ghost") {
        const bp = rec.pooled === "body" ? this.bodyPools?.get(rec.bodyKey) : null;
        const ep = this.edgePools?.get(rec.edgeKey + (rec.dashed ? ":dashed" : ""));
        if (delta.position) {
          rec.position.copy(V(delta.position)); rec.spec.position = delta.position;
          bp?.move(id, rec.position); ep?.move(id, rec.position);
        }
        if (delta.params) {
          rec.spec.params = { ...rec.spec.params, ...delta.params };
          const sc = this._bodyScale(rec.spec);
          bp?.setScale(id, sc, rec.position); ep?.setScale(id, sc);
        }
        if (delta.emphasis !== undefined) {
          rec.spec.emphasis = delta.emphasis;
          bp?.setColor(id, this._bodyHex(rec.spec));
          ep?.setColor(id, delta.emphasis ? this.theme.accent : this._edgeHex(rec.edgeKey));
        }
        if (delta.visible !== undefined) {
          rec.spec.visible = delta.visible;
          bp?.setVisible(id, delta.visible, rec.position); ep?.setVisible(id, delta.visible);
        }
        // kind/material/parent change the pool a body belongs to — rebuild,
        // exactly as the socket branch does
        if (delta.kind !== undefined || delta.material !== undefined || delta.parent !== undefined) {
          this.upsert(id, { ...rec.spec, ...delta,
            params: { ...(rec.spec.params || {}), ...(delta.params || {}) } });
        }
        continue;   // pooled records have no group; never fall through
      } else if (rec.pooled === "socket") {
        if (delta.position) { rec.position.copy(V(delta.position)); rec.spec.position = delta.position; this.socketPool.move(id, rec.position); if (rec.extras) rec.extras.position.copy(rec.position); }
        if (delta.emphasis !== undefined) { rec.spec.emphasis = delta.emphasis; this.socketPool.setColor(id, this._socketColor(rec.spec)); }
        if (delta.visible !== undefined) { rec.spec.visible = delta.visible; this.socketPool.setVisible(id, delta.visible, rec.position); if (rec.extras) rec.extras.visible = delta.visible; }
        if (delta.kind !== undefined || delta.params !== undefined || delta.material !== undefined || delta.parent !== undefined) {
          this.upsert(id, { ...rec.spec, ...delta, params: { ...(rec.spec.params || {}), ...(delta.params || {}) } });
        }
        continue;
      }
      const rebuild = delta.kind !== undefined || delta.params !== undefined ||
        delta.material !== undefined || delta.parent !== undefined;
      if (rebuild) {
        this.upsert(id, { ...rec.spec, ...delta,
          params: { ...(rec.spec.params || {}), ...(delta.params || {}) } });
        continue;
      }
      if (delta.position) { rec.group.position.copy(V(delta.position)); rec.spec.position = delta.position; }
      if (delta.visible !== undefined) { rec.group.visible = delta.visible; rec.spec.visible = delta.visible; }
      if (delta.emphasis !== undefined) { this._applyEmphasis(id, delta.emphasis); rec.spec.emphasis = delta.emphasis; }
      if (delta.opacity !== undefined) this._applyOpacity(id, delta.opacity);
    }
    this._requestRender();
  }

  _removeRec(id, rec) {
    if (rec.pooled === "socket") {
      this.socketPool?.remove(id);
      if (rec.extras) { this.scene.remove(rec.extras); rec.extras.traverse((o) => { if (o.geometry && !this._isPooled(o.geometry)) o.geometry.dispose(); }); }
    } else if (rec.pooled === "wire") {
      this.wirePool?.remove(id);
    } else if (rec.pooled === "body" || rec.pooled === "ghost") {
      if (rec.pooled === "body") this.bodyPools?.get(rec.bodyKey)?.remove(id);
      this.edgePools?.get(rec.edgeKey + (rec.dashed ? ":dashed" : ""))?.remove(id);
    } else {
      this._destroyGroup(rec.group);
      if (rec.group.parent) rec.group.parent.remove(rec.group);
    }
    this.objects.delete(id);
    this.pickables.delete(id);
  }

  remove(id) {
    const rec = this.objects.get(id);
    if (!rec) return;
    this._removeRec(id, rec);
    this._requestRender();
  }

  clear() {
    for (const id of [...this.objects.keys()]) this.remove(id);
    this._requestRender();
  }

  _destroyGroup(group) {
    group.traverse((o) => {
      if (o.geometry && !this._isPooled(o.geometry)) o.geometry.dispose();
    });
    if (group.parent) group.parent.remove(group);
  }

  _isPooled(geom) {
    for (const g of this._geomCache.values()) if (g === geom) return true;
    return false;
  }

  _applyEmphasis(id, state) {
    const rec = this.objects.get(id);
    if (!rec) return;
    if (rec.pooled) {
      rec.spec.emphasis = state;
      if (rec.pooled === "socket") this.socketPool.setColor(id, this._socketColor(rec.spec));
      else if (rec.pooled === "wire") this.wirePool.setColor(id, this._wireColor(rec.spec));
      else {
        if (rec.pooled === "body") this.bodyPools?.get(rec.bodyKey)?.setColor(id, this._bodyHex(rec.spec));
        this.edgePools?.get(rec.edgeKey + (rec.dashed ? ":dashed" : ""))
          ?.setColor(id, rec.spec.emphasis ? this.theme.accent : this._edgeHex(rec.edgeKey));
      }
      return;
    }
    rec.group.traverse((o) => {
      if (o.isLine && o.userData.edge) {
        o.material = state === "select" || state === "hover"
          ? this._lineMat("accent") : this._lineMat(o.userData.edgeToken || "edge");
      }
    });
  }

  _applyOpacity(id, opacity) {
    const rec = this.objects.get(id);
    if (!rec || rec.pooled) return; // pooled kinds share materials; emphasis/color carry state
    rec.group.traverse((o) => {
      if (o.material) { o.material.transparent = opacity < 1; o.material.opacity = opacity; }
    });
  }

  /** Position of an object regardless of pooling (world for root objects). */
  _posOf(rec) {
    return rec.pooled ? rec.position.clone() : rec.group.position.clone();
  }
  _setPos(id, rec, v) {
    if (rec.pooled === "socket") {
      rec.position.copy(v); rec.spec.position = plainV(v);
      this.socketPool.move(id, rec.position);
      if (rec.extras) rec.extras.position.copy(rec.position);
    } else if (rec.pooled === "body" || rec.pooled === "ghost") {
      rec.position.copy(v); rec.spec.position = plainV(v);
      if (rec.pooled === "body") this.bodyPools?.get(rec.bodyKey)?.move(id, rec.position);
      this.edgePools?.get(rec.edgeKey + (rec.dashed ? ":dashed" : ""))?.move(id, rec.position);
    } else if (!rec.pooled) {
      rec.group.position.copy(v); rec.spec.position = plainV(v);
    }
  }

  // ── geometry builders: one per kind ───────────────────────────────────────
  _build(group, spec) {
    const p = spec.params || {};
    const kind = spec.kind;
    const add = (o) => group.add(o);
    const edges = (geom, token = "edge", dashed = false) => {
      const line = new THREE.LineSegments(
        this._geom(`edge:${geom.uuid}`, () => new THREE.EdgesGeometry(geom)),
        this._lineMat(token, dashed));
      line.userData.edge = true;
      line.userData.edgeToken = token;
      if (dashed) line.computeLineDistances();
      return line;
    };

    switch (kind) {
      case "box": {
        const w = p.w ?? 1.5, h = p.h ?? 0.6, d = p.d ?? 0.6;
        const g = this._geom(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
        const mesh = new THREE.Mesh(g, this._material(spec.material || "paper"));
        add(mesh); add(edges(g));
        break;
      }
      case "spine-box": {
        const w = p.w ?? 1.5, h = p.h ?? 0.6, d = p.d ?? 0.6;
        const g = this._geom(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
        add(new THREE.Mesh(g, this._material(spec.material || "paper")));
        add(edges(g));
        const sg = this._geom(`spine:${h}:${d}`, () => new THREE.BoxGeometry(0.12, h, d));
        const spine = new THREE.Mesh(sg, this._material(p.spine || "hue:commands"));
        spine.position.x = -(w / 2 + 0.06);
        add(spine);
        break;
      }
      case "capsule": {
        const w = p.w ?? 1.5, r = p.r ?? 0.25;
        const len = Math.max(0.01, w - 2 * r);
        const g = this._geom(`cap:${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 16));
        const mesh = new THREE.Mesh(g, this._material(spec.material || "paper"));
        mesh.rotation.z = Math.PI / 2; // lie on its side along X
        add(mesh);
        break;
      }
      case "wedge-capsule": {
        const w = p.w ?? 1.5, r = p.r ?? 0.25;
        const len = Math.max(0.01, w - 2 * r);
        const g = this._geom(`cap:${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 16));
        const mesh = new THREE.Mesh(g, this._material(spec.material || "paper"));
        mesh.rotation.z = Math.PI / 2;
        add(mesh);
        // comparator wedge — a small triangular prism notch on the top face
        const wg = this._geom("wedge", () => new THREE.CylinderGeometry(0.13, 0.13, 0.14, 3));
        const wedge = new THREE.Mesh(wg, this._material("ink"));
        wedge.rotation.x = Math.PI / 2;
        wedge.rotation.z = Math.PI;
        wedge.position.set(p.wedgeX ?? 0, r + 0.02, 0);
        add(wedge);
        break;
      }
      case "cylinder": {
        const r = p.r ?? 0.35, h = p.h ?? 0.7;
        const g = this._geom(`cyl:${r}:${h}`, () => new THREE.CylinderGeometry(r, r, h, 24));
        add(new THREE.Mesh(g, this._material(spec.material || "paper")));
        const bg = this._geom(`band:${r}`, () => new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.09, 24));
        const band = new THREE.Mesh(bg, this._material("graphite"));
        add(band);
        break;
      }
      case "glass-box": {
        const w = p.w ?? 1.6, h = p.h ?? 0.7, d = p.d ?? 0.7;
        const g = this._geom(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
        const shell = new THREE.Mesh(g, this._material("glass"));
        add(shell); add(edges(g));
        const slab = this._geom(`slab:${w}:${d}`, () => new THREE.BoxGeometry(w, 0.05, d));
        const lid = new THREE.Mesh(slab, this._material("paper")); lid.position.y = h / 2; add(lid);
        const base = new THREE.Mesh(slab, this._material("paper")); base.position.y = -h / 2; add(base);
        break;
      }
      case "ghost-box": {
        const w = p.w ?? 1.5, h = p.h ?? 0.6, d = p.d ?? 0.6;
        const g = this._geom(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
        add(edges(g, "edge", true));
        break;
      }
      case "rail": {
        const length = p.length ?? 3, cr = 0.2;
        const len = Math.max(0.01, length - 2 * cr);
        const g = this._geom(`rail:${len}`, () => new THREE.CapsuleGeometry(cr, len, 4, 12));
        const mesh = new THREE.Mesh(g, this._material(spec.material || "graphite"));
        mesh.rotation.z = Math.PI / 2;
        mesh.scale.y = 1.25; // 0.4 tall round → ~0.5 profile (§2.3)
        add(mesh);
        break;
      }
      case "socket": {
        const r = p.r ?? 0.06;
        const g = this._geom(`sock:${r}`, () => new THREE.SphereGeometry(r, 12, 8));
        add(new THREE.Mesh(g, this._material(p.wired ? "paper" : "graphite")));
        if (p.mode === "list" || p.mode === "loop") add(this._ring(0.09));
        if (p.mode === "loop") { const r2 = this._ring(0.11); r2.position.y = 0.03; add(r2); }
        break;
      }
      case "ring": add(this._ring(p.r ?? 0.09, spec.material)); break;
      case "tube": {
        add(this._tube(p.from, p.to, p.r ?? 0.035, spec.material || "wire"));
        break;
      }
      case "helix": {
        add(this._helix(p, spec.material || "wire"));
        break;
      }
      case "flag": {
        const height = p.height ?? 0.35;
        const mast = new THREE.Mesh(
          this._geom(`mast:${height}`, () => new THREE.BoxGeometry(0.02, height, 0.02)),
          this._material("graphite"));
        mast.position.y = height / 2;
        add(mast);
        const ruleColor = { next: "state:sky", terminate: "ink", fail: "state:danger", finish: "state:good" }[p.rule] || "ink";
        const pennant = new THREE.Mesh(
          this._geom("pennant", () => new THREE.CylinderGeometry(0.09, 0.09, 0.02, 3)),
          this._material(ruleColor));
        pennant.rotation.x = Math.PI / 2;
        pennant.position.set(0.08, height, p.rule === "next" ? -0.04 : 0);
        add(pennant);
        break;
      }
      case "jump-pipe": add(this._jumpPipe(p.from, p.to, p.r ?? 0.03)); break;
      case "grid": add(this._grid(p)); break;
      case "outline": add(this._outline(p)); break;
      case "token": {
        const g = this._geom("token", () => new THREE.SphereGeometry(0.08, 12, 10));
        add(new THREE.Mesh(g, this._material("token")));
        break;
      }
      default:
        // unknown kind: a small marker so authoring errors are visible, never
        // a crash. (The vocabulary is closed; this is a safety net.)
        add(new THREE.Mesh(
          this._geom("unknown", () => new THREE.BoxGeometry(0.2, 0.2, 0.2)),
          this._material("state:danger")));
    }
  }

  _ring(r, material) {
    const g = this._geom(`ringgeom:${r}`, () => new THREE.TorusGeometry(r, 0.015, 8, 24));
    const ring = new THREE.Mesh(g, this._material(material || "graphite"));
    ring.rotation.x = Math.PI / 2;
    return ring;
  }

  // vertical-tangent cubic (flow3d-design §3.2): exits source straight down,
  // enters dest straight down from above.
  _curveVertical(from, to) {
    const a = V(from), b = V(to);
    const seg = a.distanceTo(b);
    const t = clamp(0.4 * seg, 0.5, 2);
    const c1 = a.clone().add(new THREE.Vector3(0, -t, 0));
    const c2 = b.clone().add(new THREE.Vector3(0, t, 0));
    return new THREE.CubicBezierCurve3(a, c1, c2, b);
  }

  _tube(from, to, r, material) {
    const curve = this._curveVertical(from, to);
    const geom = new THREE.TubeGeometry(curve, 24, r, 8, false);
    return new THREE.Mesh(geom, this._material(material));
  }

  _helix(p, material) {
    // half-turn helical return along the op's +X side (§2.6). from = loop
    // output socket, to = paired input on the top face.
    const a = V(p.from), b = V(p.to);
    const radius = p.radius ?? 0.2, turns = p.turns ?? 0.5, steps = 40;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const ang = Math.PI * 2 * turns * f + Math.PI / 2;
      const base = a.clone().lerp(b, f);
      base.x += Math.cos(ang) * radius + radius;
      base.z += Math.sin(ang) * radius;
      pts.push(base);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geom = new THREE.TubeGeometry(curve, steps, p.r ?? 0.03, 6, false);
    return new THREE.Mesh(geom, this._material(material));
  }

  _jumpPipe(from, to, r) {
    // arcs backward in −Z into the next deck (§2.4)
    const a = V(from), b = V(to);
    const mid = a.clone().lerp(b, 0.5);
    mid.z -= 3.5; mid.y += 0.4;
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    const geom = new THREE.TubeGeometry(curve, 30, r, 6, false);
    return new THREE.Mesh(geom, this._material("state:sky"));
  }

  _grid(p) {
    const w = p.w ?? 6, d = p.d ?? 6, pitch = p.pitch ?? 0.2;
    const y = p.y ?? 0;
    const verts = [];
    const nx = Math.floor(w / pitch), nz = Math.floor(d / pitch);
    for (let i = -nx / 2; i <= nx / 2; i++)
      for (let j = -nz / 2; j <= nz / 2; j++)
        verts.push(i * pitch, y, j * pitch);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.PointsMaterial({ color: this._color(this.theme.line), size: 0.03, sizeAttenuation: true });
    return new THREE.Points(geom, mat);
  }

  _outline(p) {
    const w = p.w ?? 4, d = p.d ?? 4, y = p.y ?? 0.001;
    const hw = w / 2, hd = d / 2;
    const pts = [
      -hw, y, -hd, hw, y, -hd, hw, y, hd, -hw, y, hd, -hw, y, -hd,
    ];
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const line = new THREE.Line(geom, this._lineMat("line"));
    line.userData.edge = true;
    line.userData.edgeToken = "line";
    return line;
  }

  // ── picking & hover ───────────────────────────────────────────────────────
  _ndc(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      -(((y - rect.top) / rect.height) * 2 - 1));
  }

  pick(x, y) {
    this.raycaster.setFromCamera(this._ndc(x, y), this.camera);
    const targets = [];
    let anyPooled = false;
    for (const id of this.pickables) {
      const rec = this.objects.get(id);
      if (!rec) continue;
      if (rec.pooled) { anyPooled = true; continue; }
      if (rec.group.visible) targets.push(...rec.meta.pickTargets);
    }
    if (anyPooled) {
      if (this.socketPool?.mesh.count) targets.push(this.socketPool.mesh);
      if (this.wirePool?.count) targets.push(this.wirePool.mesh);
      // op bodies pick through their instance pools; edge outlines are
      // decoration and never intercept
      for (const bp of this.bodyPools?.values() ?? []) if (bp.count) targets.push(bp.mesh);
    }
    const hits = this.raycaster.intersectObjects(targets, false);
    for (const hit of hits) {
      const poolKind = hit.object.userData.poolKind;
      let id;
      if (poolKind === "socket") id = this.socketPool.idAt(hit.instanceId);
      else if (poolKind === "wire") id = this.wirePool.idAtFace(hit.faceIndex);
      else if (poolKind?.startsWith("body:")) {
        const bp = this.bodyPools.get(poolKind.slice(5));
        id = bp?.idAt(hit.instanceId);
      }
      else id = hit.object.userData.id;
      if (id !== undefined && this.pickables.has(id)) return { id, point: plainV(hit.point) };
    }
    return null;
  }

  onHover(cb) { this._hoverCb = cb; }
  onPick(cb) { this._pickCb = cb; }

  /** Fires on pointerdown with (hit|null, {clientX, clientY, altKey, shiftKey,
      button}). If the callback returns truthy (or starts a drag/capture), the
      stage yields this press — no orbit, no pick — so the caller can drive a
      gesture (move/wire/resize). The editor uses this; the viewer doesn't set it. */
  onPointerDown(cb) { this._pointerDownCb = cb; }

  /** Raw pointer capture for caller-driven gestures with no stage object to
      move (e.g. wiring). Suppresses orbit until pointerup. onMove/onEnd receive
      {x, y, altKey, shiftKey} in client coords — the caller pairs them with
      pick()/screenToPlane() for visuals. */
  capturePointer(handlers = {}) {
    const onMove = (ev) => handlers.onMove && handlers.onMove({ x: ev.clientX, y: ev.clientY, altKey: ev.altKey, shiftKey: ev.shiftKey });
    const onUp = (ev) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      this._activeDrag = null;
      handlers.onEnd && handlers.onEnd({ x: ev.clientX, y: ev.clientY, altKey: ev.altKey, shiftKey: ev.shiftKey });
    };
    this._activeDrag = { id: null, onMove, onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /** Unproject a screen point onto a world plane {point:{x,y,z}, normal:{x,y,z}}
      → {x,y,z} | null. THREE-free interface; the substrate for wiring's ghost
      and for terminal drags. */
  screenToPlane(x, y, plane = {}) {
    this.raycaster.setFromCamera(this._ndc(x, y), this.camera);
    const tp = new THREE.Plane().setFromNormalAndCoplanarPoint(
      V(plane.normal || { x: 0, y: 0, z: 1 }), V(plane.point || { x: 0, y: 0, z: 0 }));
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(tp, out) ? plainV(out) : null;
  }

  // ── constrained drag (flow3d-design §5.3) ─────────────────────────────────
  beginDrag(id, opts = {}) {
    const rec = this.objects.get(id);
    if (!rec || rec.pooled === "wire") return;
    const plane = opts.plane || "xy";
    const snap = opts.snap ?? 0;
    const start = this._posOf(rec);
    const dragPlane = new THREE.Plane();
    const setPlane = (origin) => {
      const n = plane === "xz" ? new THREE.Vector3(0, 1, 0)
        : plane === "xy" ? new THREE.Vector3(0, 0, 1)
        : this.camera.getWorldDirection(new THREE.Vector3()).negate();
      dragPlane.setFromNormalAndCoplanarPoint(n, origin);
    };
    setPlane(start);
    const hitPoint = (ev) => {
      this.raycaster.setFromCamera(this._ndc(ev.clientX, ev.clientY), this.camera);
      const out = new THREE.Vector3();
      return this.raycaster.ray.intersectPlane(dragPlane, out) ? out : null;
    };
    const grabAt = hitPoint({ clientX: opts.clientX ?? 0, clientY: opts.clientY ?? 0 });
    const grabOffset = grabAt ? start.clone().sub(grabAt) : new THREE.Vector3();
    const snapv = (v) => snap > 0 ? Math.round(v / snap) * snap : v;
    const onMove = (ev) => {
      const hit = hitPoint(ev);
      if (!hit) return;
      const np = hit.clone().add(grabOffset);
      if (plane !== "xz") { np.z = start.z; }
      if (plane === "xz") { np.y = start.y; }
      np.set(snapv(np.x), snapv(np.y), snapv(np.z));
      this._setPos(id, rec, np);
      if (opts.onMove) opts.onMove(plainV(np));
      this._requestRender();
    };
    const onUp = (ev) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      this._activeDrag = null;
      if (opts.onEnd) opts.onEnd(plainV(this._posOf(rec)));
    };
    this._activeDrag = { id, onMove, onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  showGizmo(id, opts = {}) {
    // translate-only gizmo (no rotation/scale handles exist — §6.2). Arrow
    // handles along the requested axes; the wrapper owns them so no THREE
    // helper class leaks to callers.
    this.hideGizmo();
    const rec = this.objects.get(id);
    if (!rec) return;
    const axes = opts.axes || ["x", "y"];
    const g = new THREE.Group();
    const dirs = { x: [1, 0, 0, "state:danger"], y: [0, 1, 0, "state:good"], z: [0, 0, 1, "state:sky"] };
    for (const ax of axes) {
      const [dx, dy, dz, col] = dirs[ax];
      const shaft = new THREE.Mesh(
        this._geom("gizmoShaft", () => new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6)),
        this._material(col));
      const dir = new THREE.Vector3(dx, dy, dz);
      shaft.position.copy(dir.clone().multiplyScalar(0.4));
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      g.add(shaft);
    }
    g.userData.gizmo = true;
    g.position.copy(this._posOf(rec));
    this.scene.add(g);
    this._gizmo = g;
    this._requestRender();
  }

  hideGizmo() {
    if (this._gizmo) { this.scene.remove(this._gizmo); this._gizmo = null; this._requestRender(); }
  }

  // ── camera rig ────────────────────────────────────────────────────────────
  setProjection(mode) {
    if (mode === this.projection) return;
    this.projection = mode;
    if (mode === "ortho-front") {
      // look down −Z, y up: the 2D viewer's exact picture for z=0 (§2.7)
      const dist = this.persp.position.distanceTo(this.target);
      this.ortho.position.set(this.target.x, this.target.y, this.target.z + Math.max(dist, 1));
      this.camera = this.ortho;
    } else {
      this.camera = this.persp;
    }
    this._syncCamera();
    this._requestRender();
    if (this._cameraCb) this._cameraCb(this.getPose());
  }

  _expandBy(box, rec) {
    if (rec.pooled === "socket") box.expandByPoint(rec.position);
    else if (rec.pooled === "wire") {
      const p = rec.spec.params;
      if (p?.from) box.expandByPoint(V(p.from));
      if (p?.to) box.expandByPoint(V(p.to));
    } else box.expandByObject(rec.group);
  }

  frame(idsOrBbox) {
    const box = new THREE.Box3();
    if (Array.isArray(idsOrBbox)) {
      for (const id of idsOrBbox) {
        const rec = this.objects.get(id);
        if (rec) this._expandBy(box, rec);
      }
    } else if (idsOrBbox && idsOrBbox.min) {
      box.set(V(idsOrBbox.min), V(idsOrBbox.max));
    } else {
      for (const rec of this.objects.values()) this._expandBy(box, rec);
    }
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 1) * 0.6;
    this.target.copy(center);
    const fov = this.persp.fov * Math.PI / 180;
    const dist = radius / Math.sin(fov / 2) + radius;
    this.persp.position.set(center.x, center.y, center.z + dist);
    this.orthoHalfHeight = Math.max(size.y, size.x / this._aspect()) * 0.6 + radius * 0.3;
    this.ortho.position.set(center.x, center.y, center.z + Math.max(dist, 1));
    this._syncCamera();
    this._requestRender();
    if (this._cameraCb) this._cameraCb(this.getPose());
  }

  getPose() {
    return {
      projection: this.projection,
      position: plainV(this.camera.position),
      target: plainV(this.target),
      orthoHalfHeight: this.orthoHalfHeight,
    };
  }

  setPose(pose) {
    if (!pose) return;
    if (pose.projection) this.setProjection(pose.projection);
    if (pose.target) this.target.copy(V(pose.target));
    if (pose.orthoHalfHeight) this.orthoHalfHeight = pose.orthoHalfHeight;
    if (pose.position) this.camera.position.copy(V(pose.position));
    this._syncCamera();
    this._requestRender();
  }

  flyTo(pose, ms = 320) {
    if (!pose) return;
    if (pose.projection && pose.projection !== this.projection) this.setProjection(pose.projection);
    if (REDUCED_MOTION() || !ms) { this.setPose(pose); if (this._cameraCb) this._cameraCb(this.getPose()); return; }
    const from = { pos: this.camera.position.clone(), tgt: this.target.clone(), ohh: this.orthoHalfHeight };
    const to = { pos: V(pose.position || this.camera.position), tgt: V(pose.target || this.target), ohh: pose.orthoHalfHeight ?? this.orthoHalfHeight };
    const t0 = (typeof performance !== "undefined" ? performance.now() : 0);
    const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    this._anim = (now) => {
      const t = clamp((now - t0) / ms, 0, 1);
      const e = ease(t);
      this.camera.position.lerpVectors(from.pos, to.pos, e);
      this.target.lerpVectors(from.tgt, to.tgt, e);
      this.orthoHalfHeight = from.ohh + (to.ohh - from.ohh) * e;
      this._syncCamera();
      if (this._cameraCb) this._cameraCb(this.getPose());
      if (t >= 1) this._anim = null;
    };
    this._requestRender();
  }

  onCameraChange(cb) { this._cameraCb = cb; }

  _aspect() {
    const rect = this.canvas.getBoundingClientRect();
    return (rect.width || 1) / (rect.height || 1);
  }

  _syncCamera() {
    const aspect = this._aspect();
    this.persp.aspect = aspect;
    this.persp.updateProjectionMatrix();
    const hh = this.orthoHalfHeight, hw = hh * aspect;
    this.ortho.left = -hw; this.ortho.right = hw;
    this.ortho.top = hh; this.ortho.bottom = -hh;
    this.ortho.updateProjectionMatrix();
    this.camera.lookAt(this.target);
  }

  // ── pointer: orbit / pan / dolly + hover + pick ───────────────────────────
  _installPointer() {
    let mode = "idle", lastX = 0, lastY = 0, downX = 0, downY = 0, spaceHeld = false, moved = false;
    const spherical = new THREE.Spherical();

    // window space-key listeners are stored so dispose() can remove them (the
    // canvas listeners die with the element; window ones would leak).
    this._winKeydown = (e) => { if (e.code === "Space") spaceHeld = true; };
    this._winKeyup = (e) => { if (e.code === "Space") spaceHeld = false; };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this._winKeydown);
      window.addEventListener("keyup", this._winKeyup);
    }

    this.canvas.addEventListener("pointerdown", (e) => {
      if (this._activeDrag) return; // caller-driven drag owns the pointer
      // let the caller claim this press (start a move/wire/resize gesture)
      if (this._pointerDownCb) {
        const claimed = this._pointerDownCb(this.pick(e.clientX, e.clientY),
          { clientX: e.clientX, clientY: e.clientY, altKey: e.altKey, shiftKey: e.shiftKey, button: e.button });
        if (claimed || this._activeDrag) { mode = "idle"; return; }
      }
      this.canvas.setPointerCapture?.(e.pointerId);
      lastX = downX = e.clientX; lastY = downY = e.clientY; moved = false;
      mode = (spaceHeld || e.button === 1) ? "pan" : "orbit";
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (this._activeDrag) return;
      if (mode === "idle") {
        if (this._hoverCb) this._hoverCb(this.pick(e.clientX, e.clientY));
        return;
      }
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 3) moved = true;
      if (mode === "orbit" && this.projection === "persp") {
        const offset = this.camera.position.clone().sub(this.target);
        spherical.setFromVector3(offset);
        spherical.theta -= dx * 0.01;
        spherical.phi = clamp(spherical.phi - dy * 0.01, 0.05, Math.PI - 0.05);
        offset.setFromSpherical(spherical);
        this.camera.position.copy(this.target).add(offset);
        this._syncCamera();
        this._emitCamera();
      } else if (mode === "pan" || (mode === "orbit" && this.projection === "ortho-front")) {
        const scale = (this.projection === "ortho-front" ? this.orthoHalfHeight : this.camera.position.distanceTo(this.target)) / 300;
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
        const shift = right.multiplyScalar(-dx * scale).add(up.multiplyScalar(dy * scale));
        this.camera.position.add(shift);
        this.target.add(shift);
        this._syncCamera();
        this._emitCamera();
      }
    });

    const endPointer = (e) => {
      if (this._activeDrag) return;
      if (mode !== "idle" && !moved && this._pickCb) {
        this._pickCb(this.pick(e.clientX, e.clientY));
      }
      mode = "idle";
    };
    this.canvas.addEventListener("pointerup", endPointer);
    this.canvas.addEventListener("pointercancel", () => { mode = "idle"; });

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = Math.pow(0.95, -e.deltaY * 0.01);
      if (this.projection === "ortho-front") {
        this.orthoHalfHeight = clamp(this.orthoHalfHeight / factor, 0.4, 200);
      } else {
        const offset = this.camera.position.clone().sub(this.target);
        offset.multiplyScalar(1 / factor);
        if (offset.length() > 0.4 && offset.length() < 200) this.camera.position.copy(this.target).add(offset);
      }
      this._syncCamera();
      this._emitCamera();
    }, { passive: false });
  }

  _emitCamera() {
    this._requestRender();
    if (this._cameraCb) this._cameraCb(this.getPose());
  }

  // ── overlay anchoring (§7.3) ──────────────────────────────────────────────
  anchor(id, el, opts = {}) {
    this.anchors.push({ id, el, occlusionFade: opts.occlusionFade !== false });
    el.style.position = "absolute";
    el.style.left = "0"; el.style.top = "0";
    el.style.willChange = "transform";
    this._requestRender();
  }

  unanchor(el) { this.anchors = this.anchors.filter((a) => a.el !== el); }

  _updateAnchors() {
    if (!this.anchors.length) return;
    const rect = this.canvas.getBoundingClientRect();
    for (const a of this.anchors) {
      const rec = this.objects.get(a.id);
      if (!rec) { a.el.style.display = "none"; continue; }
      const world = new THREE.Vector3();
      if (rec.pooled) world.copy(rec.position);
      else rec.group.getWorldPosition(world);
      const ndc = world.clone().project(this.camera);
      const behind = ndc.z > 1 || ndc.z < -1;
      if (behind) { a.el.style.display = "none"; continue; }
      a.el.style.display = "";
      const x = (ndc.x * 0.5 + 0.5) * rect.width;
      const y = (-ndc.y * 0.5 + 0.5) * rect.height;
      a.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      if (a.occlusionFade) a.el.style.opacity = String(clamp(1.4 - Math.max(0, ndc.z) * 1.2, 0.15, 1));
    }
  }

  // ── lifecycle & on-demand render ──────────────────────────────────────────
  setTheme(tokens) {
    this.theme = { ...this.theme, ...tokens };
    this._matCache.clear();
    // rebuild every object against the new palette
    for (const [id, rec] of [...this.objects]) this.upsert(id, rec.spec);
    this.scene.background = new THREE.Color(this.theme.ground);
    this._requestRender();
  }

  resize() {
    const rect = this.host.getBoundingClientRect();
    const w = Math.max(1, rect.width || this.host.clientWidth || 1);
    const h = Math.max(1, rect.height || this.host.clientHeight || 1);
    this.renderer.setSize(w, h, false);
    this._syncCamera();
    this._requestRender();
  }

  _requestRender() {
    if (this._disposed) return;
    this._needsRender = true;
    if (this._raf) return;
    const tick = (now) => {
      this._raf = 0;
      if (this._disposed) return;
      if (this._anim) { this._anim(now || 0); this._needsRender = true; }
      if (this._needsRender) {
        this._needsRender = false;
        this.renderer.render(this.scene, this.camera);
        this._updateAnchors();
      }
      if (this._anim || this._needsRender) this._raf = requestAnimationFrame(tick);
    };
    this._raf = (typeof requestAnimationFrame !== "undefined")
      ? requestAnimationFrame(tick)
      : setTimeout(() => tick(0), 16);
  }

  /** Force a synchronous render (used by screenshot() and tests). */
  renderNow() {
    if (this._disposed) return;
    if (this._anim) this._anim(typeof performance !== "undefined" ? performance.now() : 0);
    this.renderer.render(this.scene, this.camera);
    this._updateAnchors();
    this._needsRender = false;
  }

  screenshot() {
    this.renderNow();
    return this.canvas.toDataURL("image/png");
  }

  /** Render stats for the perf budget (flow3d-design §7.2 / acceptance 7):
      draw calls + triangles of one frame, object and pool counts. Plain JSON. */
  stats() {
    this.renderNow();
    const r = this.renderer.info.render;
    return {
      calls: r.calls, triangles: r.triangles,
      objects: this.objects.size,
      pooledSockets: this.socketPool?.mesh.count ?? 0,
      pooledWires: this.wirePool?.count ?? 0,
      pooledBodies: [...(this.bodyPools?.values() ?? [])].reduce((n, p) => n + p.count, 0),
      pooledEdges: [...(this.edgePools?.values() ?? [])].reduce((n, p) => n + p.count, 0),
    };
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this._winKeydown);
      window.removeEventListener("keyup", this._winKeyup);
      if (this._activeDrag) {
        window.removeEventListener("pointermove", this._activeDrag.onMove);
        window.removeEventListener("pointerup", this._activeDrag.onUp);
        this._activeDrag = null;
      }
    }
    for (const id of [...this.objects.keys()]) this.remove(id);
    this.socketPool?.dispose();
    for (const p of this.bodyPools?.values() ?? []) p.dispose();
    for (const p of this.edgePools?.values() ?? []) p.dispose();
    this.wirePool?.dispose();
    for (const g of this._geomCache.values()) g.dispose?.();
    for (const m of this._matCache.values()) m.dispose?.();
    this.renderer.dispose();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}

// ── instanced pools (flow3d-design §7.2) ─────────────────────────────────────
// The kind vocabulary exists so the wrapper can pool invisibly: callers keep
// speaking ids + specs; numerous identical kinds render as ONE draw call each.
// Every top-level `socket` is an instance of one unit sphere (per-instance
// matrix = position+radius, per-instance colour = wired state / emphasis), and
// every top-level default-material `tube` owns a fixed vertex range of one
// merged mesh, so an 800-wire case is one draw call and a wire update rewrites
// only its range. Both mechanisms now live in the SHARED core, ./pools.js
// (InstancePool / TubePool) — extracted so scenestage batches identically.

// The closed kind vocabulary and material tokens, exported for callers/tests
// (data only — no THREE types).
export const KINDS = [
  "box", "spine-box", "capsule", "wedge-capsule", "cylinder", "glass-box",
  "ghost-box", "rail", "socket", "ring", "tube", "helix", "flag",
  "jump-pipe", "grid", "outline", "token",
];
export const MATERIALS = [
  "paper", "graphite", "glass", "ghost", "accent", "ink", "wire",
  "hue:html", "hue:css", "hue:js", "hue:data", "hue:3d", "hue:cmd",
  "state:good", "state:danger", "state:sky", "state:ink",
];
