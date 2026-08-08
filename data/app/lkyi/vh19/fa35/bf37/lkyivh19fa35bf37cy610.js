// scenedoc.js — the scene facet model: pure data (scene-facet-design Part II).
// No DOM, no THREE, no network. Wraps the raw facet JSON, validates it into
// DIAGNOSTICS (SD-1…SD-10, never rejections — the editor must open a broken
// scene to fix it), and mutates it IN PLACE with precise inverses so composed
// undo chains stay byte-stable (the flowdoc lesson).
//
// Byte-stability contract: parse() never reshapes the document — defaults are
// applied by READ accessors, not written into the JSON — so an untouched doc
// serializes back byte-identical, unknown keys and key order included (SD-10,
// design acceptance 3). Mutations restore prior absence exactly (created
// containers are deleted again on undo).

import { parse as parseExpr } from "./sceneexpr.js";
import { TOKEN_NAMES } from "./scenetokens.js";

export const DIAG = {
  SD1: "SD-1",   // duplicate / malformed ids (nodes + mounts share one space)
  SD2: "SD-2",   // parent/at refs missing, or a node-parent cycle
  SD3: "SD-3",   // non-numeric transform / malformed value
  SD4: "SD-4",   // unknown material token (warn — tokens are extensible)
  SD5: "SD-5",   // binding target unresolvable / not bindable / duplicate
  SD6: "SD-6",   // expression parse error or out-of-scope identifier
  SD7: "SD-7",   // wire refs: bad `on`, undeclared affordance, bad action
  SD8: "SD-8",   // state names duplicate/malformed, default fails its type
  SD9: "SD-9",   // mount depth/cycle — reported by the RUNTIME, listed here
  SD10: "SD-10", // unknown top-level key (info; preserved verbatim)
  SD11: "SD-11", // each/props malformed (design §2.8a)
  SD12: "SD-12", // static link endpoints unresolvable
};

export const NAME_RE = /^[a-z][a-z0-9_]*$/;
export const STATE_TYPES = ["number", "string", "boolean", "json"];
export const NODE_EVENTS = ["tap", "dragstart", "dragmove", "dragend", "hoverin", "hoverout"];
export const DRAG_LOCALS = ["x", "y", "z", "dx", "dy", "dz"];
const AFFORDANCE_FOR = { tap: "tap", dragstart: "drag", dragmove: "drag",
  dragend: "drag", hoverin: "hover", hoverout: "hover" };

/** Kind vocabulary (design §2.2): extra param paths + their defaults. The
    param paths are also the kind's extra bindable properties. */
export const KINDS = {
  group:    { params: {} },
  box:      { params: { "size.x": 1, "size.y": 1, "size.z": 1 } },
  sphere:   { params: { radius: 0.5 } },
  ico:      { params: { radius: 0.5, detail: 1 } },
  cylinder: { params: { radius: 0.5, height: 1 } },
  cone:     { params: { radius: 0.5, height: 1 } },
  plane:    { params: { w: 1, h: 1 } },
  text:     { params: { text: "", size: 1 } },
  light:    { params: { intensity: 1 } },
  slot:     { params: {} },
  // link (design §2.2/Part X): a world-space connector tracking its two
  // endpoints' positions each frame; its own transforms are ignored.
  link:     { params: {} },
};
export const MATERIAL_KINDS = new Set(["box", "sphere", "ico", "cylinder", "cone", "plane", "link"]);
export const LIGHT_MODES = ["ambient", "directional", "point"];

const XFORM_BIND = ["pos.x", "pos.y", "pos.z", "rot.x", "rot.y", "rot.z",
  "scale.x", "scale.y", "scale.z"];
export const MOUNT_BIND = [...XFORM_BIND, "visible"];

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && isFinite(v);

/** Bindable property paths for a node of `kind` / for a mount. */
export function bindablePaths(kind) {
  const out = [...XFORM_BIND, "visible"];
  if (MATERIAL_KINDS.has(kind)) out.push("material.opacity", "material.token");
  out.push(...Object.keys((KINDS[kind] || { params: {} }).params));
  if (kind === "link") out.push("from", "to");
  return out;
}

/** Paths setProp accepts — bindable plus editor-only extras. */
function editablePaths(type, kind) {
  if (type === "mount") return new Set(MOUNT_BIND);
  const out = new Set(bindablePaths(kind));
  if (MATERIAL_KINDS.has(kind)) out.add("material.color");
  if (kind === "light") out.add("mode");
  return out;
}

function propDefault(kind, path) {
  if (path.startsWith("pos.") || path.startsWith("rot.")) return 0;
  if (path.startsWith("scale.")) return 1;
  if (path === "visible") return true;
  if (path === "material.opacity") return 1;
  if (path === "material.token") return "surface";
  if (path === "material.color") return null;
  if (path === "mode") return "ambient";
  if (path === "from" || path === "to") return "";
  const params = (KINDS[kind] || { params: {} }).params;
  return path in params ? params[path] : undefined;
}

function propType(path, kind) {
  if (path === "visible") return "boolean";
  if (path === "material.token" || path === "material.color" || path === "mode") return "string";
  if (path === "text" || path === "from" || path === "to") return "string";
  return "number";
}

/** "<id>.<prop.path>" → {id, path} (path may contain dots). */
export function parseTarget(target) {
  if (typeof target !== "string") return null;
  const i = target.indexOf(".");
  if (i <= 0 || i === target.length - 1) return null;
  return { id: target.slice(0, i), path: target.slice(i + 1) };
}

