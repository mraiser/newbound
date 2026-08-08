// sceneproject.js — pure projection: a SceneDoc (+ the runtime's computed
// binding values) → renderer specs for scenestage (scene-facet-design Part
// IV). No DOM, no THREE, no network — node-testable. The stage owns the
// group hierarchy; this module owns WHAT exists: one spec per node/mount,
// parent by id, resolved transforms/materials/params.
//
// `computed` is a Map of "id.path" → value (the runtime's current binding
// results, UNPREFIXED — each doc instance evaluates in its own state world).
// `prefix`/`parent` compose mounted child scenes: child ids become
// "<mountId>:<id>" and child roots hang off the mount's spec, so a flattened
// multi-doc scene stays one flat spec list with unique ids.
//
// Collections (design §2.8a): entries with `each` are TEMPLATES. project()
// skips them (`templates: "skip"`, the runtime instantiates via
// instanceSpec) or emits a ghost gizmo (`templates: "gizmo"`, the editor's
// build view). instanceSpec() builds one instance's spec from the template
// plus a per-instance override map (the runtime's evaluated `props`).

import { readProp, KINDS, MATERIAL_KINDS } from "./scenedoc.js";
import { resolveMaterial } from "./scenetokens.js";

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

function propOf(entry, kind, path, computed, id) {
  if (computed && computed.has(`${id}.${path}`)) return computed.get(`${id}.${path}`);
  return readProp(entry, path, kind);
}

function vec(entry, kind, base, computed, id) {
  return {
    x: propOf(entry, kind, `${base}.x`, computed, id),
    y: propOf(entry, kind, `${base}.y`, computed, id),
    z: propOf(entry, kind, `${base}.z`, computed, id),
  };
}

/** One node's spec. `id` may differ from entry.id (collection instances). */
function nodeSpec(n, opts) {
  const { computed, theme, prefix, parentRoot, id } = opts;
  const key = n.id; // computed/override maps are keyed by the TEMPLATE id
  const spec = {
    id: prefix + (id ?? n.id),
    kind: n.kind,
    parent: n.parent !== undefined ? prefix + n.parent : parentRoot,
    pos: vec(n, n.kind, "pos", computed, key),
    rot: vec(n, n.kind, "rot", computed, key),
    scale: vec(n, n.kind, "scale", computed, key),
    visible: propOf(n, n.kind, "visible", computed, key) !== false,
  };
  if (MATERIAL_KINDS.has(n.kind)) {
    const mat = isObj(n.material) ? { ...n.material } : {};
    const tok = propOf(n, n.kind, "material.token", computed, key);
    const op = propOf(n, n.kind, "material.opacity", computed, key);
    // material.color: the spec's literal escape (§2.3) made COMPUTABLE, so a
    // data-driven hue (the peer app tints an orb by transport and staleness)
    // can be an expression like any other prop. Tokens remain the norm —
    // they are what themes re-skin; a computed colour opts out by choice.
    const col = propOf(n, n.kind, "material.color", computed, key);
    if (typeof col === "string" && col) mat.color = col;
    if (tok !== undefined) mat.token = tok;
    if (op !== undefined && op !== 1) mat.opacity = op; else delete mat.opacity;
    spec.material = resolveMaterial(mat, theme);
  }
  if (n.kind === "link") {
    // endpoints are instance-id STRINGS in stage space — prefix them so a
    // child scene's links stay inside that child's namespace
    const from = propOf(n, "link", "from", computed, key);
    const to = propOf(n, "link", "to", computed, key);
    spec.from = from ? prefix + from : "";
    spec.to = to ? prefix + to : "";
    return spec;
  }
  const params = {};
  for (const p of Object.keys(KINDS[n.kind].params)) {
    const v = propOf(n, n.kind, p, computed, key);
    const dot = p.indexOf(".");
    if (dot >= 0) {
      const [head, tail] = [p.slice(0, dot), p.slice(dot + 1)];
      if (!params[head]) params[head] = {};
      params[head][tail] = v;
    } else params[p] = v;
  }
  if (Object.keys(params).length) spec.params = params;
  if (n.kind === "light") {
    spec.light = { mode: propOf(n, "light", "mode", computed, key) || "ambient",
      intensity: propOf(n, "light", "intensity", computed, key) };
    if (isObj(n.dir)) spec.light.dir = { x: n.dir.x ?? 0, y: n.dir.y ?? -1, z: n.dir.z ?? 0 };
  }
  if (n.kind === "text") {
    spec.text = { text: String(params.text ?? ""), size: Number(params.size ?? 1) };
    delete spec.params;
  }
  if (isObj(n.affordances)) spec.affordances = n.affordances;
  return spec;
}

