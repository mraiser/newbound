// scenerun.js — the scene facet's runtime (scene-facet-design Part III +
// §2.8a). An interpreter over the DOC: instantiates state, evaluates
// bindings reactively (dependency-indexed — a state change re-evaluates only
// what referenced it), runs eased tweens and the `t` clock, dispatches
// declared wires, composes mounted child scenes (props-down via override
// expressions, events-up via emit), and materializes COLLECTIONS — entries
// with `each` — by keyed diffing: kept keys update in place (props
// re-evaluated, eases fire), new keys spawn, absent keys dispose. No DOM,
// no THREE — the stage is an injected surface (setScene/applyDelta/upsert/
// removeObject/requestRender), so this module stays node-testable with a
// stub stage and a manual clock.
//
// Security posture (design §3.7): nothing here executes code — expressions
// go through sceneexpr's parser, and the only platform touchpoint is the
// injected `invoke` callback (the editor gates it like run ▸).
//
// LIBRARY control — headless: defines window.NB_SCENERUN once (idempotent across
// installs). Consumers list this control as a hidden data-control child
// div and use the global from their ready.

var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function () {
  if (window.NB_SCENERUN) return;
  // sibling libraries — child divs in this control's html, ready first
  const { compile } = window.NB_SCENEEXPR;
  const { parseTarget, parseOn } = window.NB_SCENEDOC;
  const { project, envOf, deltaFor, instanceSpec } = window.NB_SCENEPROJECT;
  window.NB_SCENERUN = (function () {

const MOUNT_DEPTH_CAP = 8;
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

/** opts:
 *   doc        — the root SceneDoc
 *   stage      — {setScene, applyDelta, upsert, removeObject, requestRender}
 *   theme      — "light" | "dark"
 *   loadDoc    — async (lib, ctl) → SceneDoc | null   (mount resolution; optional)
 *   invoke     — async (lib, ctl, cmd, args) → result | Error   (gated; optional)
 *   onDiag     — (message) → void   (runtime diagnostics chip; optional)
 *   onState    — (instancePath, field, value) → void  (the editor's live state tab)
 *   reduced    — bool: prefers-reduced-motion (ease→snap, stepped clock)
 *   now        — () → ms (injectable clock; defaults to performance.now)
 */
function createRuntime(opts) {
  return new SceneRuntime(opts);
}

class Instance {
  constructor(doc, prefix, parent, mountEntry, instKey) {
    this.doc = doc;
    this.prefix = prefix;         // "" for root; "gauge:" / "peers:alice:" below
    this.parent = parent;         // parent Instance or null
    this.mountEntry = mountEntry; // the parent-doc mount entry (or null)
    this.instKey = instKey;       // collection key when each-mounted (or null)
    this.state = doc.stateDefaults();
    this.computed = new Map();    // "id.path" → DISPLAYED value (post-easing)
    this.bindings = [];           // {target:{id,path}, raw, fn, deps, ease}
    this.overrides = [];          // {mount, field, fn, deps}  (props-down)
    this.depIndex = new Map();    // dep name → [binding index]
    this.eases = new Map();       // ease key → {from,to,t0,ms,curve,apply}
    this.collections = [];        // compiled each-templates (§2.8a)
    this.specIds = [];            // stage ids this instance added via upsert
    this.t0 = 0;
    this.tNow = 0;
    this.usesT = false;
  }
  scope(extra) {
    const s = { ...this.state, t: this.tNow };
    return extra ? Object.assign(s, extra) : s;
  }
}

class SceneRuntime {
  constructor(opts) {
    this.opts = opts;
    this.stage = opts.stage;
    this.theme = opts.theme || "light";
    this.now = opts.now || (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    this.reduced = !!opts.reduced;
    this.instances = new Map();   // prefix → Instance
    this.diags = [];
    this._docCache = new Map();   // "lib:ctl" → SceneDoc | null
    this._running = false;
    this._raf = 0;
    this._stepTimer = 0;
    this._disposed = false;
  }

  _diag(msg) {
    this.diags.push(msg);
    if (this.opts.onDiag) this.opts.onDiag(msg);
  }

  // ── boot ──────────────────────────────────────────────────────────────────

  async start() {
    await this._instantiate(this.opts.doc, "", null, null, null, []);
    const t0 = this.now();
    for (const inst of this.instances.values()) { inst.t0 = t0; inst.tNow = 0; }
    for (const inst of this.instances.values()) this._evalAll(inst, true);
    this._pushScene();
    this._running = true;
    // Collections materialize AFTER the static scene exists (their specs
    // attach to already-present parents).
    for (const inst of [...this.instances.values()]) {
      for (const coll of inst.collections) await this._syncCollection(inst, coll, true);
    }
    this._scheduleClock();
  }

  async _loadDocCached(lib, ctl) {
    const key = `${lib}:${ctl}`;
    if (!this._docCache.has(key)) {
      this._docCache.set(key, this.opts.loadDoc ? await this.opts.loadDoc(lib, ctl) : null);
    }
    return this._docCache.get(key);
  }

  async _instantiate(doc, prefix, parent, mountEntry, instKey, chain) {
    const inst = new Instance(doc, prefix, parent, mountEntry, instKey);
    inst.chain = chain;
    this.instances.set(prefix, inst);
    // compile bindings
    doc.bindings().forEach((b) => {
      if (!b || typeof b.target !== "string" || typeof b.expr !== "string") return;
      const t = parseTarget(b.target);
      const c = compile(b.expr);
      if (!t || !c.ok) return; // SD-5/6 already flagged by validate
      const entry = { target: t, raw: b.target, fn: c, deps: c.deps, ease: b.ease };
      const idx = inst.bindings.push(entry) - 1;
      if (c.deps.has("t")) inst.usesT = true;
      for (const d of c.deps) {
        if (!inst.depIndex.has(d)) inst.depIndex.set(d, []);
        inst.depIndex.get(d).push(idx);
      }
    });
    // compile collections (§2.8a) — nodes and mounts alike
    for (const entry of [...doc.nodes(), ...doc.mounts()]) {
      if (!isObj(entry) || typeof entry.id !== "string" || entry.each === undefined) continue;
      const type = doc.mounts().includes(entry) ? "mount" : "node";
      const props = [];
      if (isObj(entry.props)) {
        for (const [path, src] of Object.entries(entry.props)) {
          if (typeof src !== "string") continue;
          const c = compile(src);
          if (!c.ok) continue; // SD-11 flagged it
          props.push({ path, fn: c, deps: c.deps });
          if (c.deps.has("t")) inst.usesT = true;
        }
      }
      // per-item props-down (design §2.8a): compiled ONCE; re-applied on
      // collection sync AND whenever a non-item dependency changes (a tap
      // flipping `focus` must reach the children instantly, even while a
      // host feed sleeps)
      const itemOverrides = [];
      if (type === "mount" && isObj(entry.state)) {
        for (const [field, expr] of Object.entries(entry.state)) {
          if (typeof expr !== "string") continue;
          const c = compile(expr);
          if (!c.ok) continue;
          itemOverrides.push({ field, fn: c, deps: c.deps });
          if (c.deps.has("t")) inst.usesT = true;
        }
      }
      inst.collections.push({
        entry, type, field: entry.each,
        keyProp: typeof entry.key === "string" ? entry.key : "id",
        props, itemOverrides, ease: isObj(entry.ease) ? entry.ease : null,
        tDeps: props.some((p) => p.deps.has("t")),
        instances: new Map(),   // key → {overrides: Map, item, index, childPrefix?}
      });
    }
    // compile mount overrides (props-down) + static child mounts.
    // Each-mount `state` is per-item (compiled above) — NOT an instance
    // override (evaluating it here would misfire on the `item` local).
    for (const m of doc.mounts()) {
      if (!isObj(m) || typeof m.id !== "string") continue;
      if (isObj(m.state) && m.each === undefined) {
        for (const [field, expr] of Object.entries(m.state)) {
          if (typeof expr !== "string") continue;
          const c = compile(expr);
          if (!c.ok) continue;
          inst.overrides.push({ mount: m.id, field, fn: c, deps: c.deps });
          if (c.deps.has("t")) inst.usesT = true;
        }
      }
      if (m.each !== undefined) continue; // collection children spawn at sync
      const guard = this._mountGuard(m, prefix, chain);
      if (guard) continue;
      const child = await this._loadDocCached(m.lib, m.ctl);
      if (!child) {
        this._diag(`mount ${prefix}${m.id}: ${m.lib}.${m.ctl} has no scene facet — placeholder shown`);
        continue;
      }
      await this._instantiate(child, `${prefix}${m.id}:`, inst, m, null, [...chain, `${m.lib}:${m.ctl}`]);
    }
    return inst;
  }

  _mountGuard(m, prefix, chain) {
    const key = `${m.lib}:${m.ctl}`;
    if (chain.length >= MOUNT_DEPTH_CAP) {
      this._diag(`mount ${prefix}${m.id}: depth cap ${MOUNT_DEPTH_CAP} reached (SD-9)`);
      return true;
    }
    if (chain.includes(key)) {
      this._diag(`mount ${prefix}${m.id}: ${m.lib}.${m.ctl} mounts itself (SD-9) — placeholder shown`);
      return true;
    }
    if (!this.opts.loadDoc) return true;
    return false;
  }

  _rootParentOf(inst) {
    return inst.prefix === "" ? null : inst.prefix.slice(0, -1);
  }

  _pushScene() {
    const specs = [];
    for (const inst of this.instances.values()) {
      specs.push(...project(inst.doc, {
        computed: inst.computed, theme: this.theme,
        prefix: inst.prefix, parent: this._rootParentOf(inst),
      }));
    }
    this.stage.setScene(specs, envOf(this.opts.doc));
  }

  // ── collections (§2.8a) ───────────────────────────────────────────────────

  _instId(inst, coll, key) { return `${inst.prefix}${coll.entry.id}:${key}`; }

  _evalProps(inst, coll, item, index) {
    const overrides = new Map();
    const scope = inst.scope({ item, index });
    for (const p of coll.props) {
      const r = p.fn.run(scope);
      if (r.ok) overrides.set(`${coll.entry.id}.${p.path}`, r.value);
      else this._diag(`${inst.prefix}${coll.entry.id} props.${p.path}: ${r.error}`);
    }
    return overrides;
  }

  async _syncCollection(inst, coll, boot) {
    const arr = Array.isArray(inst.state[coll.field]) ? inst.state[coll.field] : [];
    const seen = new Set();
    for (let index = 0; index < arr.length; index++) {
      const item = arr[index];
      const key = String(isObj(item) && item[coll.keyProp] !== undefined ? item[coll.keyProp] : index);
      if (seen.has(key)) { this._diag(`${inst.prefix}${coll.entry.id}: duplicate key "${key}" — item ${index} skipped`); continue; }
      seen.add(key);
      const known = coll.instances.get(key);
      if (!known) await this._spawnInstance(inst, coll, key, item, index, boot);
      else this._updateInstance(inst, coll, known, key, item, index, boot);
    }
    for (const [key, known] of [...coll.instances]) {
      if (!seen.has(key)) this._disposeInstance(inst, coll, key, known);
    }
    if (this._running) this.stage.requestRender();
  }

  async _spawnInstance(inst, coll, key, item, index, boot) {
    const overrides = this._evalProps(inst, coll, item, index);
    const spec = instanceSpec(inst.doc, coll.entry, coll.type, key, overrides,
      { theme: this.theme, prefix: inst.prefix, parent: this._rootParentOf(inst) });
    this.stage.upsert(spec);
    const known = { overrides, item, index };
    coll.instances.set(key, known);
    if (coll.type === "mount") {
      const m = coll.entry;
      if (!this._mountGuard(m, inst.prefix, inst.chain)) {
        const childDoc = await this._loadDocCached(m.lib, m.ctl);
        if (childDoc) {
          const childPrefix = `${inst.prefix}${m.id}:${key}:`;
          const child = await this._instantiate(childDoc, childPrefix, inst, m, key,
            [...inst.chain, `${m.lib}:${m.ctl}`]);
          child.t0 = boot ? inst.t0 : this.now() - inst.tNow * 1000;
          child.tNow = inst.tNow;
          this._applyItemOverrides(inst, coll, child, item, index, true);
          this._evalAll(child, true);
          const childSpecs = project(childDoc, {
            computed: child.computed, theme: this.theme,
            prefix: childPrefix, parent: spec.id,
          });
          for (const s of childSpecs) { this.stage.upsert(s); child.specIds.push(s.id); }
          known.childPrefix = childPrefix;
          // a spawned child may carry its own collections
          for (const c of child.collections) await this._syncCollection(child, c, boot);
        } else {
          this._diag(`mount ${inst.prefix}${m.id}[${key}]: ${m.lib}.${m.ctl} has no scene facet — placeholder shown`);
        }
      }
    }
  }

  /** Per-item props-down: the template's `state` overrides (precompiled on
      the collection) evaluated with item/index in scope, written into the
      child instance's state. */
  _applyItemOverrides(inst, coll, child, item, index, boot) {
    const scope = inst.scope({ item, index });
    for (const o of coll.itemOverrides) {
      const r = o.fn.run(scope);
      if (r.ok) this._setInstanceState(child, o.field, r.value, boot);
      else this._diag(`${child.prefix}${o.field}: ${r.error}`);
    }
  }

  _updateInstance(inst, coll, known, key, item, index, boot) {
    const overrides = this._evalProps(inst, coll, item, index);
    const id = this._instId(inst, coll, key);
    for (const [k, value] of overrides) {
      const prev = known.overrides.get(k);
      if (prev === value) continue;
      const path = k.slice(coll.entry.id.length + 1);
      const d = this._instanceDelta(inst, coll, overrides, path);
      if (!d) continue;
      if (coll.ease && !this.reduced && !boot
          && typeof value === "number" && typeof prev === "number" && d.path === path) {
        this._startEase(inst, `${id}.${path}`, prev, value, coll.ease,
          (v) => this.stage.applyDelta(id, path, v));
      } else {
        this.stage.applyDelta(id, d.path, d.value);
      }
    }
    known.overrides = overrides;
    known.item = item;
    known.index = index;
    if (coll.type === "mount" && known.childPrefix) {
      const child = this.instances.get(known.childPrefix);
      if (child) this._applyItemOverrides(inst, coll, child, item, index, false);
    }
  }

  /** Delta shaping for an instance path — materials re-resolve, geometry
      params re-emit, everything else passes through (mirrors deltaFor). */
  _instanceDelta(inst, coll, overrides, path) {
    const d = deltaFor(inst.doc, coll.entry.id, path, overrides, this.theme);
    return d;
  }

  _disposeInstance(inst, coll, key, known) {
    if (known.childPrefix) {
      const child = this.instances.get(known.childPrefix);
      if (child) {
        for (const c of child.collections) {
          for (const [k2, kn2] of [...c.instances]) this._disposeInstance(child, c, k2, kn2);
        }
        for (const sid of child.specIds) this.stage.removeObject(sid);
        this.instances.delete(known.childPrefix);
      }
    }
    this.stage.removeObject(this._instId(inst, coll, key));
    coll.instances.delete(key);
  }

  // ── evaluation ────────────────────────────────────────────────────────────

  _evalAll(inst, boot) {
    inst.bindings.forEach((b, i) => this._evalBinding(inst, i, boot));
    for (const o of inst.overrides) this._evalOverride(inst, o, boot);
  }

  _startEase(inst, key, from, to, ease, apply) {
    inst.eases.set(key, { from, to, t0: this.now(), ms: Math.max(1, ease.ms),
      curve: ease.curve || "linear", apply });
    this._scheduleClock();
  }

  _evalBinding(inst, idx, snap) {
    const b = inst.bindings[idx];
    const r = b.fn.run(inst.scope());
    if (!r.ok) { this._diag(`${inst.prefix}${b.raw}: ${r.error}`); return; }
    const key = b.raw;
    const prev = inst.computed.get(key);
    if (prev === r.value) return;
    const ease = b.ease && !this.reduced && !snap ? b.ease : null;
    if (ease && typeof r.value === "number" && typeof prev === "number") {
      this._startEase(inst, key, prev, r.value, ease,
        (v) => this._display(inst, b.target, key, v));
      return;
    }
    inst.eases.delete(key);
    this._display(inst, b.target, key, r.value);
  }

  _evalOverride(inst, o, boot) {
    const r = o.fn.run(inst.scope());
    if (!r.ok) { this._diag(`${inst.prefix}${o.mount}.${o.field}: ${r.error}`); return; }
    const child = this.instances.get(`${inst.prefix}${o.mount}:`);
    if (!child) return; // each-mounts get per-item overrides instead
    this._setInstanceState(child, o.field, r.value, boot);
  }

  _display(inst, target, key, value) {
    inst.computed.set(key, value);
    if (!this._running) return;
    const d = deltaFor(inst.doc, target.id, target.path, inst.computed, this.theme);
    if (d) this.stage.applyDelta(inst.prefix + target.id, d.path, d.value);
  }

  // ── state ─────────────────────────────────────────────────────────────────

  /** Root-instance state write (wires' `set`, or the editor's state tab). */
  setState(field, value) { this._setInstanceState(this.instances.get(""), field, value, false); }

  stateOf(prefix = "") {
    const inst = this.instances.get(prefix);
    return inst ? { ...inst.state } : {};
  }

  _setInstanceState(inst, field, value, boot) {
    if (!inst) return;
    if (inst.state[field] === value) return;
    inst.state[field] = value;
    if (this.opts.onState) this.opts.onState(inst.prefix, field, value);
    const deps = inst.depIndex.get(field);
    if (deps) for (const i of deps) this._evalBinding(inst, i, boot);
    for (const o of inst.overrides) if (o.deps.has(field)) this._evalOverride(inst, o, boot);
    for (const coll of inst.collections) {
      if (coll.field === field || coll.props.some((p) => p.deps.has(field))) {
        // fire-and-forget: spawns may load child docs asynchronously
        this._syncCollection(inst, coll, boot);
      } else if (coll.itemOverrides.some((o) => o.deps.has(field))) {
        // a non-item dependency of the per-item props-down changed (the
        // peer case: a tap flips `focus`) — re-apply to the LIVE children
        // now; waiting for the next collection sync would leave the visual
        // response hostage to the host feed (which may be asleep)
        for (const known of coll.instances.values()) {
          if (!known.childPrefix) continue;
          const child = this.instances.get(known.childPrefix);
          if (child) this._applyItemOverrides(inst, coll, child, known.item, known.index, boot);
        }
      }
    }
    if (this._running) this.stage.requestRender();
  }

  // ── events (the stage's callbacks funnel here in play mode) ───────────────

  /** Resolve a prefixed stage id → {inst, localId}. */
  _resolve(prefixedId) {
    if (prefixedId == null) return null;
    let best = null;
    for (const [prefix, inst] of this.instances) {
      if (prefixedId.startsWith(prefix) && (!best || prefix.length > best.prefix.length)) {
        best = { prefix, inst };
      }
    }
    if (!best) return null;
    return { inst: best.inst, localId: prefixedId.slice(best.prefix.length) };
  }

  /** Collection-instance events fire the TEMPLATE's wire with the item in
      scope: "orb:alice" taps as `orb.tap` with locals {key, item, index}. */
  _eventTarget(inst, localId) {
    const i = localId.indexOf(":");
    if (i < 0) return { id: localId, locals: {} };
    const templateId = localId.slice(0, i);
    const key = localId.slice(i + 1);
    for (const coll of inst.collections) {
      if (coll.entry.id === templateId && coll.instances.has(key)) {
        const known = coll.instances.get(key);
        return { id: templateId, locals: { key, item: known.item, index: known.index } };
      }
    }
    return { id: localId, locals: {} };
  }

  handleTap(prefixedId) {
    const hit = this._resolve(prefixedId);
    if (!hit) return;
    const t = this._eventTarget(hit.inst, hit.localId);
    this._fire(hit.inst, `${t.id}.tap`, t.locals);
  }

  handleHover(prefixedId, entered) {
    const hit = this._resolve(prefixedId);
    if (!hit) return;
    const t = this._eventTarget(hit.inst, hit.localId);
    this._fire(hit.inst, `${t.id}.${entered ? "hoverin" : "hoverout"}`, t.locals);
  }

  handleDrag(evt) {
    const hit = this._resolve(evt.id);
    if (!hit) return;
    const t = this._eventTarget(hit.inst, hit.localId);
    const locals = { ...t.locals, x: evt.x, y: evt.y, z: evt.z, dx: evt.dx, dy: evt.dy, dz: evt.dz };
    const event = evt.type === "start" ? "dragstart" : evt.type === "move" ? "dragmove" : "dragend";
    this._fire(hit.inst, `${t.id}.${event}`, locals);
  }

  _fire(inst, on, locals) {
    for (const w of inst.doc.wires()) {
      if (!w || w.on !== on || !Array.isArray(w.do)) continue;
      for (const a of w.do) this._runAction(inst, a, locals);
    }
  }

  _runAction(inst, a, locals) {
    if (!a || typeof a !== "object") return;
    if (typeof a.set === "string") {
      const c = compile(a.to);
      if (!c.ok) return;
      const r = c.run(inst.scope(locals));
      if (!r.ok) { this._diag(`set ${a.set}: ${r.error}`); return; }
      this._setInstanceState(inst, a.set, r.value, false);
    } else if (typeof a.invoke === "string") {
      this._runInvoke(inst, a, locals);
    } else if (typeof a.emit === "string") {
      if (!inst.parent || !inst.mountEntry) return; // root emits go nowhere
      const payload = {};
      if (isObj(a.with)) {
        for (const [k, expr] of Object.entries(a.with)) {
          const c = compile(expr);
          if (c.ok) {
            const r = c.run(inst.scope(locals));
            if (r.ok) payload[k] = r.value;
          }
        }
      }
      // an each-mounted child announces WHICH instance it is
      if (inst.instKey !== null && payload.key === undefined) payload.key = inst.instKey;
      this._fire(inst.parent, `${inst.mountEntry.id}.${a.emit}`, payload);
    }
  }

  async _runInvoke(inst, a, locals) {
    if (!this.opts.invoke) {
      this._diag(`invoke ${a.invoke}: not available here (needs a writable live connection — the run ▸ posture)`);
      return;
    }
    const m = /^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/.exec(a.invoke);
    if (!m) return;
    const args = {};
    if (isObj(a.args)) {
      for (const [k, expr] of Object.entries(a.args)) {
        const c = compile(expr);
        if (c.ok) {
          const r = c.run(inst.scope(locals));
          if (r.ok) args[k] = r.value;
        }
      }
    }
    const result = await this.opts.invoke(m[1], m[2], m[3], args);
    if (result instanceof Error) {
      this._diag(`invoke ${a.invoke}: ${result.message}`);
      return;
    }
    if (Array.isArray(a.then)) {
      for (const s of a.then) {
        if (!s || typeof s.set !== "string") continue;
        const c = compile(s.to);
        if (!c.ok) continue;
        const r = c.run(inst.scope({ ...locals, result }));
        if (r.ok) this._setInstanceState(inst, s.set, r.value, false);
        else this._diag(`then set ${s.set}: ${r.error}`);
      }
    }
  }

  // ── the clock (t + eases) ─────────────────────────────────────────────────

  _animated() {
    for (const inst of this.instances.values()) {
      if (inst.usesT || inst.eases.size) return true;
    }
    return false;
  }

  /** One clock step; exposed for tests (the editor never calls it). */
  step() {
    if (this._disposed) return;
    const nowMs = this.now();
    for (const inst of this.instances.values()) {
      inst.tNow = (nowMs - inst.t0) / 1000;
      if (inst.usesT) {
        const deps = inst.depIndex.get("t");
        if (deps) for (const i of deps) this._evalBinding(inst, i, false);
        for (const o of inst.overrides) if (o.deps.has("t")) this._evalOverride(inst, o, false);
        for (const coll of inst.collections) if (coll.tDeps) this._syncCollection(inst, coll, false);
      }
      for (const [key, e] of [...inst.eases]) {
        const k = Math.min(1, (nowMs - e.t0) / e.ms);
        const shaped = e.curve === "ease" ? (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) : k;
        e.apply(k >= 1 ? e.to : e.from + (e.to - e.from) * shaped);
        if (k >= 1) inst.eases.delete(key);
      }
    }
    if (this._running) this.stage.requestRender();
  }

  _scheduleClock() {
    if (!this._running || this._disposed || this._raf || this._stepTimer) return;
    if (!this._animated()) return;
    const hasRaf = typeof requestAnimationFrame === "function";
    const loop = () => {
      this._raf = 0; this._stepTimer = 0;
      if (this._disposed || !this._running) return;
      this.step();
      if (this._animated()) schedule();
    };
    const schedule = () => {
      if (this.reduced || !hasRaf) this._stepTimer = setTimeout(loop, this.reduced ? 500 : 16);
      else this._raf = requestAnimationFrame(loop);
    };
    schedule();
  }

  pause() { this._running = false; }
  resume() { this._running = true; this._scheduleClock(); this.stage.requestRender(); }

  dispose() {
    this._disposed = true;
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._stepTimer) clearTimeout(this._stepTimer);
    this.instances.clear();
  }
}

    return { createRuntime };
  })();
};