/** "<id>.<event>" → {id, event}. */
export const parseOn = parseTarget && ((on) => {
  const p = parseTarget(on);
  return p ? { id: p.id, event: p.path } : null;
});

/** Read a (possibly absent) dotted path off an entry, defaulted per kind. */
export function readProp(entry, path, kind) {
  const parts = path.split(".");
  let cur = entry;
  for (const p of parts) {
    if (!isObj(cur) || !(p in cur)) return propDefault(kind, path);
    cur = cur[p];
  }
  return cur;
}

/** Write a dotted path in place, creating containers; returns an undoer that
    restores prior presence EXACTLY (created containers deleted again). */
function writeProp(entry, path, value) {
  const parts = path.split(".");
  const created = [];
  let cur = entry;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isObj(cur[p])) { cur[p] = {}; created.push([cur, p]); }
    cur = cur[p];
  }
  const leaf = parts[parts.length - 1];
  const had = Object.prototype.hasOwnProperty.call(cur, leaf);
  const prev = cur[leaf];
  cur[leaf] = value;
  return () => {
    if (had) cur[leaf] = prev; else delete cur[leaf];
    for (let i = created.length - 1; i >= 0; i--) { const [o, k] = created[i]; delete o[k]; }
  };
}

/** Ensure doc[key] is an array, returning {arr, undo} (undo removes the key
    again if this call created it). */
function ensureArr(root, key) {
  if (Array.isArray(root[key])) return { arr: root[key], undo: () => {} };
  root[key] = [];
  return { arr: root[key], undo: () => { delete root[key]; } };
}

const KNOWN_TOP = new Set(["v", "state", "nodes", "mounts", "bindings", "wires", "env"]);

export class SceneDoc {
  constructor(root, parseDiags) {
    this.root = root;
    this._parseDiags = parseDiags || [];
  }

  nodes() { return Array.isArray(this.root.nodes) ? this.root.nodes : []; }
  mounts() { return Array.isArray(this.root.mounts) ? this.root.mounts : []; }
  stateFields() { return Array.isArray(this.root.state) ? this.root.state : []; }
  bindings() { return Array.isArray(this.root.bindings) ? this.root.bindings : []; }
  wires() { return Array.isArray(this.root.wires) ? this.root.wires : []; }
  env() { return isObj(this.root.env) ? this.root.env : {}; }

  /** {type:"node"|"mount", entry} or null. Nodes win (SD-1 flags dupes). */
  byId(id) {
    for (const n of this.nodes()) if (n && n.id === id) return { type: "node", entry: n };
    for (const m of this.mounts()) if (m && m.id === id) return { type: "mount", entry: m };
    return null;
  }

  childrenOf(id) {
    const nodes = this.nodes().filter((n) => isObj(n) && (n.parent ?? null) === id);
    const mounts = this.mounts().filter((m) => isObj(m) && (m.at ?? null) === id);
    return { nodes, mounts };
  }

  stateDefaults() {
    const out = {};
    for (const f of this.stateFields()) if (isObj(f) && typeof f.name === "string") out[f.name] = f.value;
    return out;
  }
  stateNames() { return new Set(Object.keys(this.stateDefaults())); }

  read(id, path) {
    const hit = this.byId(id);
    if (!hit) return undefined;
    return readProp(hit.entry, path, hit.type === "node" ? hit.entry.kind : "group");
  }

  boundTargets() {
    const out = new Set();
    for (const b of this.bindings()) if (isObj(b) && typeof b.target === "string") out.add(b.target);
    return out;
  }

  /** True when any expression references `t` — the scene is animated. */
  animated() {
    for (const src of this._allExprs()) {
      const p = parseExpr(src.expr);
      if (p.ok && p.deps.has("t")) return true;
    }
    return false;
  }

  _allExprs() {
    const out = [];
    for (const b of this.bindings()) if (isObj(b) && typeof b.expr === "string") out.push({ expr: b.expr, where: `binding ${b.target}` });
    for (const m of this.mounts()) if (isObj(m) && isObj(m.state)) {
      for (const [f, e] of Object.entries(m.state)) if (typeof e === "string") out.push({ expr: e, where: `mount ${m.id}.${f}` });
    }
    for (const entry of [...this.nodes(), ...this.mounts()]) {
      if (isObj(entry) && isObj(entry.props)) {
        for (const [p, e] of Object.entries(entry.props)) if (typeof e === "string") out.push({ expr: e, where: `${entry.id} props.${p}` });
      }
    }
    for (const w of this.wires()) if (isObj(w) && Array.isArray(w.do)) {
      for (const a of w.do) this._actionExprs(a, `wire ${w.on}`, out);
    }
    return out;
  }

  /** Entries declaring `each` over the named state field (design §2.8a). */
  eachSources(field) {
    return [...this.nodes(), ...this.mounts()].filter((e) => isObj(e) && e.each === field);
  }
  _actionExprs(a, where, out) {
    if (!isObj(a)) return;
    if (typeof a.to === "string") out.push({ expr: a.to, where });
    if (isObj(a.args)) for (const e of Object.values(a.args)) if (typeof e === "string") out.push({ expr: e, where });
    if (isObj(a.with)) for (const e of Object.values(a.with)) if (typeof e === "string") out.push({ expr: e, where });
    if (Array.isArray(a.then)) for (const s of a.then) this._actionExprs(s, `${where} (then)`, out);
  }

