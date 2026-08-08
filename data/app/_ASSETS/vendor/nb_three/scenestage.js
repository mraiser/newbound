// scenestage.js — the scene facet's renderer wrapper (scene-facet-design
// Part IV), a sibling of the flow editor's stage.js on the same bundled
// THREE. Callers speak ids, plain-JSON specs (from assets/sceneproject.js),
// and DOM-flavored callbacks; no THREE type crosses this line in either
// direction. THREE imports live ONLY in vendor/nb_three/ (boundary rule,
// amended from flow3d acceptance 5 — grep-checkable both ways).
//
// Materials arrive RESOLVED ({color, opacity?, flat?, emissive?} — the token
// table lives in assets/scenetokens.js); `text` kinds render as DOM-anchored
// labels; rendering is ON-DEMAND (a frame on scene/camera/drag change; the
// runtime drives animation frames itself via applyDelta + requestRender).
//
// POOLED since R-4 (the scenestage convergence, docs/great-refactoring.md
// D6): mesh-kind nodes (box/sphere/ico/cylinder/cone/plane) draw from shared
// InstancePools — one pool per (geometry kind, material flags, affordance),
// colour per instance — and links draw from ONE merged LineSegments per
// opacity. Every node keeps its THREE.Group as a TRANSFORM HOLDER (the
// parent hierarchy, deltas, and drags are untouched); a per-rendered-frame
// sweep writes each pooled node's WORLD matrix (group.matrixWorld × its
// unit-geometry base scale) into its pool — rotation and parenting ride the
// matrix, which is what the flow port's perf gate needed. Pools are
// invisible to callers: picking resolves instanceId → id, emphasis computes
// the instance's world box, "affordant" mode intersects only affordant
// pools so decorative geometry still never swallows a tap.

import * as THREE from "./three.module.js";
import { InstancePool, LinePool, TubePool } from "./pools.js";

const TAP_SLOP = 5;

export function mountScene(host, opts = {}) {
  return new SceneStage(host, opts);
}