function mountSpec(m, opts) {
  const { computed, prefix, parentRoot, id } = opts;
  const key = m.id;
  return {
    id: prefix + (id ?? m.id),
    kind: "mountpoint",
    parent: m.at !== undefined ? prefix + m.at : parentRoot,
    pos: vec(m, null, "pos", computed, key),
    rot: vec(m, null, "rot", computed, key),
    scale: vec(m, null, "scale", computed, key),
    visible: propOf(m, null, "visible", computed, key) !== false,
  };
}

/** Project one doc into stage specs.
    opts: { computed?: Map, theme?: "light"|"dark", prefix?: string,
            parent?: string|null, templates?: "skip"|"gizmo" } */
export function project(doc, opts = {}) {
  const o = {
    computed: opts.computed,
    theme: opts.theme || "light",
    prefix: opts.prefix || "",
    parentRoot: opts.parent ?? null,
    id: undefined,
  };
  const templates = opts.templates || "skip";
  const specs = [];

  for (const n of doc.nodes()) {
    if (!isObj(n) || typeof n.id !== "string" || !(n.kind in KINDS)) continue;
    if (n.each !== undefined) {
      if (templates === "gizmo") {
        // the editor's build-view ghost: one mountpoint gizmo standing in
        // for the whole collection (instantiation is a runtime behavior)
        specs.push({ id: o.prefix + n.id, kind: "mountpoint",
          parent: n.parent !== undefined ? o.prefix + n.parent : o.parentRoot,
          pos: vec(n, n.kind, "pos", o.computed, n.id),
          rot: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, visible: true });
      }
      continue;
    }
    specs.push(nodeSpec(n, o));
  }

  for (const m of doc.mounts()) {
    if (!isObj(m) || typeof m.id !== "string") continue;
    if (m.each !== undefined) {
      if (templates === "gizmo") specs.push(mountSpec(m, o));
      continue;
    }
    specs.push(mountSpec(m, o));
  }

  return specs;
}

/** One collection instance's spec (design §2.8a). `overrides` is a Map of
    "<templateId>.<path>" → evaluated props value; the instance id is
    "<templateId>:<key>". Mount templates yield a mountpoint spec (the
    runtime hangs the child scene off it). */
export function instanceSpec(doc, entry, type, instKey, overrides, opts = {}) {
  const o = {
    computed: overrides,
    theme: opts.theme || "light",
    prefix: opts.prefix || "",
    parentRoot: opts.parent ?? null,
    id: `${entry.id}:${instKey}`,
  };
  return type === "mount" ? mountSpec(entry, o) : nodeSpec(entry, o);
}

/** Doc-level environment, defaults applied (design §2.8). Child-mounted docs'
    env is ignored — the root owns the environment. */
export function envOf(doc) {
  const env = doc.env();
  return {
    lights: env.lights === "none" ? "none" : "default",
    grid: env.grid !== false,
    camera: isObj(env.camera) ? env.camera : null,
  };
}

/** Translate a doc-path change into a stage delta (the runtime's helper):
    transforms/visible pass straight through; material.* re-resolves the
    whole material; kind params re-emit the params/text block. Returns
    {path, value} for stage.applyDelta, or null when the whole entry needs
    re-projection. */
export function deltaFor(doc, id, path, computed, theme) {
  const hit = doc.byId(id);
  if (!hit) return null;
  const kind = hit.type === "node" ? hit.entry.kind : "mountpoint";
  if (/^(pos|rot|scale)\.[xyz]$/.test(path) || path === "visible") {
    return { path, value: propOf(hit.entry, kind, path, computed, id) };
  }
  if (path === "from" || path === "to") {
    return { path, value: propOf(hit.entry, kind, path, computed, id) };
  }
  if (path.startsWith("material.")) {
    if (!MATERIAL_KINDS.has(kind)) return null;
    const mat = isObj(hit.entry.material) ? { ...hit.entry.material } : {};
    const tok = propOf(hit.entry, kind, "material.token", computed, id);
    const op = propOf(hit.entry, kind, "material.opacity", computed, id);
    const col = propOf(hit.entry, kind, "material.color", computed, id);
    if (typeof col === "string" && col) mat.color = col;
    if (tok !== undefined) mat.token = tok;
    if (op !== undefined && op !== 1) mat.opacity = op; else delete mat.opacity;
    return { path: "material", value: resolveMaterial(mat, theme || "light") };
  }
  if (kind === "text") {
    if (path === "text") return { path: "text", value: String(propOf(hit.entry, kind, "text", computed, id)) };
    if (path === "size") return { path: "size", value: Number(propOf(hit.entry, kind, "size", computed, id)) };
  }
  if (kind === "light" && path === "intensity") {
    return { path: "light.intensity", value: Number(propOf(hit.entry, kind, "intensity", computed, id)) };
  }
  const params = KINDS[kind] ? KINDS[kind].params : null;
  if (params && path in params) {
    const dot = path.indexOf(".");
    const value = propOf(hit.entry, kind, path, computed, id);
    return { path: `params.${path}`, value, geometry: true, head: dot >= 0 ? path.slice(0, dot) : path };
  }
  return null;
}