  /** Fresh unique id from a prefix (for the editor's palette). */
  newId(prefix) {
    const base = (prefix || "node").toLowerCase().replace(/[^a-z0-9_]/g, "") || "node";
    let i = 1;
    while (this.byId(`${base}${i}`)) i++;
    return `${base}${i}`;
  }

  /** Re-emit as plain JSON — a deep copy preserving key order. Untouched docs
      round-trip byte-identical (design acceptance 3). */
  serialize() { return JSON.parse(JSON.stringify(this.root)); }

  // ── diagnostics ───────────────────────────────────────────────────────────

  diagnostics() {
    const diags = [...this._parseDiags];
    const push = (code, severity, path, message) => diags.push({ code, severity, path, message });
    const root = this.root;

    for (const k of Object.keys(isObj(root) ? root : {})) {
      if (!KNOWN_TOP.has(k)) push(DIAG.SD10, "info", k, `unknown top-level key "${k}" (preserved verbatim)`);
    }

    // SD-8 state
    const stateNames = new Set();
    this.stateFields().forEach((f, i) => {
      const path = `state[${i}]`;
      if (!isObj(f) || typeof f.name !== "string" || !NAME_RE.test(f.name)) { push(DIAG.SD8, "error", path, "state field needs a well-formed name"); return; }
      if (stateNames.has(f.name)) push(DIAG.SD8, "error", path, `duplicate state field "${f.name}"`);
      stateNames.add(f.name);
      if (!STATE_TYPES.includes(f.type)) push(DIAG.SD8, "error", path, `unknown state type "${f.type}"`);
      else if (f.type !== "json" && typeof f.value !== f.type) push(DIAG.SD8, "warn", path, `default for "${f.name}" is not a ${f.type}`);
    });

    // SD-1 ids
    const ids = new Set();
    const seeId = (entry, path) => {
      if (!isObj(entry) || typeof entry.id !== "string" || !NAME_RE.test(entry.id)) { push(DIAG.SD1, "error", path, "missing or malformed id"); return; }
      if (ids.has(entry.id)) push(DIAG.SD1, "error", path, `duplicate id "${entry.id}"`);
      ids.add(entry.id);
    };
    this.nodes().forEach((n, i) => seeId(n, `nodes[${i}]`));
    this.mounts().forEach((m, i) => seeId(m, `mounts[${i}]`));

    const nodeIds = new Set(this.nodes().filter((n) => isObj(n) && typeof n.id === "string").map((n) => n.id));
    const mountIds = new Set(this.mounts().filter((m) => isObj(m) && typeof m.id === "string").map((m) => m.id));

    // SD-2 parents + cycles, SD-3 values, SD-4 tokens
    this.nodes().forEach((n, i) => {
      if (!isObj(n)) return;
      const path = `nodes[${i}]`;
      if (!(n.kind in KINDS)) push(DIAG.SD3, "error", path, `unknown kind "${n.kind}"`);
      if (n.parent !== undefined && !nodeIds.has(n.parent)) push(DIAG.SD2, "error", path, `parent "${n.parent}" is not a node`);
      for (const t of ["pos", "rot", "scale"]) {
        if (n[t] === undefined) continue;
        if (!isObj(n[t])) { push(DIAG.SD3, "error", path, `${t} must be {x,y,z}`); continue; }
        for (const a of ["x", "y", "z"]) if (n[t][a] !== undefined && !isNum(n[t][a])) push(DIAG.SD3, "error", path, `${t}.${a} must be a number (strings were the legacy facet's wart)`);
      }
      if (n.material !== undefined) {
        if (!isObj(n.material)) push(DIAG.SD3, "error", path, "material must be an object");
        else if (n.material.token !== undefined && !TOKEN_NAMES.includes(n.material.token)) push(DIAG.SD4, "warn", path, `unknown material token "${n.material.token}"`);
      }
      if (n.kind === "light" && n.mode !== undefined && !LIGHT_MODES.includes(n.mode)) push(DIAG.SD3, "error", path, `light mode "${n.mode}" (ambient|directional|point)`);
      const params = (KINDS[n.kind] || { params: {} }).params;
      for (const [p, def] of Object.entries(params)) {
        const v = readProp(n, p, n.kind);
        if (typeof def === "number" && !isNum(v)) push(DIAG.SD3, "error", path, `${p} must be a number`);
      }
    });
    // node-parent cycles
    for (const n of this.nodes()) {
      if (!isObj(n)) continue;
      const seen = new Set([n.id]);
      let cur = n;
      while (cur && cur.parent !== undefined) {
        if (seen.has(cur.parent)) { push(DIAG.SD2, "error", `node ${n.id}`, `parent cycle through "${cur.parent}"`); break; }
        seen.add(cur.parent);
        cur = this.nodes().find((x) => isObj(x) && x.id === cur.parent);
      }
    }
    this.mounts().forEach((m, i) => {
      if (!isObj(m)) return;
      const path = `mounts[${i}]`;
      if (typeof m.lib !== "string" || typeof m.ctl !== "string" || !m.lib || !m.ctl) push(DIAG.SD3, "error", path, "mount needs lib and ctl");
      if (m.at !== undefined && !nodeIds.has(m.at)) push(DIAG.SD2, "error", path, `at "${m.at}" is not a node`);
    });

    // SD-11 collections + SD-12 static links
    for (const [entry, i, type] of [...this.nodes().map((n, i) => [n, i, "node"]),
                                    ...this.mounts().map((m, i) => [m, i, "mount"])]) {
      if (!isObj(entry)) continue;
      const path = `${type}s[${i}]`;
      if (entry.each !== undefined) {
        if (type === "node" && entry.kind === "slot") push(DIAG.SD11, "error", path, "slot cannot be a collection");
        const f = this.stateFields().find((x) => isObj(x) && x.name === entry.each);
        if (!f) push(DIAG.SD11, "error", path, `each names unknown state field "${entry.each}"`);
        else if (f.type !== "json") push(DIAG.SD11, "warn", path, `each field "${entry.each}" is ${f.type}, expected json (an array)`);
        if (entry.key !== undefined && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry.key)) push(DIAG.SD11, "error", path, `malformed key "${entry.key}"`);
        if (entry.props !== undefined) {
          if (!isObj(entry.props)) push(DIAG.SD11, "error", path, "props must be an object of path → expression");
          else {
            const legal = type === "mount" ? MOUNT_BIND : bindablePaths(entry.kind);
            for (const [p, e] of Object.entries(entry.props)) {
              if (!legal.includes(p)) push(DIAG.SD11, "error", path, `props path "${p}" is not bindable on ${type === "mount" ? "a mount" : `kind ${entry.kind}`}`);
              this._checkExpr(e, ["t", "item", "index"], `${path}.props.${p}`, push);
            }
          }
        }
      } else if (type === "node" && entry.kind === "link") {
        // static link: endpoints must resolve now (each-links resolve at runtime)
        for (const end of ["from", "to"]) {
          if (typeof entry[end] !== "string" || !entry[end]) push(DIAG.SD12, "error", path, `link needs ${end}`);
          else if (!this.byId(entry[end])) push(DIAG.SD12, "error", path, `link ${end} "${entry[end]}" does not exist`);
        }
      }
    }