class SceneStage {
  constructor(host, opts) {
    this.host = host;
    this.opts = opts;
    this.pickMode = opts.pickMode || "affordant";  // "affordant" | "all"
    this.showSlots = !!opts.showSlots;
    this.objects = new Map();     // id -> {spec, group, mesh, label, light, target}
    this._pools = new Map();      // poolKey -> InstancePool (mesh-kind nodes)
    this._linkPools = new Map();  // opacityKey -> LinePool (straight links)
    this._linkTubePools = new Map(); // opacityKey -> TubePool (curve:"hang" links)
    this._unitGeoms = new Map();  // geometry key -> shared unit geometry
    this._emphId = null;
    this._matCache = new Map();
    this._envLights = [];
    this._grid = null;
    this._emph = null;
    this._raf = 0;
    this._needs = false;
    this._disposed = false;
    this._drag = null;
    this._down = null;
    this._hover = null;
    this._anchored = new Map();   // DOM el -> object id (anchorEl / unanchorEl)
    this._fly = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2));
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.touchAction = "none";
    host.style.position = host.style.position || "relative";
    host.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.persp = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
    this.ortho = new THREE.OrthographicCamera(-5, 5, 5, -5, -100, 400);
    this.camera = this.persp;
    this.cameraMode = "persp";
    this.orbit = { theta: 0.6, phi: 1.05, dist: 7, target: new THREE.Vector3(0, 0.6, 0) };
    this._applyOrbit();

    this._sweepM = new THREE.Matrix4();
    this._sweepS = new THREE.Matrix4();
    this.raycaster = new THREE.Raycaster();
    this._installPointer();
    this._ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => this.resize()) : null;
    if (this._ro) this._ro.observe(host);
    this.resize();
  }

  // ── scene building ────────────────────────────────────────────────────────

  setScene(specs, env = {}) {
    for (const o of this.objects.values()) this._destroyObject(o);
    this.objects.clear();
    this._setEnv(env);
    for (const spec of specs) this._createObject(spec);
    for (const spec of specs) this._attach(spec.id);
    this._requestRender();
  }

  _setEnv(env) {
    for (const l of this._envLights) this.scene.remove(l);
    this._envLights = [];
    if ((env.lights || "default") === "default") {
      const hemi = new THREE.HemisphereLight(0xfff4e2, 0x20262c, 1.05);
      const key = new THREE.DirectionalLight(0xffffff, 0.55);
      key.position.set(3, 8, 6);
      this.scene.add(hemi, key);
      this._envLights.push(hemi, key);
    }
    if (this._grid) { this.scene.remove(this._grid); this._grid = null; }
    if (env.grid !== false) {
      this._grid = new THREE.GridHelper(10, 20, 0x4a5563, 0x323a44);
      this._grid.material.transparent = true;
      this._grid.material.opacity = 0.5;
      this.scene.add(this._grid);
    }
    if (env.camera && env.camera.home) {
      const h = env.camera.home;
      if (h.look) this.orbit.target.set(h.look.x ?? 0, h.look.y ?? 0, h.look.z ?? 0);
      if (h.pos) {
        const p = new THREE.Vector3(h.pos.x ?? 0, h.pos.y ?? 0, h.pos.z ?? 6).sub(this.orbit.target);
        this.orbit.dist = Math.max(0.5, p.length());
        this.orbit.theta = Math.atan2(p.x, p.z);
        this.orbit.phi = Math.acos(Math.max(-1, Math.min(1, p.y / this.orbit.dist)));
      }
      this._applyOrbit();
    }
  }

  _material(m) {
    const spec = m || { color: "#9aa1a9", flat: true };
    const key = JSON.stringify(spec);
    if (this._matCache.has(key)) return this._matCache.get(key);
    let mat;
    if (spec.emissive) {
      mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(spec.color) });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(spec.color),
        roughness: 0.82, metalness: 0.06,
        flatShading: !!spec.flat,
      });
    }
    if (typeof spec.opacity === "number" && spec.opacity < 1) {
      mat.transparent = true;
      mat.opacity = spec.opacity;
    }
    this._matCache.set(key, mat);
    return mat;
  }

  /** Material flags WITHOUT color — color is per-instance; everything else
      is material-level and therefore part of the pool key. */
  _matKeyOf(m) {
    const spec = m || {};
    return `${spec.emissive ? "e" : "s"}|${spec.flat ? "f" : "-"}|${
      typeof spec.opacity === "number" && spec.opacity < 1 ? spec.opacity : 1}`;
  }

  _poolSpecOf(spec) {
    const k = spec.kind;
    if (!["box", "sphere", "ico", "cylinder", "cone", "plane"].includes(k)) return null;
    const detail = k === "ico" ? Math.max(0, Math.round(spec.params?.detail ?? 1)) : 0;
    const a = spec.affordances;
    const affordant = !!(a && (a.tap || a.drag || a.hover));
    const geomKey = k === "ico" ? `ico${detail}` : k;
    return { geomKey, detail,
      key: `${geomKey}|${this._matKeyOf(spec.material)}|${affordant ? "a" : "d"}`,
      affordant };
  }

  _unitGeometry(geomKey, detail) {
    if (this._unitGeoms.has(geomKey)) return this._unitGeoms.get(geomKey);
    let g;
    switch (geomKey.replace(/\d+$/, "")) {
      case "box": g = new THREE.BoxGeometry(1, 1, 1); break;
      case "sphere": g = new THREE.SphereGeometry(1, 24, 16); break;
      case "ico": g = new THREE.IcosahedronGeometry(1, detail); break;
      case "cylinder": g = new THREE.CylinderGeometry(1, 1, 1, 24); break;
      case "cone": g = new THREE.ConeGeometry(1, 1, 24); break;
      case "plane": g = new THREE.PlaneGeometry(1, 1); break;
    }
    g.computeBoundingBox();
    this._unitGeoms.set(geomKey, g);
    return g;
  }

  /** The unit geometry's per-node scale — geometry params become the
      instance transform, which is what makes one geometry serve them all. */
  _baseScaleFor(spec) {
    const p = spec.params || {};
    switch (spec.kind) {
      case "box": { const s = p.size || {}; return { x: s.x ?? 1, y: s.y ?? 1, z: s.z ?? 1 }; }
      case "sphere": case "ico": { const r = p.radius ?? 0.5; return { x: r, y: r, z: r }; }
      case "cylinder": case "cone": {
        const r = p.radius ?? 0.5; return { x: r, y: p.height ?? 1, z: r }; }
      case "plane": return { x: p.w ?? 1, y: p.h ?? 1, z: 1 };
      default: return { x: 1, y: 1, z: 1 };
    }
  }

  _poolFor(spec) {
    const ps = this._poolSpecOf(spec);
    if (!ps) return null;
    let pool = this._pools.get(ps.key);
    if (!pool) {
      const m = spec.material || {};
      let mat;
      if (m.emissive) mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      else mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.82, metalness: 0.06, flatShading: !!m.flat });
      if (typeof m.opacity === "number" && m.opacity < 1) {
        mat.transparent = true; mat.opacity = m.opacity;
      }
      if (spec.kind === "plane") mat.side = THREE.DoubleSide;
      pool = new InstancePool(this.scene, {
        geometry: this._unitGeometry(ps.geomKey, ps.detail), material: mat,
        capacity: 64, poolKind: "scene" });
      pool.mesh.userData.scenePool = pool;
      pool.mesh.userData.affordant = ps.affordant;
      this._pools.set(ps.key, pool);
    }
    return { pool, ps };
  }

  /** The flow wire's vertical-tangent cubic (flow3d-design §3.2) — kept in
      LOCKSTEP with stage.js `_curveVertical` and flowproject.wireCurvePoint
      (a check holds all three together). */
  _hangCurve(from, to) {
    const a = new THREE.Vector3(from.x, from.y, from.z);
    const b = new THREE.Vector3(to.x, to.y, to.z);
    const t = Math.max(0.5, Math.min(2, 0.4 * a.distanceTo(b)));
    return new THREE.CubicBezierCurve3(
      a, a.clone().add(new THREE.Vector3(0, -t, 0)),
      b.clone().add(new THREE.Vector3(0, t, 0)), b);
  }

  _linkTubePoolFor(m) {
    const spec = m || {};
    const op = typeof spec.opacity === "number" && spec.opacity < 1 ? spec.opacity : 1;
    let pool = this._linkTubePools.get(op);
    if (!pool) {
      pool = new TubePool(this.scene, {
        curve: (from, to) => this._hangCurve(from, to),
        seg: 16, rad: 6, capacity: 64, opacity: op, poolKind: "scenelinktube" });
      pool.mesh.userData.sceneTubePool = pool;
      this._linkTubePools.set(op, pool);
    }
    return pool;
  }

  /** A point on a hang-curved link's spline at t ∈ [0,1] — run tokens ride
      exactly the rendered tube (the 3D-5 contract, now on the scene stack). */
  linkCurvePoint(id, t) {
    const o = this.objects.get(id);
    if (!o || !o.linkEnds) return null;
    const p = this._hangCurve(o.linkEnds.a, o.linkEnds.b).getPoint(t);
    return { x: p.x, y: p.y, z: p.z };
  }

  _linkPoolFor(m) {
    const spec = m || {};
    const op = typeof spec.opacity === "number" && spec.opacity < 1 ? spec.opacity : 1;
    let pool = this._linkPools.get(op);
    if (!pool) {
      pool = new LinePool(this.scene, {
        template: Float32Array.from([0, 0, 0, 1, 1, 1]),
        capacity: 64, poolKind: "scenelink" });
      if (op < 1) { pool.mesh.material.transparent = true; pool.mesh.material.opacity = op; }
      this._linkPools.set(op, pool);
    }
    return pool;
  }

  _geometry(spec) {
    const p = spec.params || {};
    switch (spec.kind) {
      case "box": { const s = p.size || {}; return new THREE.BoxGeometry(s.x ?? 1, s.y ?? 1, s.z ?? 1); }
      case "sphere": return new THREE.SphereGeometry(p.radius ?? 0.5, 24, 16);
      case "ico": return new THREE.IcosahedronGeometry(p.radius ?? 0.5, Math.max(0, Math.round(p.detail ?? 1)));
      case "cylinder": return new THREE.CylinderGeometry(p.radius ?? 0.5, p.radius ?? 0.5, p.height ?? 1, 24);
      case "cone": return new THREE.ConeGeometry(p.radius ?? 0.5, p.height ?? 1, 24);
      case "plane": return new THREE.PlaneGeometry(p.w ?? 1, p.h ?? 1);
      default: return null;
    }
  }

  _createObject(spec) {
    if (spec.kind === "link") {
      // a world-space connector: endpoints re-resolved every rendered frame
      // (design §2.2 — links track, they are not placed). Pooled: straight
      // links are one merged LineSegments per opacity (a link is one
      // segment, pos=A scale=B−A); curve:"hang" links are one merged
      // TubePool per opacity riding the flow wire's vertical-tangent cubic
      // (the state-shaped flow port's wires — R-4).
      const m = spec.material || { color: "#7d8aa0" };
      const hex = new THREE.Color(m.color).getHex();
      if (spec.curve === "hang") {
        const pool = this._linkTubePoolFor(m);
        pool.add(spec.id, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0, hex);
        this.objects.set(spec.id, { spec: { ...spec }, group: null, mesh: null,
          label: null, light: null, linkTube: pool, linkEnds: null });
        return;
      }
      const pool = this._linkPoolFor(m);
      pool.add(spec.id, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, hex);
      this.objects.set(spec.id, { spec: { ...spec }, group: null, mesh: null,
        label: null, light: null, linkPool: pool });
      return;
    }
    const group = new THREE.Group();
    group.position.set(spec.pos?.x ?? 0, spec.pos?.y ?? 0, spec.pos?.z ?? 0);
    group.rotation.set(spec.rot?.x ?? 0, spec.rot?.y ?? 0, spec.rot?.z ?? 0);
    group.scale.set(spec.scale?.x ?? 1, spec.scale?.y ?? 1, spec.scale?.z ?? 1);
    group.visible = spec.visible !== false;
    const o = { spec: { ...spec }, group, mesh: null, label: null, light: null };

    const pooled = this._poolFor(spec);
    if (pooled) {
      // the group is a TRANSFORM HOLDER — the render sweep writes this
      // node's world matrix (× base scale) into its pool slot
      pooled.pool.add(spec.id, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 },
        new THREE.Color((spec.material || {}).color || "#9aa1a9").getHex());
      pooled.pool.setVisible(spec.id, false);   // until the first sweep places it
      o.pooled = { pool: pooled.pool, key: pooled.ps.key,
        baseScale: this._baseScaleFor(spec) };
      this.objects.set(spec.id, o);
      return;
    }
    const geom = this._geometry(spec);
    if (geom) {
      const mat = this._material(spec.material);
      if (spec.kind === "plane") mat.side = THREE.DoubleSide;
      o.mesh = new THREE.Mesh(geom, mat);
      o.mesh.userData.sid = spec.id;
      group.add(o.mesh);
    } else if (spec.kind === "light") {
      const L = spec.light || {};
      if (L.mode === "directional") {
        o.light = new THREE.DirectionalLight(0xffffff, L.intensity ?? 1);
        const d = L.dir || { x: 0, y: -1, z: 0 };
        o.target = new THREE.Object3D();
        o.target.position.set(d.x, d.y, d.z);
        group.add(o.target);
        o.light.target = o.target;
      } else if (L.mode === "point") {
        o.light = new THREE.PointLight(0xffffff, L.intensity ?? 1, 0, 1.8);
      } else {
        o.light = new THREE.AmbientLight(0xffffff, L.intensity ?? 1);
      }
      group.add(o.light);
    } else if (spec.kind === "slot" || spec.kind === "mountpoint") {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(spec.kind === "slot" ? 0.12 : 0.16, 0.018, 8, 24),
        this._material({ color: spec.kind === "slot" ? "#62BD8C" : "#a78bda", emissive: true }));
      ring.rotation.x = Math.PI / 2;
      ring.userData.sid = spec.id;
      ring.visible = this.showSlots;
      ring.userData.gizmo = true;
      group.add(ring);
      o.mesh = ring;
    } else if (spec.kind === "text") {
      const el = document.createElement("div");
      el.className = this.opts.labelClass || "ss-label";
      el.textContent = spec.text?.text ?? "";
      el.style.position = "absolute";
      el.style.transform = "translate(-50%, -100%)";
      el.style.fontSize = `${Math.max(9, 13 * (spec.text?.size ?? 1))}px`;
      // A label is DOM sitting on top of the canvas, so it eats any click
      // that lands on it. That is only acceptable when the label's own node
      // is interactive; a decorative caption must be transparent to the
      // pointer, or it silently swallows taps meant for whatever is behind
      // it. Same rule _pick already applies to decorative geometry in
      // `affordant` mode — the ray passes through to the interactive thing.
      // It bites hardest at scale: one label over a sparse scene is a near
      // miss, a hundred of them tile the view and the scene stops
      // responding to the pointer at all.
      const tappable = this.pickMode === "all" ||
        !!(spec.affordances && (spec.affordances.tap || spec.affordances.hover));
      el.style.pointerEvents = tappable ? "auto" : "none";
      if (tappable) el.addEventListener("click", (e) => {
        e.stopPropagation();
        this._emitTap(spec.id);
      });
      this.host.appendChild(el);
      o.label = el;
    }
    this.objects.set(spec.id, o);
  }

  _attach(id) {
    const o = this.objects.get(id);
    if (!o || !o.group) return; // links live in their pool, not the graph
    const parent = o.spec.parent ? this.objects.get(o.spec.parent) : null;
    (parent ? parent.group : this.scene).add(o.group);
  }

  _destroyObject(o) {
    if (o.label) o.label.remove();
    if (o.linkTube) { o.linkTube.remove(o.spec.id); return; }
    if (o.linkPool) { o.linkPool.remove(o.spec.id); return; }
    if (o.pooled) {
      o.pooled.pool.remove(o.spec.id);
      if (o.group.parent) o.group.parent.remove(o.group);
      return;
    }
    if (o.group.parent) o.group.parent.remove(o.group);
    o.group.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
  }

  /** Create-or-replace one object after setScene — the runtime's collection
      churn (design §2.8a). The parent must already exist. */
  upsert(spec) {
    const old = this.objects.get(spec.id);
    if (old) { this._destroyObject(old); this.objects.delete(spec.id); }
    this._createObject(spec);
    this._attach(spec.id);
    this._requestRender();
  }

  removeObject(id) {
    const o = this.objects.get(id);
    if (!o) return;
    if (this._emph) this.emphasize(null);
    this._destroyObject(o);
    this.objects.delete(id);
    this._requestRender();
  }

  // ── deltas (the runtime's hot path — minimal, no rebuilds) ────────────────

  applyDelta(id, path, value) {
    const o = this.objects.get(id);
    if (!o) return;
    if (o.linkPool || o.linkTube) {
      if (path === "from" || path === "to") o.spec[path] = value;
      else if (path === "visible") { o.spec.visible = value; }
      else if (path === "material") {
        const pool = o.linkTube || o.linkPool;
        const samePool = (o.linkTube ? this._linkTubePoolFor(value) : this._linkPoolFor(value)) === pool;
        o.spec.material = value;
        if (samePool) pool.setColor(id, new THREE.Color(value.color).getHex());
        else { this._destroyObject(o); this.objects.delete(id); this._createObject(o.spec); }
      }
      this._requestRender();
      return;
    }
    const m = /^(pos|rot|scale)\.([xyz])$/.exec(path);
    if (m) {
      const t = m[1] === "pos" ? o.group.position : m[1] === "rot" ? o.group.rotation : o.group.scale;
      t[m[2]] = value;
      o.spec[m[1]] = { ...o.spec[m[1]], [m[2]]: value };
    } else if (path === "visible") {
      o.group.visible = value !== false;
      o.spec.visible = value;
    } else if (path === "material") {
      const prevKey = o.pooled ? o.pooled.key : null;
      o.spec.material = value;
      if (o.pooled) {
        // colour rides the instance; any other material change is a repool
        const next = this._poolSpecOf(o.spec);
        if (next && next.key === prevKey) {
          o.pooled.pool.setColor(id, new THREE.Color((value || {}).color || "#9aa1a9").getHex());
        } else {
          this._repool(o);
        }
      } else if (o.mesh && !o.mesh.userData.gizmo) {
        const mat = this._material(value);
        if (o.spec.kind === "plane") mat.side = THREE.DoubleSide;
        o.mesh.material = mat;
      }
    } else if (path.startsWith("params.")) {
      const dotted = path.slice("params.".length);
      const dot = dotted.indexOf(".");
      if (!o.spec.params) o.spec.params = {};
      if (dot >= 0) {
        const head = dotted.slice(0, dot), tail = dotted.slice(dot + 1);
        o.spec.params[head] = { ...(o.spec.params[head] || {}), [tail]: value };
      } else o.spec.params[dotted] = value;
      if (o.pooled) {
        // params are the instance transform for pooled kinds — except an ico
        // detail change, which is a different unit geometry (repool)
        const next = this._poolSpecOf(o.spec);
        if (next && next.key === o.pooled.key) o.pooled.baseScale = this._baseScaleFor(o.spec);
        else this._repool(o);
      } else if (o.mesh) {
        const geom = this._geometry(o.spec);
        if (geom) { o.mesh.geometry.dispose(); o.mesh.geometry = geom; }
      }
    } else if (path === "text") {
      if (o.label) o.label.textContent = String(value);
      o.spec.text = { ...(o.spec.text || {}), text: value };
    } else if (path === "size") {
      if (o.label) o.label.style.fontSize = `${Math.max(9, 13 * Number(value || 1))}px`;
      o.spec.text = { ...(o.spec.text || {}), size: value };
    } else if (path === "light.intensity") {
      if (o.light) o.light.intensity = Number(value);
    }
    this._requestRender();
  }

  /** A pooled node whose pool key changed (material flags, affordances, ico
      detail): out of the old pool, into the right one. The group — and with
      it the node's transform, children, and parent — stays put. */
  _repool(o) {
    const id = o.spec.id;
    o.pooled.pool.remove(id);
    const pooled = this._poolFor(o.spec);
    if (pooled) {
      pooled.pool.add(id, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 },
        new THREE.Color((o.spec.material || {}).color || "#9aa1a9").getHex());
      pooled.pool.setVisible(id, false);
      o.pooled = { pool: pooled.pool, key: pooled.ps.key, baseScale: this._baseScaleFor(o.spec) };
    } else {
      // no longer poolable — rebuild as an individual object
      delete o.pooled;
      this._destroyObject(o); this.objects.delete(id);
      this._createObject(o.spec); this._attach(id);
    }
  }

  setPickMode(mode) { this.pickMode = mode; }
  setShowSlots(on) {
    this.showSlots = !!on;
    for (const o of this.objects.values()) {
      if (o.mesh && o.mesh.userData.gizmo) o.mesh.visible = this.showSlots;
    }
    this._requestRender();
  }

  /** Selection outline: a box helper around the object. Links have no group
      of their own — emphasis is a no-op for them. A pooled node's box is its
      instance's world box, recomputed by the sweep while emphasized. */
  emphasize(id) {
    if (this._emph) { this.scene.remove(this._emph); this._emph = null; }
    this._emphId = null;
    if (id && this.objects.has(id)) {
      const o = this.objects.get(id);
      if (o.pooled) {
        this._emphId = id;
        this._emph = new THREE.Box3Helper(new THREE.Box3(), 0x62bd8c);
        this.scene.add(this._emph);
      } else if (o.group) {
        this._emph = new THREE.BoxHelper(o.group, 0x62bd8c);
        this.scene.add(this._emph);
      }
    }
    this._requestRender();
  }

  _pooledWorldMatrix(o, out) {
    out.copy(o.group.matrixWorld);
    const b = o.pooled.baseScale;
    return out.multiply(this._sweepS.makeScale(b.x, b.y, b.z));
  }

  _worldVisible(o) {
    if (o.spec.visible === false) return false;
    let g = o.group;
    while (g) { if (g.visible === false) return false; g = g.parent; }
    return true;
  }

  /** The per-rendered-frame pooled sweep: every pooled node's world matrix
      (group.matrixWorld × unit base scale) lands in its pool slot. Rendering
      is on-demand, so this runs exactly when something changed; at scene
      sizes (≤ thousands) the sweep is microseconds and one buffer upload. */
  _sweepPooled() {
    this.scene.updateMatrixWorld(true);
    for (const o of this.objects.values()) {
      if (!o.pooled) continue;
      if (!this._worldVisible(o)) { o.pooled.pool.setVisible(o.spec.id, false); continue; }
      this._pooledWorldMatrix(o, this._sweepM);
      o.pooled.pool.setMatrix(o.spec.id, this._sweepM.elements);
    }
    if (this._emphId) {
      const o = this.objects.get(this._emphId);
      if (o && o.pooled && this._emph) {
        this._pooledWorldMatrix(o, this._sweepM);
        this._emph.box.copy(o.pooled.pool.geom.boundingBox).applyMatrix4(this._sweepM);
      }
    }
  }

  // ── camera ────────────────────────────────────────────────────────────────

  _applyOrbit() {
    const { theta, phi, dist, target } = this.orbit;
    if (this.cameraMode === "front") {
      // look down −Z, y up — the 2D picture (stage.js's ortho-front, §2.7)
      const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
      const halfH = dist * Math.tan((40 * Math.PI) / 360);   // persp-fov match
      const halfW = halfH * (w / h);
      this.ortho.left = -halfW; this.ortho.right = halfW;
      this.ortho.top = halfH; this.ortho.bottom = -halfH;
      this.ortho.position.set(target.x, target.y, target.z + Math.max(dist, 1));
      this.ortho.lookAt(target);
      this.ortho.updateProjectionMatrix();
      if (this._camCb) this._camCb();
      return;
    }
    const sp = Math.sin(phi), cp = Math.cos(phi);
    this.camera.position.set(
      target.x + dist * sp * Math.sin(theta),
      target.y + dist * cp,
      target.z + dist * sp * Math.cos(theta));
    this.camera.lookAt(target);
    if (this._camCb) this._camCb();
  }

  /** "persp" (the orbit) or "front" — an orthographic look down −Z: the 2D
      experience, and the flow port's front-ortho parity mode (key 2). */
  setCameraMode(mode) {
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    this.camera = mode === "front" ? this.ortho : this.persp;
    this._applyOrbit();
    this._requestRender();
  }

  /** Screen anchor for a world point — DOM-anchored tags and popovers
      (returns css px in the host's frame + a behind-camera flag). */
  anchor(pos) {
    const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * (this.canvas.clientWidth || 1),
             y: (-v.y * 0.5 + 0.5) * (this.canvas.clientHeight || 1),
             visible: v.z < 1 };
  }

  onCameraChange(cb) { this._camCb = cb; }

  getPose() {
    const t = this.orbit.target;
    return { target: { x: t.x, y: t.y, z: t.z }, dist: this.orbit.dist,
      theta: this.orbit.theta, phi: this.orbit.phi,
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z } };
  }

  /** Animate the orbit to {target?, dist?, theta?, phi?} over ms (0 = jump). */
  flyTo(to, ms = 300) {
    if (this._fly) { cancelAnimationFrame(this._fly); this._fly = 0; }
    const from = this.getPose();
    const dst = {
      target: { ...from.target, ...(to.target || {}) },
      dist: to.dist ?? from.dist, theta: to.theta ?? from.theta, phi: to.phi ?? from.phi,
    };
    const apply = (k) => {
      const u = 1 - k;
      this.orbit.target.set(
        from.target.x * u + dst.target.x * k,
        from.target.y * u + dst.target.y * k,
        from.target.z * u + dst.target.z * k);
      this.orbit.dist = from.dist * u + dst.dist * k;
      this.orbit.theta = from.theta * u + dst.theta * k;
      this.orbit.phi = from.phi * u + dst.phi * k;
      this._applyOrbit();
      this._requestRender();
    };
    if (!ms) { apply(1); return; }
    const t0 = performance.now();
    const step = () => {
      const u = Math.min(1, (performance.now() - t0) / ms);
      apply(u * (2 - u));   // ease-out
      this._fly = u < 1 ? requestAnimationFrame(step) : 0;
    };
    this._fly = requestAnimationFrame(step);
  }

  /** Track a host DOM element to an object's world origin — placed with the
      text labels on every rendered frame (editor labels, popovers). The
      element is CENTERED on the projected point (the stage.js convention its
      consumers' CSS already builds on). */
  anchorEl(id, el) {
    el.style.position = "absolute";
    el.style.left = "0"; el.style.top = "0";
    el.style.willChange = "transform";
    this._anchored.set(el, id);
    this._requestRender();
  }
  unanchorEl(el) { this._anchored.delete(el); }

  frameAll() {
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    let any = false;
    this.scene.updateMatrixWorld(true);
    for (const o of this.objects.values()) {
      if (o.pooled && this._worldVisible(o)) {
        this._pooledWorldMatrix(o, this._sweepM);
        tmp.copy(o.pooled.pool.geom.boundingBox).applyMatrix4(this._sweepM);
        box.union(tmp); any = true;
      } else if (o.mesh && !o.mesh.userData.gizmo && o.group.visible) {
        box.expandByObject(o.group); any = true;
      }
    }
    if (!any) return;
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    this.orbit.target.copy(c);
    this.orbit.dist = Math.max(2, size * 1.4);
    this._applyOrbit();
    this._requestRender();
  }

  // ── pointer ───────────────────────────────────────────────────────────────

  _installPointer() {
    const c = this.canvas;
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("pointerdown", (e) => this._onDown(e));
    c.addEventListener("pointermove", (e) => this._onMove(e));
    c.addEventListener("pointerup", (e) => this._onUp(e));
    c.addEventListener("pointercancel", (e) => this._onUp(e));
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.orbit.dist = Math.max(0.5, Math.min(80, this.orbit.dist * (e.deltaY > 0 ? 1.1 : 0.9)));
      this._applyOrbit();
      this._requestRender();
    }, { passive: false });
  }

  _ndc(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
  }

  _pick(e) {
    const ndc = this._ndc(e);
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = [];
    for (const o of this.objects.values()) {
      if (!o.mesh || !o.group || !o.group.visible) continue;
      if (o.mesh.userData.gizmo && !this.showSlots) continue;
      // affordant mode: decorative geometry never intercepts the pointer —
      // the ray passes through to the interactive thing behind it (the peer
      // case: a glass selection halo enclosing a tappable orb)
      if (this.pickMode === "affordant") {
        const a = o.spec.affordances;
        if (!a || !(a.tap || a.drag || a.hover)) continue;
      }
      meshes.push(o.mesh);
    }
    // pools: the affordance split is a pool-key dimension, so affordant mode
    // intersects only affordant pools — hidden instances are zero-scale and
    // can't be hit
    for (const pool of this._pools.values()) {
      if (this.pickMode === "affordant" && !pool.mesh.userData.affordant) continue;
      meshes.push(pool.mesh);
    }
    // hang-tube links are pickable when their spec declares affordances (the
    // flow editor's wires); decorative links stay transparent to the ray
    for (const pool of this._linkTubePools.values()) meshes.push(pool.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    for (const h of hits) {
      const tube = h.object.userData.sceneTubePool;
      if (tube) {
        const sid = tube.idAtFace(h.faceIndex);
        if (sid === undefined || sid === null) continue;
        if (this.pickMode === "affordant") {
          const a = this.objects.get(sid)?.spec.affordances;
          if (!a || !(a.tap || a.hover || a.drag)) continue;
        }
        return sid;
      }
      const pool = h.object.userData.scenePool;
      const sid = pool ? pool.idAt(h.instanceId) : h.object.userData.sid;
      if (sid !== undefined && sid !== null) return sid;
    }
    return null;
  }

  /** The id under viewport client coords, or null (same rules as a tap). */
  pickAt(clientX, clientY) { return this._pick({ clientX, clientY }); }

  /** Intersect the pick ray with an arbitrary world plane {point, normal}. */
  screenToPlane(clientX, clientY, plane) {
    this.raycaster.setFromCamera(this._ndc({ clientX, clientY }), this.camera);
    const n = new THREE.Vector3(plane.normal.x, plane.normal.y, plane.normal.z);
    const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(
      n, new THREE.Vector3(plane.point.x, plane.point.y, plane.point.z));
    const pt = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(pl, pt) ? { x: pt.x, y: pt.y, z: pt.z } : null;
  }

  _dragPlaneFor(id, alt) {
    const o = this.objects.get(id);
    if (!o || !o.group) return null;
    const aff = o.spec.affordances || {};
    let plane = "xz";
    if (this.pickMode === "affordant") {
      if (!aff.drag) return null;
      plane = alt ? aff.drag.altPlane : (aff.drag.plane || "xz");
      if (!plane) return null;
    } else if (alt) {
      // "all" mode: alt still orbits unless the spec opts into an altPlane
      plane = aff.drag && aff.drag.altPlane;
      if (!plane) return null;
    }
    const world = new THREE.Vector3();
    o.group.getWorldPosition(world);
    const normal = plane === "xy" ? new THREE.Vector3(0, 0, 1)
      : plane === "yz" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    return { plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, world), name: plane };
  }

  _planePoint(e, plane) {
    this.raycaster.setFromCamera(this._ndc(e), this.camera);
    const pt = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, pt) ? pt : null;
  }

  _onDown(e) {
    if (e.button === 2) {
      this._down = { kind: "orbit", x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    if (e.altKey) {
      // alt+drag orbits — unless it lands on a node whose drag affordance
      // declares an altPlane (the flow editor's depth-move / terminal-slide)
      const id = this._pick(e);
      const draggable = id ? this._dragPlaneFor(id, true) : null;
      this.canvas.setPointerCapture(e.pointerId);
      this._down = draggable
        ? { kind: "node", id, x: e.clientX, y: e.clientY, draggable, moved: false, alt: true }
        : { kind: "orbit", x: e.clientX, y: e.clientY };
      return;
    }
    const id = this._pick(e);
    this.canvas.setPointerCapture(e.pointerId);
    if (id) {
      const draggable = this._dragPlaneFor(id, false);
      this._down = { kind: "node", id, x: e.clientX, y: e.clientY, draggable, moved: false, alt: false };
    } else {
      this._down = { kind: e.shiftKey ? "pan" : "orbit", x: e.clientX, y: e.clientY };
    }
  }

  _onMove(e) {
    // A pointerup we never saw would leave _down set forever, and a stuck
    // _down silently kills hover and turns the next move into a phantom
    // drag. Pointer capture covers the common case (a release outside the
    // canvas), but not every path — a cancelled gesture or a capture lost
    // to another element can still swallow the up. The button state is the
    // truth: no buttons down, no gesture in progress.
    if (this._down && e.buttons === 0) this._down = null;
    if (!this._down) {
      const id = this._pick(e);
      if (id !== this._hover) {
        this._hover = id;
        if (this.opts.onHover) {
          const o = id ? this.objects.get(id) : null;
          const ok = !o || this.pickMode === "all" || (o.spec.affordances && (o.spec.affordances.hover || o.spec.affordances.tap || o.spec.affordances.drag));
          this.opts.onHover(ok ? id : null);
        }
      }
      return;
    }
    const d = this._down;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.kind === "orbit") {
      if (this.cameraMode === "front") {   // the 2D picture doesn't rotate — pan instead
        const scale = this.orbit.dist * 0.0016;
        this.orbit.target.x -= dx * scale;
        this.orbit.target.y += dy * scale;
        d.x = e.clientX; d.y = e.clientY;
        this._applyOrbit();
        this._requestRender();
        return;
      }
      this.orbit.theta -= dx * 0.008;
      this.orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.orbit.phi - dy * 0.006));
      d.x = e.clientX; d.y = e.clientY;
      this._applyOrbit();
      this._requestRender();
    } else if (d.kind === "pan") {
      const scale = this.orbit.dist * 0.0016;
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
      this.orbit.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
      d.x = e.clientX; d.y = e.clientY;
      this._applyOrbit();
      this._requestRender();
    } else if (d.kind === "node" && d.draggable) {
      if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
      const pt = this._planePoint(e, d.draggable.plane);
      if (!pt) return;
      if (!d.moved) {
        d.moved = true;
        d.start = pt.clone();
        if (this.opts.onDrag) this.opts.onDrag({ type: "start", id: d.id, x: pt.x, y: pt.y, z: pt.z,
          dx: 0, dy: 0, dz: 0, clientX: e.clientX, clientY: e.clientY, alt: !!d.alt });
      } else if (this.opts.onDrag) {
        this.opts.onDrag({ type: "move", id: d.id, x: pt.x, y: pt.y, z: pt.z,
          dx: pt.x - d.start.x, dy: pt.y - d.start.y, dz: pt.z - d.start.z,
          clientX: e.clientX, clientY: e.clientY, alt: !!d.alt });
      }
    }
  }

  _onUp(e) {
    const d = this._down;
    this._down = null;
    if (!d) return;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* released */ }
    if (d.kind !== "node") return;
    if (d.moved) {
      const pt = this._planePoint(e, d.draggable.plane);
      if (this.opts.onDrag && pt) {
        this.opts.onDrag({ type: "end", id: d.id, x: pt.x, y: pt.y, z: pt.z,
          dx: pt.x - d.start.x, dy: pt.y - d.start.y, dz: pt.z - d.start.z,
          clientX: e.clientX, clientY: e.clientY, alt: !!d.alt });
      } else if (this.opts.onDrag) {
        this.opts.onDrag({ type: "end", id: d.id, x: d.start.x, y: d.start.y, z: d.start.z,
          dx: 0, dy: 0, dz: 0, clientX: e.clientX, clientY: e.clientY, alt: !!d.alt });
      }
    } else {
      this._emitTap(d.id);
    }
  }

  _emitTap(id) {
    if (this.pickMode === "affordant") {
      const o = this.objects.get(id);
      if (!o || !(o.spec.affordances && o.spec.affordances.tap)) {
        if (this.opts.onTap) this.opts.onTap(null);
        return;
      }
    }
    if (this.opts.onTap) this.opts.onTap(id);
  }

  // ── frame ─────────────────────────────────────────────────────────────────

  resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.persp.aspect = w / h;
    this.persp.updateProjectionMatrix();
    if (this.cameraMode === "front") this._applyOrbit();
    this._requestRender();
  }

  requestRender() { this._requestRender(); }

  _requestRender() {
    if (this._needs || this._disposed) return;
    this._needs = true;
    this._raf = requestAnimationFrame(() => {
      this._needs = false;
      if (this._disposed) return;
      this._sweepPooled();
      if (this._emph && this._emph.update) this._emph.update();
      this._updateLinks();
      this.renderer.render(this.scene, this.camera);
      this._placeLabels();
    });
  }

  _updateLinks() {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const o of this.objects.values()) {
      if (!o.linkPool && !o.linkTube) continue;
      const from = this.objects.get(o.spec.from);
      const to = this.objects.get(o.spec.to);
      const ok = o.spec.visible !== false
        && from && from.group && this._worldVisible(from)
        && to && to.group && this._worldVisible(to);
      if (!ok) {
        if (o.linkTube) { if (o.linkEnds) { o.linkTube.update(o.spec.id, o.linkEnds.a, o.linkEnds.a, 0); o.linkEnds = null; } }
        else o.linkPool.setVisible(o.spec.id, false);
        continue;
      }
      from.group.getWorldPosition(a);
      to.group.getWorldPosition(b);
      if (o.linkTube) {
        const A = { x: a.x, y: a.y, z: a.z }, B = { x: b.x, y: b.y, z: b.z };
        const moved = !o.linkEnds
          || o.linkEnds.a.x !== A.x || o.linkEnds.a.y !== A.y || o.linkEnds.a.z !== A.z
          || o.linkEnds.b.x !== B.x || o.linkEnds.b.y !== B.y || o.linkEnds.b.z !== B.z;
        if (moved) {
          o.linkEnds = { a: A, b: B };
          o.linkTube.update(o.spec.id, A, B, o.spec.r ?? 0.035);
        }
        continue;
      }
      // one segment per link: template [0,0,0 → 1,1,1] placed at A, scaled B−A
      o.linkPool.setVisible(o.spec.id, true);
      o.linkPool.move(o.spec.id, { x: a.x, y: a.y, z: a.z });
      o.linkPool.setScale(o.spec.id, { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z });
    }
  }

  _placeLabels() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    for (const o of this.objects.values()) {
      if (!o.label) continue;
      o.group.getWorldPosition(v);
      v.project(this.camera);
      // x/y bounds matter as much as depth: a label is absolutely positioned
      // DOM over the canvas, so a node off to one side would otherwise paint
      // its label OUTSIDE the canvas box, over whatever the host page has
      // there. (Found in the peer app, where labels landed on the headsup
      // panel once the viewer narrowed to make room for it.)
      const vis = o.group.visible && v.z < 1
        && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05;
      o.label.style.display = vis ? "" : "none";
      if (vis) {
        o.label.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
        o.label.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      }
    }
    for (const [el, id] of this._anchored) {
      const o = this.objects.get(id);
      if (!o || !o.group) { el.style.display = "none"; continue; }
      o.group.getWorldPosition(v);
      v.project(this.camera);
      const vis = this._worldVisible(o) && v.z < 1;
      el.style.display = vis ? "" : "none";
      if (vis) {
        const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      }
    }
  }

  stats() {
    let pooled = 0;
    for (const o of this.objects.values()) if (o.pooled || o.linkPool || o.linkTube) pooled++;
    return {
      objects: this.objects.size,
      pooled,
      pools: this._pools.size + this._linkPools.size + this._linkTubePools.size,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  dispose() {
    this._disposed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._fly) cancelAnimationFrame(this._fly);
    this._anchored.clear();
    if (this._ro) this._ro.disconnect();
    for (const o of this.objects.values()) this._destroyObject(o);
    this.objects.clear();
    for (const p of this._pools.values()) p.dispose();
    this._pools.clear();
    for (const p of this._linkPools.values()) p.dispose();
    this._linkPools.clear();
    for (const p of this._linkTubePools.values()) p.dispose();
    this._linkTubePools.clear();
    for (const g of this._unitGeoms.values()) g.dispose();
    this._unitGeoms.clear();
    for (const m of this._matCache.values()) m.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