    // SD-5/SD-6 bindings
    const eachIds = new Set([...this.nodes(), ...this.mounts()]
      .filter((e) => isObj(e) && e.each !== undefined && typeof e.id === "string").map((e) => e.id));
    const seenTargets = new Set();
    this.bindings().forEach((b, i) => {
      const path = `bindings[${i}]`;
      if (!isObj(b)) { push(DIAG.SD5, "error", path, "malformed binding"); return; }
      const t = parseTarget(b.target);
      if (!t) { push(DIAG.SD5, "error", path, `malformed target "${b.target}"`); return; }
      if (seenTargets.has(b.target)) push(DIAG.SD5, "error", path, `duplicate binding for ${b.target}`);
      seenTargets.add(b.target);
      const hit = this.byId(t.id);
      if (!hit) { push(DIAG.SD5, "error", path, `target id "${t.id}" does not exist`); }
      else if (eachIds.has(t.id)) { push(DIAG.SD5, "error", path, `"${t.id}" is an each-template — use its props for per-instance values`); }
      else {
        const legal = hit.type === "mount" ? MOUNT_BIND : bindablePaths(hit.entry.kind);
        if (!legal.includes(t.path)) push(DIAG.SD5, "error", path, `"${t.path}" is not bindable on ${hit.type === "mount" ? "a mount" : `kind ${hit.entry.kind}`}`);
      }
      this._checkExpr(b.expr, ["t"], path, push);
      if (b.ease !== undefined) {
        if (!isObj(b.ease) || !isNum(b.ease.ms) || (b.ease.curve !== undefined && !["linear", "ease"].includes(b.ease.curve))) {
          push(DIAG.SD3, "error", path, "ease must be {ms, curve: linear|ease}");
        }
      }
    });

    // mount override exprs — each-mounts evaluate per item (design §2.8a)
    this.mounts().forEach((m, i) => {
      if (!isObj(m) || !isObj(m.state)) return;
      const locals = m.each !== undefined ? ["t", "item", "index"] : ["t"];
      for (const [f, e] of Object.entries(m.state)) this._checkExpr(e, locals, `mounts[${i}].state.${f}`, push);
    });

    // SD-7 wires
    this.wires().forEach((w, i) => {
      const path = `wires[${i}]`;
      if (!isObj(w)) { push(DIAG.SD7, "error", path, "malformed wire"); return; }
      const on = parseOn(w.on);
      if (!on) { push(DIAG.SD7, "error", path, `malformed on "${w.on}"`); return; }
      let locals = [];
      let looseLocals = false;
      if (nodeIds.has(on.id)) {
        if (!NODE_EVENTS.includes(on.event)) push(DIAG.SD7, "error", path, `unknown event "${on.event}"`);
        else {
          const need = AFFORDANCE_FOR[on.event];
          const node = this.byId(on.id).entry;
          if (!isObj(node.affordances) || !node.affordances[need]) push(DIAG.SD7, "warn", path, `${on.id} does not declare the "${need}" affordance`);
          if (need === "drag") locals = [...DRAG_LOCALS];
          // collection-instance events carry the item (design §2.8a)
          if (node.each !== undefined) locals.push("key", "item", "index");
        }
      } else if (mountIds.has(on.id)) {
        looseLocals = true; // child emits carry their `with` payload — unverifiable statically
      } else {
        push(DIAG.SD7, "error", path, `on refers to unknown id "${on.id}"`);
      }
      if (!Array.isArray(w.do) || w.do.length === 0) { push(DIAG.SD7, "warn", path, "wire has no actions"); return; }
      w.do.forEach((a, j) => this._checkAction(a, `${path}.do[${j}]`, locals, looseLocals, push));
    });

    return diags;
  }

  _checkExpr(src, locals, path, push, loose = false) {
    if (typeof src !== "string") { push(DIAG.SD6, "error", path, "expression must be a string"); return; }
    const p = parseExpr(src);
    if (!p.ok) { push(DIAG.SD6, "error", path, `expression error: ${p.error}`); return; }
    if (loose) return;
    const legal = this.stateNames();
    for (const d of p.deps) if (!legal.has(d) && !locals.includes(d)) push(DIAG.SD6, "error", path, `unknown identifier "${d}"`);
  }

  _checkAction(a, path, locals, loose, push) {
    if (!isObj(a)) { push(DIAG.SD7, "error", path, "malformed action"); return; }
    if (typeof a.set === "string") {
      if (!this.stateNames().has(a.set)) push(DIAG.SD7, "error", path, `set targets unknown state field "${a.set}"`);
      this._checkExpr(a.to, locals, path, push, loose);
    } else if (typeof a.invoke === "string") {
      if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(a.invoke)) push(DIAG.SD7, "error", path, `invoke must be "lib.ctl.cmd", got "${a.invoke}"`);
      if (isObj(a.args)) for (const [k, e] of Object.entries(a.args)) this._checkExpr(e, locals, `${path}.args.${k}`, push, loose);
      if (Array.isArray(a.then)) a.then.forEach((s, j) => {
        if (!isObj(s) || typeof s.set !== "string") { push(DIAG.SD7, "error", `${path}.then[${j}]`, "then steps are {set, to}"); return; }
        if (!this.stateNames().has(s.set)) push(DIAG.SD7, "error", `${path}.then[${j}]`, `set targets unknown state field "${s.set}"`);
        this._checkExpr(s.to, [...locals, "result"], `${path}.then[${j}]`, push, loose);
      });
    } else if (typeof a.emit === "string") {
      if (!NAME_RE.test(a.emit)) push(DIAG.SD7, "error", path, `malformed emit name "${a.emit}"`);
      if (isObj(a.with)) for (const [k, e] of Object.entries(a.with)) this._checkExpr(e, locals, `${path}.with.${k}`, push, loose);
    } else {
      push(DIAG.SD7, "error", path, "action must be one of set / invoke / emit");
    }
  }

  // ── mutations (in place; each returns {label, undo, redo} or {error}) ─────

  setProp(id, path, value) {
    const hit = this.byId(id);
    if (!hit) return { error: `no entry "${id}"` };
    const kind = hit.type === "node" ? hit.entry.kind : null;
    if (!editablePaths(hit.type, kind).has(path)) return { error: `"${path}" is not editable on ${hit.type === "mount" ? "a mount" : `kind ${kind}`}` };
    if (this.boundTargets().has(`${id}.${path}`)) return { error: `${id}.${path} is bound to an expression` };
    const want = propType(path, kind);
    if (want === "number" && !isNum(value)) return { error: `${path} takes a number` };
    if (want === "boolean" && typeof value !== "boolean") return { error: `${path} takes a boolean` };
    if (want === "string" && typeof value !== "string") return { error: `${path} takes a string` };
    const entry = hit.entry;
    let u = writeProp(entry, path, value);
    return { label: `set ${id}.${path}`, undo: () => u(), redo: () => { u = writeProp(entry, path, value); } };
  }

  /** Move as ONE mutation/undo step (a drag gesture is one gesture). */
  movePos(id, to) {
    const hit = this.byId(id);
    if (!hit) return { error: `no entry "${id}"` };
    const bound = this.boundTargets();
    for (const a of ["x", "y", "z"]) if (bound.has(`${id}.pos.${a}`)) return { error: `${id}.pos.${a} is bound to an expression` };
    if (![to.x, to.y, to.z].every(isNum)) return { error: "pos takes numbers" };
    const entry = hit.entry;
    const apply = () => ["x", "y", "z"].map((a) => writeProp(entry, `pos.${a}`, to[a]));
    let us = apply();
    return { label: `move ${id}`,
      undo: () => { for (let i = us.length - 1; i >= 0; i--) us[i](); },
      redo: () => { us = apply(); } };
  }

  addNode(raw) {
    if (!isObj(raw) || typeof raw.id !== "string") return { error: "node needs an id" };
    if (!NAME_RE.test(raw.id)) return { error: `malformed id "${raw.id}"` };
    if (this.byId(raw.id)) return { error: `id "${raw.id}" is taken` };
    if (!(raw.kind in KINDS)) return { error: `unknown kind "${raw.kind}"` };
    if (raw.parent !== undefined) {
      const p = this.byId(raw.parent);
      if (!p || p.type !== "node") return { error: `parent "${raw.parent}" is not a node` };
    }
    const root = this.root;
    let ea = ensureArr(root, "nodes");
    ea.arr.push(raw);
    return { label: `add ${raw.kind} ${raw.id}`, id: raw.id,
      undo: () => { const k = root.nodes.indexOf(raw); if (k >= 0) root.nodes.splice(k, 1); ea.undo(); },
      redo: () => { ea = ensureArr(root, "nodes"); ea.arr.push(raw); } };
  }

  /** Everything that would dangle if `id` vanished (also the delete preview). */
  referencesTo(id) {
    const out = [];
    const { nodes, mounts } = this.childrenOf(id);
    for (const n of nodes) out.push(`child node ${n.id}`);
    for (const m of mounts) out.push(`mount ${m.id}`);
    for (const b of this.bindings()) { const t = parseTarget(b && b.target); if (t && t.id === id) out.push(`binding ${b.target}`); }
    for (const w of this.wires()) { const o = parseOn(w && w.on); if (o && o.id === id) out.push(`wire ${w.on}`); }
    for (const n of this.nodes()) {
      if (isObj(n) && n.kind === "link" && n.id !== id && (n.from === id || n.to === id)) out.push(`link ${n.id}`);
    }
    return out;
  }

  removeNode(id) {
    const hit = this.byId(id);
    if (!hit || hit.type !== "node") return { error: `no node "${id}"` };
    const refs = this.referencesTo(id);
    if (refs.length) return { error: `"${id}" is referenced by ${refs.join(", ")}` };
    const arr = this.root.nodes;
    const idx = arr.indexOf(hit.entry);
    arr.splice(idx, 1);
    return { label: `remove ${id}`,
      undo: () => { arr.splice(idx, 0, hit.entry); },
      redo: () => { const k = arr.indexOf(hit.entry); if (k >= 0) arr.splice(k, 1); } };
  }

  addMount(raw) {
    if (!isObj(raw) || typeof raw.id !== "string") return { error: "mount needs an id" };
    if (!NAME_RE.test(raw.id)) return { error: `malformed id "${raw.id}"` };
    if (this.byId(raw.id)) return { error: `id "${raw.id}" is taken` };
    if (typeof raw.lib !== "string" || typeof raw.ctl !== "string" || !raw.lib || !raw.ctl) return { error: "mount needs lib and ctl" };
    if (raw.at !== undefined) {
      const p = this.byId(raw.at);
      if (!p || p.type !== "node") return { error: `at "${raw.at}" is not a node` };
    }
    const root = this.root;
    let ea = ensureArr(root, "mounts");
    ea.arr.push(raw);
    return { label: `mount ${raw.lib}.${raw.ctl} as ${raw.id}`, id: raw.id,
      undo: () => { const k = root.mounts.indexOf(raw); if (k >= 0) root.mounts.splice(k, 1); ea.undo(); },
      redo: () => { ea = ensureArr(root, "mounts"); ea.arr.push(raw); } };
  }

  /** field ∈ lib | ctl | at. `at: null` = back to root (deletes the key). */
  setMountField(id, field, value) {
    const hit = this.byId(id);
    if (!hit || hit.type !== "mount") return { error: `no mount "${id}"` };
    if (!["lib", "ctl", "at"].includes(field)) return { error: `unknown mount field "${field}"` };
    if (field === "at" && value !== null) {
      const p = this.byId(value);
      if (!p || p.type !== "node") return { error: `at "${value}" is not a node` };
    }
    if (field !== "at" && (typeof value !== "string" || !value)) return { error: `${field} takes a name` };
    const entry = hit.entry;
    const had = Object.prototype.hasOwnProperty.call(entry, field);
    const prev = entry[field];
    const apply = () => { if (field === "at" && value === null) delete entry.at; else entry[field] = value; };
    apply();
    return { label: `${id} ${field}`,
      undo: () => { if (had) entry[field] = prev; else delete entry[field]; },
      redo: apply };
  }

  removeMount(id) {
    const hit = this.byId(id);
    if (!hit || hit.type !== "mount") return { error: `no mount "${id}"` };
    const refs = this.referencesTo(id);
    if (refs.length) return { error: `"${id}" is referenced by ${refs.join(", ")}` };
    const arr = this.root.mounts;
    const idx = arr.indexOf(hit.entry);
    arr.splice(idx, 1);
    return { label: `unmount ${id}`,
      undo: () => { arr.splice(idx, 0, hit.entry); },
      redo: () => { const k = arr.indexOf(hit.entry); if (k >= 0) arr.splice(k, 1); } };
  }

  /** Rename a node/mount id, rewriting every reference (parents, at, binding
      targets, wire ons) in the SAME mutation — ids are semantic addresses. */
  renameId(oldId, newId) {
    const hit = this.byId(oldId);
    if (!hit) return { error: `no entry "${oldId}"` };
    if (!NAME_RE.test(newId)) return { error: `malformed id "${newId}"` };
    if (this.byId(newId)) return { error: `id "${newId}" is taken` };
    const doc = this;
    const apply = (from, to) => {
      hit.entry.id = to;
      for (const n of doc.nodes()) if (isObj(n) && n.parent === from) n.parent = to;
      for (const m of doc.mounts()) if (isObj(m) && m.at === from) m.at = to;
      for (const b of doc.bindings()) { const t = parseTarget(b && b.target); if (t && t.id === from) b.target = `${to}.${t.path}`; }
      for (const w of doc.wires()) { const o = parseOn(w && w.on); if (o && o.id === from) w.on = `${to}.${o.event}`; }
    };
    apply(oldId, newId);
    return { label: `rename ${oldId} → ${newId}`,
      undo: () => apply(newId, oldId),
      redo: () => apply(oldId, newId) };
  }

  setParent(id, parentId) {
    const hit = this.byId(id);
    if (!hit || hit.type !== "node") return { error: `no node "${id}"` };
    if (parentId !== null) {
      const p = this.byId(parentId);
      if (!p || p.type !== "node") return { error: `parent "${parentId}" is not a node` };
      let cur = p.entry;
      while (cur) {
        if (cur.id === id) return { error: "that would make a parent cycle" };
        cur = cur.parent !== undefined ? (this.byId(cur.parent) || {}).entry : null;
      }
    }
    const entry = hit.entry;
    const had = Object.prototype.hasOwnProperty.call(entry, "parent");
    const prev = entry.parent;
    const apply = () => { if (parentId === null) delete entry.parent; else entry.parent = parentId; };
    apply();
    return { label: `reparent ${id}`,
      undo: () => { if (had) entry.parent = prev; else delete entry.parent; },
      redo: apply };
  }

  setAffordance(id, key, value) {
    const hit = this.byId(id);
    if (!hit || hit.type !== "node") return { error: `no node "${id}"` };
    if (!["tap", "drag", "hover"].includes(key)) return { error: `unknown affordance "${key}"` };
    if (key === "drag" && value !== null && !(isObj(value) && ["xz", "xy", "yz"].includes(value.plane))) return { error: "drag takes {plane: xz|xy|yz}" };
    if (key !== "drag" && value !== null && value !== true) return { error: `${key} takes true or null` };
    const entry = hit.entry;
    const apply = () => {
      const undos = [];
      if (value === null) {
        if (isObj(entry.affordances) && key in entry.affordances) {
          const prev = entry.affordances[key];
          delete entry.affordances[key];
          const emptied = Object.keys(entry.affordances).length === 0;
          const aff = entry.affordances;
          if (emptied) delete entry.affordances;
          undos.push(() => { if (emptied) entry.affordances = aff; entry.affordances[key] = prev; });
        }
      } else {
        undos.push(writeProp(entry, `affordances.${key}`, value));
      }
      return undos;
    };
    let us = apply();
    return { label: `${value === null ? "clear" : "set"} ${id} ${key}`,
      undo: () => { for (let i = us.length - 1; i >= 0; i--) us[i](); },
      redo: () => { us = apply(); } };
  }

  addState(field) {
    if (!isObj(field) || !NAME_RE.test(field.name || "")) return { error: "state field needs a well-formed name" };
    if (this.stateNames().has(field.name)) return { error: `state field "${field.name}" exists` };
    if (!STATE_TYPES.includes(field.type)) return { error: `unknown type "${field.type}"` };
    if (field.type !== "json" && typeof field.value !== field.type) return { error: `default is not a ${field.type}` };
    const root = this.root;
    let ea = ensureArr(root, "state");
    ea.arr.push(field);
    return { label: `add state ${field.name}`,
      undo: () => { const k = root.state.indexOf(field); if (k >= 0) root.state.splice(k, 1); ea.undo(); },
      redo: () => { ea = ensureArr(root, "state"); ea.arr.push(field); } };
  }

  removeState(name) {
    const arr = this.root.state;
    const idx = Array.isArray(arr) ? arr.findIndex((f) => isObj(f) && f.name === name) : -1;
    if (idx < 0) return { error: `no state field "${name}"` };
    const users = [];
    for (const e of this._allExprs()) {
      const p = parseExpr(e.expr);
      if (p.ok && p.deps.has(name)) users.push(e.where);
    }
    for (const w of this.wires()) if (isObj(w) && Array.isArray(w.do)) {
      const scan = (a, where) => {
        if (!isObj(a)) return;
        if (a.set === name) users.push(where);
        if (Array.isArray(a.then)) for (const s of a.then) if (isObj(s) && s.set === name) users.push(`${where} (then)`);
      };
      for (const a of w.do) scan(a, `wire ${w.on}`);
    }
    for (const m of this.mounts()) if (isObj(m) && isObj(m.state) && name in m.state) { /* override KEY is the child's field — not ours */ }
    for (const e of this.eachSources(name)) users.push(`each on ${e.id}`);
    if (users.length) return { error: `"${name}" is used by ${[...new Set(users)].join(", ")}` };
    const field = arr[idx];
    arr.splice(idx, 1);
    return { label: `remove state ${name}`,
      undo: () => { arr.splice(idx, 0, field); },
      redo: () => { const k = arr.indexOf(field); if (k >= 0) arr.splice(k, 1); } };
  }

  setStateDefault(name, value) {
    const f = this.stateFields().find((x) => isObj(x) && x.name === name);
    if (!f) return { error: `no state field "${name}"` };
    if (f.type !== "json" && typeof value !== f.type) return { error: `default is not a ${f.type}` };
    const prev = f.value;
    f.value = value;
    return { label: `default ${name}`, undo: () => { f.value = prev; }, redo: () => { f.value = value; } };
  }

  /** Replace-only by target (the Q7 idiom). ease: {ms, curve?} or undefined. */
  setBinding(target, expr, ease) {
    const t = parseTarget(target);
    if (!t) return { error: `malformed target "${target}"` };
    const hit = this.byId(t.id);
    if (!hit) return { error: `no entry "${t.id}"` };
    const legal = hit.type === "mount" ? MOUNT_BIND : bindablePaths(hit.entry.kind);
    if (!legal.includes(t.path)) return { error: `"${t.path}" is not bindable here` };
    const p = parseExpr(expr);
    if (!p.ok) return { error: `expression error: ${p.error}` };
    if (ease !== undefined && !(isObj(ease) && isNum(ease.ms))) return { error: "ease takes {ms, curve?}" };
    const root = this.root;
    const existing = this.bindings().find((b) => isObj(b) && b.target === target);
    if (existing) {
      const prev = { expr: existing.expr, hadEase: "ease" in existing, ease: existing.ease };
      const apply = () => { existing.expr = expr; if (ease === undefined) delete existing.ease; else existing.ease = ease; };
      apply();
      return { label: `bind ${target}`,
        undo: () => { existing.expr = prev.expr; if (prev.hadEase) existing.ease = prev.ease; else delete existing.ease; },
        redo: apply };
    }
    const b = ease === undefined ? { target, expr } : { target, expr, ease };
    let ea = ensureArr(root, "bindings");
    ea.arr.push(b);
    return { label: `bind ${target}`,
      undo: () => { const k = root.bindings.indexOf(b); if (k >= 0) root.bindings.splice(k, 1); ea.undo(); },
      redo: () => { ea = ensureArr(root, "bindings"); ea.arr.push(b); } };
  }

  removeBinding(target) {
    const arr = this.root.bindings;
    const idx = Array.isArray(arr) ? arr.findIndex((b) => isObj(b) && b.target === target) : -1;
    if (idx < 0) return { error: `no binding for ${target}` };
    const b = arr[idx];
    arr.splice(idx, 1);
    return { label: `unbind ${target}`,
      undo: () => { arr.splice(idx, 0, b); },
      redo: () => { const k = arr.indexOf(b); if (k >= 0) arr.splice(k, 1); } };
  }

  setMountOverride(mountId, field, expr) {
    const hit = this.byId(mountId);
    if (!hit || hit.type !== "mount") return { error: `no mount "${mountId}"` };
    if (!NAME_RE.test(field)) return { error: `malformed field "${field}"` };
    if (expr !== null) {
      const p = parseExpr(expr);
      if (!p.ok) return { error: `expression error: ${p.error}` };
    }
    const entry = hit.entry;
    const apply = () => {
      if (expr === null) {
        if (isObj(entry.state) && field in entry.state) {
          const prev = entry.state[field];
          delete entry.state[field];
          const emptied = Object.keys(entry.state).length === 0;
          const st = entry.state;
          if (emptied) delete entry.state;
          return [() => { if (emptied) entry.state = st; entry.state[field] = prev; }];
        }
        return [];
      }
      return [writeProp(entry, `state.${field}`, expr)];
    };
    let us = apply();
    return { label: `${expr === null ? "clear" : "set"} ${mountId}.${field}`,
      undo: () => { for (let i = us.length - 1; i >= 0; i--) us[i](); },
      redo: () => { us = apply(); } };
  }

  addWire(wire) {
    if (!isObj(wire) || !parseOn(wire.on)) return { error: "wire needs on: \"id.event\"" };
    if (!Array.isArray(wire.do) || wire.do.length === 0) return { error: "wire needs at least one action" };
    const root = this.root;
    let ea = ensureArr(root, "wires");
    ea.arr.push(wire);
    return { label: `wire ${wire.on}`,
      undo: () => { const k = root.wires.indexOf(wire); if (k >= 0) root.wires.splice(k, 1); ea.undo(); },
      redo: () => { ea = ensureArr(root, "wires"); ea.arr.push(wire); } };
  }

  removeWire(index) {
    const arr = this.root.wires;
    if (!Array.isArray(arr) || !arr[index]) return { error: "no such wire" };
    const w = arr[index];
    arr.splice(index, 1);
    return { label: `unwire ${w.on}`,
      undo: () => { arr.splice(index, 0, w); },
      redo: () => { const k = arr.indexOf(w); if (k >= 0) arr.splice(k, 1); } };
  }

  setEnv(key, value) {
    if (!["lights", "grid", "camera"].includes(key)) return { error: `unknown env key "${key}"` };
    const root = this.root;
    const apply = () => {
      const undos = [];
      if (value === null) {
        if (isObj(root.env) && key in root.env) {
          const prev = root.env[key];
          delete root.env[key];
          const emptied = Object.keys(root.env).length === 0;
          const env = root.env;
          if (emptied) delete root.env;
          undos.push(() => { if (emptied) root.env = env; root.env[key] = prev; });
        }
      } else {
        undos.push(writeProp(root, `env.${key}`, value));
      }
      return undos;
    };
    let us = apply();
    return { label: `env ${key}`,
      undo: () => { for (let i = us.length - 1; i >= 0; i--) us[i](); },
      redo: () => { us = apply(); } };
  }
}

/** Parse a scene facet (object or string) into a SceneDoc. Never throws;
    a broken document arrives with diagnostics (design §2.9). */
export function parse(input) {
  let raw = input;
  if (typeof input === "string") {
    try { raw = JSON.parse(input); } catch (e) {
      return new SceneDoc({}, [{ code: DIAG.SD3, severity: "error", path: "scene", message: `not valid JSON: ${e.message}` }]);
    }
  }
  if (!isObj(raw)) {
    return new SceneDoc({}, [{ code: DIAG.SD3, severity: "error", path: "scene", message: "scene facet must be a JSON object" }]);
  }
  return new SceneDoc(raw, []);
}
