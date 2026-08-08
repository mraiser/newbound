// flowdoc.js — the flowlang Case model: pure data. No DOM, no THREE, no
// network. Parses a Case JSON into a normalized, validated model (the
// authoritative language description is docs/flow3d-design.md Part I), and
// produces DIAGNOSTICS (I-1…I-10 + structural), never rejections — the editor
// must be able to open a broken flow to fix it (design §4.4).
//
// Requiredness follows the real codec, not the serde derives (flow3d-design
// review R-1): Case.{input,output,cmds,cons} and Operation.{name,type,pos,
// width,in,out} are required; Node.{mode,type,x} are required in practice
// (Node::from_data panics when absent). Missing requireds are filled with the
// interpreter's from_data defaults AND flagged, so projection always sees a
// clean model while the inspector can show what's wrong.
//
// This module is the read-only viewer's model (3D-1). Mutations-with-inverses
// and the journaled save path are 3D-2 (gated on read_flow_body/
// write_flow_body being [live] — CONTRACT §6).

export const DIAG = {
  STRUCT: "struct",       // a from_data-required field was absent
  I1_UNWIRED: "I-1",      // input terminal without exactly one incoming wire
  I2_CYCLE: "I-2",        // a wire cycle (the propagation loop would hang)
  I4_NEXT: "I-4",         // `next` rule with no nextcase in the chain
  I5_MATCH: "I-5",        // match op: !=1 input, or an object/array ctype
  I6_PERSIST: "I-6",      // persistent op: more than one input
  I7_MULTIOUT: "I-7",     // command call with >1 output (positional-map fragile)
  I8_LOOP: "I-8",         // loop output's `loop` names no input on the same op
  I10_COND: "I-10",       // a condition on a constant (dead data)
};

const OP_TYPES = new Set([
  "primitive", "command", "local", "constant", "match", "persistent", "undefined",
]);
const MATCH_CTYPES = new Set(["int", "decimal", "boolean", "string", "null"]);

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const num = (v, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);

/** Normalize one Node, recording a struct diagnostic per missing required
    field. Returns { node, missing:[...] }. */
function normNode(raw, diags, path) {
  const src = isObj(raw) ? raw : {};
  const node = {};
  for (const f of ["mode", "type", "x"]) {
    if (!(f in src)) diags.push({ code: DIAG.STRUCT, severity: "warn", path,
      message: `Node.${f} absent — from_data would panic; defaulted` });
  }
  node.mode = typeof src.mode === "string" ? src.mode : "";
  node.type = typeof src.type === "string" ? src.type : "";
  node.x = num(src.x, 0);
  if (src.list !== undefined && src.list !== null) node.list = src.list;
  if (src.loop !== undefined && src.loop !== null) node.loop = src.loop;
  return node;
}

function normNodeMap(raw, diags, path) {
  const out = {};
  if (isObj(raw)) for (const [k, v] of Object.entries(raw)) out[k] = normNode(v, diags, `${path}.${k}`);
  return out;
}

function normOp(raw, diags, path) {
  const src = isObj(raw) ? raw : {};
  const op = {};
  if (typeof src.name !== "string") diags.push({ code: DIAG.STRUCT, severity: "warn", path, message: "Operation.name absent" });
  op.name = typeof src.name === "string" ? src.name : "";
  if (typeof src.type !== "string" || !OP_TYPES.has(src.type)) {
    diags.push({ code: DIAG.STRUCT, severity: src.type ? "warn" : "warn", path,
      message: `Operation.type ${src.type ? `"${src.type}" is not a known type` : "absent"}` });
  }
  op.type = typeof src.type === "string" ? src.type : "undefined";
  const pos = isObj(src.pos) ? src.pos : {};
  if (!isObj(src.pos)) diags.push({ code: DIAG.STRUCT, severity: "warn", path, message: "Operation.pos absent" });
  else for (const a of ["x", "y", "z"]) if (!(a in pos)) diags.push({ code: DIAG.STRUCT, severity: "warn", path, message: `Operation.pos.${a} absent (I-9: z is required)` });
  op.pos = { x: num(pos.x), y: num(pos.y), z: num(pos.z) };
  if (!("width" in src)) diags.push({ code: DIAG.STRUCT, severity: "warn", path, message: "Operation.width absent" });
  op.width = num(src.width, 1.5);
  op.in = normNodeMap(src.in, diags, `${path}.in`);
  op.out = normNodeMap(src.out, diags, `${path}.out`);
  // optional, preserved verbatim
  if (src.ctype !== undefined) op.ctype = src.ctype;
  if (src.cmd !== undefined) op.cmd = src.cmd;
  if (src.condition !== undefined && isObj(src.condition)) op.condition = { value: !!src.condition.value, rule: src.condition.rule };
  if (isObj(src.localdata)) op.localdata = normCase(src.localdata, diags, `${path}.local`);
  // preserve any unknown fields (design §4.4 side-map; none in known data)
  for (const [k, v] of Object.entries(src)) {
    if (!(k in op) && !["pos", "in", "out", "condition", "localdata"].includes(k)) op[k] = v;
  }
  return op;
}

function normCase(raw, diags, path) {
  const src = isObj(raw) ? raw : {};
  const c = {};
  for (const f of ["input", "output", "cmds", "cons"]) {
    if (!(f in src)) diags.push({ code: DIAG.STRUCT, severity: "warn", path, message: `Case.${f} absent` });
  }
  c.input = normNodeMap(src.input, diags, `${path}.input`);
  c.output = normNodeMap(src.output, diags, `${path}.output`);
  c.cmds = Array.isArray(src.cmds) ? src.cmds.map((op, i) => normOp(op, diags, `${path}.cmds[${i}]`)) : [];
  c.cons = Array.isArray(src.cons) ? src.cons.map((con) => normCon(con)) : [];
  if (isObj(src.nextcase)) c.nextcase = normCase(src.nextcase, diags, `${path}.next`);
  return c;
}

function normCon(raw) {
  const src = isObj(raw) ? raw : {};
  const pair = (a) => Array.isArray(a) ? [a[0], a[1]] : [undefined, undefined];
  return { src: pair(src.src), dest: pair(src.dest) };
}

// ── semantic validation (I-1…I-10) over one case (not recursing) ────────────
function validateCase(c, path, hasNextInChain, diags) {
  const N = c.cmds.length;

  // I-1: every input terminal carries exactly one incoming wire.
  c.cmds.forEach((op, i) => {
    for (const term of Object.keys(op.in)) {
      const feeders = c.cons.filter((w) => w.dest[0] === i && w.dest[1] === term);
      if (feeders.length !== 1) {
        diags.push({ code: DIAG.I1_UNWIRED, severity: "warn", path, opIndex: i, terminal: term,
          message: feeders.length === 0
            ? `input “${term}” of op ${i} (${op.name}) is unwired`
            : `input “${term}” of op ${i} (${op.name}) has ${feeders.length} incoming wires (fan-in must be 1)` });
      }
    }
  });

  // I-2: no wire cycle among op indices (bars -1/-2 are not nodes).
  const adj = new Map();
  for (const w of c.cons) {
    const s = w.src[0], d = w.dest[0];
    if (s >= 0 && d >= 0) { if (!adj.has(s)) adj.set(s, []); adj.get(s).push(d); }
  }
  const color = new Array(N).fill(0); // 0 white 1 grey 2 black
  let cyc = false;
  const dfs = (u) => {
    color[u] = 1;
    for (const v of adj.get(u) || []) { if (color[v] === 1) { cyc = true; } else if (color[v] === 0) dfs(v); }
    color[u] = 2;
  };
  for (let i = 0; i < N; i++) if (color[i] === 0) dfs(i);
  if (cyc) diags.push({ code: DIAG.I2_CYCLE, severity: "error", path, message: "wire cycle — the propagation loop would hang" });

  // per-op semantic checks
  c.cmds.forEach((op, i) => {
    const inCount = Object.keys(op.in).length;
    const outCount = Object.keys(op.out).length;
    // I-5: match op
    if (op.type === "match") {
      if (inCount !== 1) diags.push({ code: DIAG.I5_MATCH, severity: "warn", path, opIndex: i, message: `match op ${i} has ${inCount} inputs (needs exactly 1)` });
      if (op.ctype && !MATCH_CTYPES.has(op.ctype)) diags.push({ code: DIAG.I5_MATCH, severity: "warn", path, opIndex: i, message: `match op ${i} has ctype “${op.ctype}” (object/array matchers always fail)` });
    }
    // I-6: persistent op
    if (op.type === "persistent" && inCount > 1) diags.push({ code: DIAG.I6_PERSIST, severity: "warn", path, opIndex: i, message: `persistent op ${i} has ${inCount} inputs (write order is nondeterministic; keep to ≤1)` });
    // I-7: multi-output command call (positional mapping over unordered keys)
    if (op.type === "command" && outCount > 1) diags.push({ code: DIAG.I7_MULTIOUT, severity: "info", path, opIndex: i, message: `command op ${i} maps ${outCount} outputs positionally over unordered callee keys — order-fragile` });
    // I-8: loop pairing
    for (const [term, node] of Object.entries(op.out)) {
      if (node.mode === "loop") {
        const pair = node.loop;
        if (!pair || !(pair in op.in)) diags.push({ code: DIAG.I8_LOOP, severity: "warn", path, opIndex: i, terminal: term, message: `loop output “${term}” of op ${i} names input “${pair ?? "—"}”, which is not an input on this op` });
      }
    }
    // I-10: a condition on a constant is dead data (never fires)
    if (op.type === "constant" && op.condition) diags.push({ code: DIAG.I10_COND, severity: "warn", path, opIndex: i, message: `condition on constant op ${i} never fires (interpreter skips it)` });
    // I-4: a `next` rule requires a nextcase somewhere in the chain
    if (op.condition && op.condition.rule === "next" && !hasNextInChain) diags.push({ code: DIAG.I4_NEXT, severity: "error", path, opIndex: i, message: `op ${i} raises “next” but the case chain has no next case (interpreter panics)` });
  });
}

/** Walk the root case + its nextcase chain + every localdata sub-case. cb
    receives (case, path, hasNextInChain). */
function walkCases(root, cb) {
  const visit = (c, path, chainHasNext) => {
    cb(c, path, chainHasNext);
    c.cmds.forEach((op, i) => { if (op.localdata) visit(op.localdata, `${path}.cmds[${i}].local`, chainHasNext || !!op.localdata.nextcase); });
    if (c.nextcase) visit(c.nextcase, `${path}.next`, !!(c.nextcase.nextcase));
  };
  visit(root, "case", !!root.nextcase);
}

export class FlowDoc {
  constructor(root, structDiags) {
    this.root = root;
    this._struct = structDiags;
  }

  /** All diagnostics: structural (from parse) + semantic (I-1…I-10). */
  diagnostics() {
    const out = [...this._struct];
    walkCases(this.root, (c, path, chainHasNext) => validateCase(c, path, chainHasNext, out));
    return out;
  }

  /** Diagnostics for a single case path only (inspector's current-case lints). */
  diagnosticsFor(path) {
    return this.diagnostics().filter((d) => d.path === path);
  }

  cases() { const acc = []; walkCases(this.root, (c, path) => acc.push({ path, case: c })); return acc; }

  /** Re-emit the model as a plain Case JSON, R-1-compliant (every Node carries
      mode/type/x; every Operation carries pos.{x,y,z}/width/in/out). Round-trips
      STRUCTURES, not bytes — the store re-serializes canonically (R-2). */
  serialize() { return emitCase(this.root); }

  // ── mutations (design §4.1/§5.3/§5.4) ──────────────────────────────────────
  // Each applies immediately and returns a reversible command
  // {label, undo, redo} (or {error} when an invariant refuses it). The undo
  // stack lives in the editor; invariant enforcement lives here.

  /** Move op i of case c to a new {x,y,z}. */
  moveOp(c, i, to) {
    const op = c.cmds[i]; if (!op) return { error: "no such op" };
    const from = { ...op.pos };
    op.pos = { x: to.x, y: to.y, z: to.z };
    return { label: `move ${op.name || "op"}`, undo: () => { op.pos = { ...from }; }, redo: () => { op.pos = { x: to.x, y: to.y, z: to.z }; } };
  }

  /** Resize op i to a new width (min 0.6, §5.3). */
  resizeOp(c, i, width) {
    const op = c.cmds[i]; if (!op) return { error: "no such op" };
    const from = op.width, w = Math.max(0.6, width);
    op.width = w;
    return { label: `resize ${op.name || "op"}`, undo: () => { op.width = from; }, redo: () => { op.width = w; } };
  }

  /** Move a terminal along its edge → the node's x. i = op index, or -1 (input
      bar) / -2 (output bar). which = "in" | "out". Clamped for op terminals to
      ±(width/2 − 0.1). */
  moveTerminal(c, i, which, term, x) {
    const node = termNode(c, i, which, term);
    if (!node) return { error: "no such terminal" };
    let nx = x;
    if (i >= 0) { const half = c.cmds[i].width / 2 - 0.1; nx = Math.max(-half, Math.min(half, x)); }
    const from = node.x; node.x = nx;
    return { label: `move terminal ${term}`, undo: () => { node.x = from; }, redo: () => { node.x = nx; } };
  }

  /** Add a connection, enforcing I-1 (fan-in 1) and I-2 (no cycle, §5.4). */
  addWire(c, con) {
    const chk = this.canWire(c, con.src, con.dest);
    if (!chk.ok) return { error: chk.reason };
    const wire = { src: [con.src[0], con.src[1]], dest: [con.dest[0], con.dest[1]] };
    c.cons.push(wire);
    return { label: `wire ${wireLabel(c, wire)}`,
      undo: () => { const k = c.cons.indexOf(wire); if (k >= 0) c.cons.splice(k, 1); },
      redo: () => { if (c.cons.indexOf(wire) < 0) c.cons.push(wire); } };
  }

  /** Remove the connection at index idx. */
  removeWire(c, idx) {
    const wire = c.cons[idx]; if (!wire) return { error: "no such wire" };
    c.cons.splice(idx, 1);
    return { label: `unwire ${wireLabel(c, wire)}`,
      undo: () => { c.cons.splice(idx, 0, wire); },
      redo: () => { const k = c.cons.indexOf(wire); if (k >= 0) c.cons.splice(k, 1); } };
  }

  // ── authoring mutations (3D-3, design §5.5) ────────────────────────────────

  /** Append a new operation (normalized to R-1 shape). The new index is
      cmds.length — appending never disturbs existing cons indices. */
  addOp(c, rawOp) {
    const idx = c.cmds.length;
    const op = normOp(rawOp, [], `add.cmds[${idx}]`);
    c.cmds.push(op);
    return { label: `add ${op.name || op.type}`, index: idx,
      undo: () => { c.cmds.splice(idx, 1); },
      redo: () => { c.cmds.splice(idx, 0, op); } };
  }

  /** Wires touching op i (for the delete preview). */
  wiresTouching(c, i) {
    return c.cons.filter((w) => w.src[0] === i || w.dest[0] === i).length;
  }

  /** Remove op i: drops its wires and REWRITES cons indices > i in the same
      mutation (§6.3 — indices are semantic addresses). Undo re-inserts the
      SAME wire objects and un-shifts indices in place, so composed undos
      (which find wires by identity) stay sound. */
  removeOp(c, i) {
    const op = c.cmds[i]; if (!op) return { error: "no such op" };
    const removed = []; // [position, wire], ascending
    const apply = () => {
      removed.length = 0;
      c.cmds.splice(i, 1);
      for (let k = c.cons.length - 1; k >= 0; k--) {
        const w = c.cons[k];
        if (w.src[0] === i || w.dest[0] === i) { removed.unshift([k, w]); c.cons.splice(k, 1); }
      }
      for (const w of c.cons) {
        if (w.src[0] > i) w.src[0]--;
        if (w.dest[0] > i) w.dest[0]--;
      }
    };
    apply();
    return { label: `delete ${op.name || op.type}`,
      undo: () => {
        for (const w of c.cons) {
          if (w.src[0] >= i) w.src[0]++;
          if (w.dest[0] >= i) w.dest[0]++;
        }
        for (const [k, w] of removed) c.cons.splice(k, 0, w);
        c.cmds.splice(i, 0, op);
      },
      redo: apply };
  }

  /** Rename an op (constants: the name IS the literal; persistents: the slot). */
  renameOp(c, i, name) {
    const op = c.cmds[i]; if (!op) return { error: "no such op" };
    const from = op.name; op.name = name;
    const what = op.type === "constant" || op.type === "match" ? "literal"
      : op.type === "persistent" ? "slot" : "name";
    return { label: `edit ${what} → ${String(name).slice(0, 24)}`,
      undo: () => { op.name = from; }, redo: () => { op.name = name; } };
  }

  /** Set a constant/matcher's ctype (I-5 restricts matchers). */
  setCtype(c, i, ctype) {
    const op = c.cmds[i]; if (!op) return { error: "no such op" };
    if (op.type !== "constant" && op.type !== "match") return { error: "ctype applies to constants/matchers" };
    if (op.type === "match" && !MATCH_CTYPES.has(ctype)) return { error: "object/array matchers always fail (I-5)" };
    const from = op.ctype; op.ctype = ctype;
    return { label: `ctype → ${ctype}`, undo: () => { op.ctype = from; }, redo: () => { op.ctype = ctype; } };
  }

  /** constant ⇄ match. ON: ensures the single input `a` and a legal ctype.
      OFF: back to constant, removing all inputs and their feeding wires. */
  setMatcher(c, i, on) {
    const op = c.cmds[i]; if (!op) return { error: "no such op" };
    if (op.type !== "constant" && op.type !== "match") return { error: "not a constant/matcher" };
    if (on === (op.type === "match")) return { error: "no change" };
    const fromType = op.type, fromCtype = op.ctype, fromIn = op.in;
    const removed = []; // [position, wire] — identity-preserving
    const apply = () => {
      removed.length = 0;
      if (on) {
        op.type = "match";
        if (!Object.keys(op.in).length) op.in = { a: { mode: "", type: "", x: 0 } };
        if (!MATCH_CTYPES.has(op.ctype)) op.ctype = "string";
        // a condition on the former constant was dead (I-10) — it now arms.
      } else {
        op.type = "constant"; op.ctype = fromCtype;
        op.in = {};
        for (let k = c.cons.length - 1; k >= 0; k--) {
          if (c.cons[k].dest[0] === i) { removed.unshift([k, c.cons[k]]); c.cons.splice(k, 1); }
        }
      }
    };
    apply();
    return { label: on ? "constant → matcher" : "matcher → constant",
      undo: () => {
        op.type = fromType; op.ctype = fromCtype; op.in = fromIn;
        for (const [k, w] of removed) c.cons.splice(k, 0, w);
      },
      redo: apply };
  }

  /** Set/clear an op's condition. Refuses on constants (I-10 — it would be
      dead data) and refuses rule "next" when the chain has no next case
      (I-4 — the interpreter panics; acceptance 4 makes it unrepresentable). */
  setCondition(c, i, cond, { chainHasNext = false } = {}) {
    const op = c.cmds[i]; if (!op) return { error: "no such op" };
    if (cond && op.type === "constant") return { error: "conditions never fire on constants (I-10)" };
    if (cond && cond.rule === "next" && !chainHasNext) return { error: "no next case in the chain (I-4) — add a case first" };
    const from = op.condition ? { ...op.condition } : undefined;
    const to = cond ? { value: !!cond.value, rule: cond.rule } : undefined;
    const set = (v) => { if (v) op.condition = { ...v }; else delete op.condition; };
    set(to);
    return { label: cond ? `condition → ${cond.rule} on ${cond.value}` : "clear condition",
      undo: () => set(from), redo: () => set(to) };
  }

  /** Add a terminal. i ≥ 0 (op) or -1/-2 (bars — the signature). Name must be
      unique per side (I-3). Allocates the next free x slot. */
  addTerminal(c, i, which, name, type = "") {
    const map = termMap(c, i, which); if (!map) return { error: "no such side" };
    if (name in map) return { error: `terminal “${name}” exists (I-3)` };
    const xs = Object.values(map).map((n) => n.x || 0);
    const x = xs.length ? Math.max(...xs) + 0.4 : 0;
    map[name] = { mode: "", type, x };
    return { label: `add ${which === "in" ? "input" : "output"} ${name}`,
      undo: () => { delete map[name]; }, redo: () => { map[name] = { mode: "", type, x }; } };
  }

  /** Remove a terminal + every wire referencing it (identity-preserving). */
  removeTerminal(c, i, which, name) {
    const map = termMap(c, i, which); if (!map || !(name in map)) return { error: "no such terminal" };
    const node = map[name];
    const side = sideOf(i, which);
    const removed = []; // [position, wire]
    const apply = () => {
      removed.length = 0;
      delete map[name];
      for (let k = c.cons.length - 1; k >= 0; k--) {
        const w = c.cons[k];
        const hit = side === "src" ? (w.src[0] === i && w.src[1] === name) : (w.dest[0] === i && w.dest[1] === name);
        if (hit) { removed.unshift([k, w]); c.cons.splice(k, 1); }
      }
    };
    apply();
    return { label: `delete terminal ${name}`,
      undo: () => { map[name] = node; for (const [k, w] of removed) c.cons.splice(k, 0, w); },
      redo: apply };
  }

  /** Rename a terminal, rewriting the cons entries that address it (and loop
      pairings that name it). On a bar this renames the command's
      parameter/return — the bars are the signature. */
  renameTerminal(c, i, which, oldName, newName) {
    const map = termMap(c, i, which); if (!map || !(oldName in map)) return { error: "no such terminal" };
    if (newName in map) return { error: `terminal “${newName}” exists (I-3)` };
    const side = sideOf(i, which);
    const rename = (from, to) => {
      // rebuild preserving key order (order is presentation-stable, not semantic)
      const next = {};
      for (const [k, v] of Object.entries(map)) next[k === from ? to : k] = v;
      for (const k of Object.keys(map)) delete map[k];
      Object.assign(map, next);
      for (const w of c.cons) {
        if (side === "src" && w.src[0] === i && w.src[1] === from) w.src[1] = to;
        if (side === "dest" && w.dest[0] === i && w.dest[1] === from) w.dest[1] = to;
      }
      // I-8 pairing: loop outputs of op i that named this input follow the rename
      if (i >= 0 && which === "in") {
        for (const n of Object.values(c.cmds[i].out)) if (n.loop === from) n.loop = to;
      }
    };
    rename(oldName, newName);
    return { label: `rename ${oldName} → ${newName}`,
      undo: () => rename(newName, oldName), redo: () => rename(oldName, newName) };
  }

  /** Set a terminal's mode: regular · list · loop. A loop OUTPUT must name an
      existing input on the same op (I-8 pairing). */
  setTerminalMode(c, i, which, term, mode, pair) {
    const map = termMap(c, i, which); if (!map || !(term in map)) return { error: "no such terminal" };
    const node = map[term];
    if (mode === "loop" && which === "out") {
      if (i < 0) return { error: "bars don’t loop" };
      if (!pair || !(pair in c.cmds[i].in)) return { error: "a loop output must name an input on this op (I-8)" };
    }
    const from = { mode: node.mode, loop: node.loop };
    const apply = (v) => {
      node.mode = v.mode;
      if (v.loop !== undefined) node.loop = v.loop; else delete node.loop;
    };
    const to = { mode, loop: mode === "loop" && which === "out" ? pair : undefined };
    apply(to);
    return { label: `terminal ${term} → ${mode}${to.loop ? ` ⟲ ${to.loop}` : ""}`,
      undo: () => apply(from), redo: () => apply(to) };
  }

  /** Set a terminal's declared type (on bars this types the signature). */
  setTerminalType(c, i, which, term, type) {
    const map = termMap(c, i, which); if (!map || !(term in map)) return { error: "no such terminal" };
    const node = map[term], from = node.type;
    node.type = type;
    return { label: `type ${term} → ${type || "—"}`, undo: () => { node.type = from; }, redo: () => { node.type = type; } };
  }

  /** Splice op n into wire w (§5.4): the wire's dest reattaches to n's first
      input; n's first output wires to the old dest. */
  spliceIntoWire(c, wireIdx, n) {
    const wire = c.cons[wireIdx]; if (!wire) return { error: "no such wire" };
    const op = c.cmds[n]; if (!op) return { error: "no such op" };
    const firstIn = Object.keys(op.in)[0], firstOut = Object.keys(op.out)[0];
    if (!firstIn || !firstOut) return { error: "the op needs an input and an output to splice" };
    // the two replacement wires are created once and reused on redo; undo puts
    // the ORIGINAL wire object back — identity-preserving for composed undos.
    const wA = { src: [wire.src[0], wire.src[1]], dest: [n, firstIn] };
    const wB = { src: [n, firstOut], dest: [wire.dest[0], wire.dest[1]] };
    const label = `splice ${op.name || op.type} into ${wireLabel(c, wire)}`;
    const apply = () => { c.cons.splice(wireIdx, 1, wA, wB); };
    apply();
    return { label,
      undo: () => { c.cons.splice(wireIdx, 2, wire); },
      redo: apply };
  }

  /** Append a case to the chain rooted at `root`. The new deck copies the
      root's bars (a chain shares its signature — nextcase runs with the same
      args) and starts empty. */
  addCase(root) {
    let last = root; while (last.nextcase) last = last.nextcase;
    const copyBars = (m) => Object.fromEntries(Object.entries(m).map(([k, n]) => [k, { mode: n.mode, type: n.type, x: n.x }]));
    const fresh = { input: copyBars(root.input), output: copyBars(root.output), cmds: [], cons: [] };
    last.nextcase = fresh;
    return { label: "add case", undo: () => { delete last.nextcase; }, redo: () => { last.nextcase = fresh; } };
  }

  /** Remove deck k from the chain, splicing it out. Refused when the case
      that would become last still contains a `next` rule (I-4 — nothing left
      to jump to). k=0 shifts the next case's fields into the root object so
      external references to the root stay valid. */
  removeCase(root, k) {
    const chain = []; let c = root; while (c) { chain.push(c); c = c.nextcase; }
    if (chain.length < 2) return { error: "a flow needs at least one case" };
    if (k < 0 || k >= chain.length) return { error: "no such case" };
    const newLast = chain[k === chain.length - 1 ? chain.length - 2 : chain.length - 1];
    if (hasNextRule(newLast) && (k === chain.length - 1)) {
      return { error: "the case that would become last raises “next” (I-4) — clear it first" };
    }
    const removed = chain[k];
    const snapshot = { ...root };
    const apply = () => {
      if (k === 0) {
        const next = root.nextcase;
        root.input = next.input; root.output = next.output;
        root.cmds = next.cmds; root.cons = next.cons;
        if (next.nextcase) root.nextcase = next.nextcase; else delete root.nextcase;
      } else {
        const parent = chain[k - 1];
        if (removed.nextcase) parent.nextcase = removed.nextcase; else delete parent.nextcase;
      }
    };
    apply();
    return { label: `delete case ${k + 1}`,
      undo: () => {
        if (k === 0) {
          root.input = snapshot.input; root.output = snapshot.output;
          root.cmds = snapshot.cmds; root.cons = snapshot.cons;
          if (snapshot.nextcase) root.nextcase = snapshot.nextcase; else delete root.nextcase;
        } else {
          chain[k - 1].nextcase = removed;
        }
      },
      redo: apply };
  }

  /** Apply a layout proposal (assets/flowlayout.js) as ONE mutation — the
      whole arrangement is a single undo step / journal label (§7.1). */
  applyLayout(c, positions, label = "auto-layout") {
    if (!Array.isArray(positions) || positions.length !== c.cmds.length) return { error: "proposal doesn't match the case" };
    const from = c.cmds.map((op) => ({ ...op.pos }));
    const apply = () => c.cmds.forEach((op, i) => { if (positions[i]) op.pos = { x: positions[i].x, y: positions[i].y, z: positions[i].z }; });
    apply();
    return { label,
      undo: () => c.cmds.forEach((op, i) => { op.pos = { ...from[i] }; }),
      redo: apply };
  }

  /** Would src→dest be a legal wire? {ok} or {ok:false, reason} (I-1, I-2). */
  canWire(c, src, dest) {
    const [si, st] = src, [di, dt] = dest;
    // dest must be an input slot: an op input terminal, or the return bar (-2)
    if (di === -2) { if (!(dt in c.output)) return { ok: false, reason: "no such return terminal" }; }
    else if (di >= 0) { if (!c.cmds[di] || !(dt in c.cmds[di].in)) return { ok: false, reason: "no such input terminal" }; }
    else return { ok: false, reason: "can’t wire into the params bar" };
    // src must be a source: an op output terminal, or the params bar (-1)
    if (si === -1) { if (!(st in c.input)) return { ok: false, reason: "no such param" }; }
    else if (si >= 0) { if (!c.cmds[si] || !(st in c.cmds[si].out)) return { ok: false, reason: "no such output terminal" }; }
    else return { ok: false, reason: "can’t wire from the return bar" };
    if (si >= 0 && si === di) return { ok: false, reason: "can’t wire an op to itself" };
    // I-1: the dest slot must be unwired (fan-in is 1)
    if (c.cons.some((w) => w.dest[0] === di && w.dest[1] === dt)) return { ok: false, reason: "input already wired" };
    // I-2: adding si→di must not close a cycle
    if (si >= 0 && di >= 0 && reaches(c, di, si)) return { ok: false, reason: "would create a cycle" };
    return { ok: true };
  }
}

function termNode(c, i, which, term) {
  if (i === -1) return c.input[term];
  if (i === -2) return c.output[term];
  const op = c.cmds[i]; if (!op) return null;
  return which === "in" ? op.in[term] : op.out[term];
}

/** The terminal map for (index, side). Bars: -1 = the params bar (its
    terminals act as sources), -2 = the return bar (sinks) — `which` is
    ignored for bars. */
function termMap(c, i, which) {
  if (i === -1) return c.input;
  if (i === -2) return c.output;
  const op = c.cmds[i]; if (!op) return null;
  return which === "in" ? op.in : op.out;
}

/** Which cons slot addresses this terminal: op outputs + the params bar are
    wire SOURCES; op inputs + the return bar are wire DESTS. */
function sideOf(i, which) {
  if (i === -1) return "src";
  if (i === -2) return "dest";
  return which === "out" ? "src" : "dest";
}

/** Does this case (or any local sub-case inside it) carry a `next` rule? */
function hasNextRule(c) {
  return (c.cmds || []).some((op) =>
    (op.condition && op.condition.rule === "next") ||
    (op.localdata && hasNextRule(op.localdata)));
}

function opName(c, idx) {
  if (idx === -1) return "params";
  if (idx === -2) return "return";
  return c.cmds[idx]?.name || `op${idx}`;
}
function wireLabel(c, w) {
  return `${opName(c, w.src[0])}.${w.src[1]} → ${opName(c, w.dest[0])}.${w.dest[1]}`;
}

/** The delivery schedule the propagation loop would produce (§1.5), as rounds
    of wire indices — the substrate for execution-token animation (3D-5,
    design §3.5). Pure emulation of the sweep: a wire fires when its source is
    available (the params bar, or a completed op); an op completes when every
    WIRED input has been delivered (ops with none evaluate up front). Wires
    that can never fire (broken flows — I-1/I-2 states) are returned in
    `unreached` rather than animated; the real interpreter would hang on them. */
export function propagationRounds(c) {
  const N = c.cmds.length;
  // §1.5 step 3, exactly: a terminal is pre-marked done iff its NAME appears
  // as no connection's dest name — the match is GLOBAL and name-only (the
  // I-1 sharp edge: an unwired input whose name is wired elsewhere waits
  // forever). So an op needs a delivery for each input whose name is a dest
  // name anywhere in the case.
  const globalDest = new Set(c.cons.map((w) => w.dest[1]));
  const need = c.cmds.map((op) => Object.keys(op.in).filter((n) => globalDest.has(n)).length);
  const filled = c.cmds.map(() => new Set());
  const done = c.cmds.map((_, i) => need[i] === 0);
  const fired = new Set();
  const rounds = [];
  for (let guard = 0; guard <= c.cons.length + 1; guard++) {
    const round = [];
    c.cons.forEach((w, k) => {
      if (fired.has(k)) return;
      const s = w.src[0];
      if (s === -1 || (s >= 0 && s < N && done[s])) round.push(k);
    });
    if (!round.length) break;
    for (const k of round) {
      fired.add(k);
      const d = c.cons[k].dest[0];
      if (d >= 0 && d < N) {
        filled[d].add(c.cons[k].dest[1]);
        if (filled[d].size >= need[d]) done[d] = true;
      }
    }
    rounds.push(round);
  }
  const unreached = c.cons.map((_, k) => k).filter((k) => !fired.has(k));
  return { rounds, unreached };
}

/** Is `to` (op index) reachable from `from` (op index) along cons edges? */
function reaches(c, from, to) {
  const adj = new Map();
  for (const w of c.cons) if (w.src[0] >= 0 && w.dest[0] >= 0) (adj.get(w.src[0]) || adj.set(w.src[0], []).get(w.src[0])).push(w.dest[0]);
  const seen = new Set(), stack = [from];
  while (stack.length) { const u = stack.pop(); if (u === to) return true; if (seen.has(u)) continue; seen.add(u); for (const v of adj.get(u) || []) stack.push(v); }
  return false;
}

function emitNode(n) {
  const o = { mode: n.mode ?? "", type: n.type ?? "", x: num(n.x, 0) };
  if (n.list !== undefined) o.list = n.list;
  if (n.loop !== undefined) o.loop = n.loop;
  return o;
}
function emitNodeMap(m) { const o = {}; for (const [k, v] of Object.entries(m)) o[k] = emitNode(v); return o; }
function emitOp(op) {
  const o = {
    name: op.name ?? "", type: op.type ?? "undefined",
    pos: { x: num(op.pos?.x), y: num(op.pos?.y), z: num(op.pos?.z) },
    width: num(op.width, 1.5),
    in: emitNodeMap(op.in || {}), out: emitNodeMap(op.out || {}),
  };
  if (op.ctype !== undefined) o.ctype = op.ctype;
  if (op.cmd !== undefined) o.cmd = op.cmd;
  if (op.condition !== undefined) o.condition = { value: !!op.condition.value, rule: op.condition.rule };
  if (op.localdata) o.localdata = emitCase(op.localdata);
  for (const [k, v] of Object.entries(op)) if (!(k in o)) o[k] = v;
  return o;
}
function emitCase(c) {
  const o = {
    input: emitNodeMap(c.input || {}), output: emitNodeMap(c.output || {}),
    cmds: (c.cmds || []).map(emitOp),
    cons: (c.cons || []).map((w) => ({ src: [w.src[0], w.src[1]], dest: [w.dest[0], w.dest[1]] })),
  };
  if (c.nextcase) o.nextcase = emitCase(c.nextcase);
  return o;
}

/** Parse a Case JSON (object or string) into a FlowDoc. Strict on Part I
    requireds (diagnostics, never throws for a structurally-off document). */
export function parse(input) {
  let raw = input;
  if (typeof input === "string") {
    try { raw = JSON.parse(input); } catch (e) { raw = {}; return new FlowDoc(normCase({}, [], "case"), [{ code: DIAG.STRUCT, severity: "error", path: "case", message: `body is not valid JSON: ${e.message}` }]); }
  }
  const diags = [];
  const root = normCase(raw, diags, "case");
  return new FlowDoc(root, diags);
}

// ── structural diff (3D-P3: the journal strip's "what changed") ─────────────
// A flow diff should speak the GRAPH's vocabulary, not JSON's: "wired
// first.a -> second.a", not a line of braces. Pure — two bodies in, a flat
// list of changes out; the editor renders it, tools/flow3d-check tests it.
//
// Op identity is the hard part: the schema has no op ids (cons reference
// ARRAY INDICES), so an op removed from the middle renumbers everything
// after it. Matching therefore runs in two passes — unique name+type first,
// then leftovers paired in index order (which is what surfaces a rename) —
// and wires are compared by the resulting stable pairing, not by index, so
// a rename or a middle insertion doesn't spray false wire changes.

const terminalName = (c, idx) =>
  idx === -1 ? "params" : idx === -2 ? "return" : (c.cmds[idx]?.name || `op${idx}`);

/** Pair ops between two cases. Returns {pairs:[[a,b]], addedB, removedA}. */
function matchOps(A, B) {
  const key = (o) => `${o.name} ${o.type}`;
  const tally = (L) => L.reduce((m, o) => m.set(key(o), (m.get(key(o)) || 0) + 1), new Map());
  const ta = tally(A), tb = tally(B);
  const slotsB = new Map();
  B.forEach((o, i) => { const k = key(o); if (!slotsB.has(k)) slotsB.set(k, []); slotsB.get(k).push(i); });
  const pairs = [], usedA = new Set(), usedB = new Set();
  A.forEach((o, i) => {
    const k = key(o);
    if (ta.get(k) === 1 && tb.get(k) === 1) {
      const j = slotsB.get(k)[0];
      pairs.push([i, j]); usedA.add(i); usedB.add(j);
    }
  });
  const restA = A.map((_, i) => i).filter((i) => !usedA.has(i));
  const restB = B.map((_, i) => i).filter((i) => !usedB.has(i));
  const n = Math.min(restA.length, restB.length);
  for (let k = 0; k < n; k++) pairs.push([restA[k], restB[k]]);
  return { pairs, removedA: restA.slice(n), addedB: restB.slice(n) };
}

const termSig = (map) => Object.entries(map || {})
  .map(([k, v]) => `${k}:${v.type || "?"}${v.mode && v.mode !== "regular" ? `/${v.mode}` : ""}`)
  .sort().join(", ");

function diffNodeMaps(a, b, what, out, deck) {
  const ka = Object.keys(a || {}), kb = Object.keys(b || {});
  for (const k of kb) if (!(k in (a || {}))) out.push({ deck, kind: "sig", text: `${what} + ${k}:${b[k].type || "?"}` });
  for (const k of ka) if (!(k in (b || {}))) out.push({ deck, kind: "sig", text: `${what} drop ${k}` });
  for (const k of ka) {
    if (!(k in (b || {}))) continue;
    if ((a[k].type || "") !== (b[k].type || "")) out.push({ deck, kind: "sig", text: `${what} ${k}: ${a[k].type || "?"} to ${b[k].type || "?"}` });
    if ((a[k].mode || "") !== (b[k].mode || "")) out.push({ deck, kind: "sig", text: `${what} ${k} mode: ${a[k].mode || "regular"} to ${b[k].mode || "regular"}` });
  }
}

function diffCase(A, B, deck, out) {
  diffNodeMaps(A.input, B.input, "params", out, deck);
  diffNodeMaps(A.output, B.output, "return", out, deck);

  const { pairs, removedA, addedB } = matchOps(A.cmds, B.cmds);
  for (const i of removedA) out.push({ deck, kind: "op-", text: `removed ${A.cmds[i].type} ${A.cmds[i].name || `op${i}`}` });
  for (const j of addedB) out.push({ deck, kind: "op+", text: `added ${B.cmds[j].type} ${B.cmds[j].name || `op${j}`}` });

  for (const [i, j] of pairs) {
    const a = A.cmds[i], b = B.cmds[j], id = b.name || a.name || `op${j}`;
    if (a.name !== b.name) out.push({ deck, kind: "op~", text: `renamed ${a.name || `op${i}`} to ${b.name}` });
    if (a.type !== b.type) out.push({ deck, kind: "op~", text: `${id}: ${a.type} to ${b.type}` });
    const moved = ["x", "y", "z"].some((k) => Math.abs(a.pos[k] - b.pos[k]) > 1e-9);
    if (moved) out.push({ deck, kind: "op~", text: `moved ${id} to (${b.pos.x.toFixed(2)}, ${b.pos.y.toFixed(2)}, ${b.pos.z.toFixed(2)})` });
    if (Math.abs(a.width - b.width) > 1e-9) out.push({ deck, kind: "op~", text: `resized ${id} ${a.width} to ${b.width}` });
    if ((a.ctype || "") !== (b.ctype || "")) out.push({ deck, kind: "op~", text: `${id} ctype: ${a.ctype || "none"} to ${b.ctype || "none"}` });
    if ((a.cmd || "") !== (b.cmd || "")) out.push({ deck, kind: "op~", text: `${id} target: ${a.cmd || "none"} to ${b.cmd || "none"}` });
    const cond = (o) => o.condition ? `${o.condition.rule} when ${o.condition.value}` : "none";
    if (cond(a) !== cond(b)) out.push({ deck, kind: "op~", text: `${id} condition: ${cond(a)} to ${cond(b)}` });
    if (termSig(a.in) !== termSig(b.in)) out.push({ deck, kind: "op~", text: `${id} inputs: ${termSig(a.in) || "none"} to ${termSig(b.in) || "none"}` });
    if (termSig(a.out) !== termSig(b.out)) out.push({ deck, kind: "op~", text: `${id} outputs: ${termSig(a.out) || "none"} to ${termSig(b.out) || "none"}` });
    // local sub-flows are SUMMARIZED, not recursed — a drill-in is the place
    // to read a sub-case, and an unbounded nested diff would bury the strip
    const la = a.localdata ? JSON.stringify(emitCase(a.localdata)) : "";
    const lb = b.localdata ? JSON.stringify(emitCase(b.localdata)) : "";
    if (la !== lb) out.push({ deck, kind: "op~", text: la && lb ? `${id}: local sub-flow changed` : lb ? `${id}: local sub-flow added` : `${id}: local sub-flow removed` });
  }

  // wires by the STABLE pairing, so renames/renumbering don't fake changes
  const slotA = new Map(pairs.map(([i], s) => [i, s]));
  const slotB = new Map(pairs.map(([, j], s) => [j, s]));
  const wkey = (w, slots, side) => {
    const end = (idx, term) => idx < 0 ? `${idx === -1 ? "params" : "return"}.${term}`
      : `${slots.has(idx) ? `#${slots.get(idx)}` : `${side}${idx}`}.${term}`;
    return `${end(w.src[0], w.src[1])} ${end(w.dest[0], w.dest[1])}`;
  };
  const label = (c, w) => `${terminalName(c, w.src[0])}.${w.src[1]} to ${terminalName(c, w.dest[0])}.${w.dest[1]}`;
  const ka = new Map(), kb = new Map();
  A.cons.forEach((w) => ka.set(wkey(w, slotA, "a"), w));
  B.cons.forEach((w) => kb.set(wkey(w, slotB, "b"), w));
  for (const [k, w] of kb) if (!ka.has(k)) out.push({ deck, kind: "wire+", text: `wired ${label(B, w)}` });
  for (const [k, w] of ka) if (!kb.has(k)) out.push({ deck, kind: "wire-", text: `unwired ${label(A, w)}` });
}

/** Diff two flow bodies (objects or JSON strings) into a flat change list.
    Returns {changes:[{deck, kind, text}], counts:{added, removed, changed}}.
    `kind` is one of op+/op-/op~/wire+/wire-/sig/deck+/deck-. */
export function diffFlow(oldBody, newBody) {
  const A = parse(oldBody).root, B = parse(newBody).root;
  const chain = (c) => { const out = []; while (c) { out.push(c); c = c.nextcase; } return out; };
  const ca = chain(A), cb = chain(B);
  const changes = [];
  for (let d = 0; d < Math.max(ca.length, cb.length); d++) {
    if (!ca[d]) { changes.push({ deck: d, kind: "deck+", text: `case ${d + 1} added` }); continue; }
    if (!cb[d]) { changes.push({ deck: d, kind: "deck-", text: `case ${d + 1} removed` }); continue; }
    diffCase(ca[d], cb[d], d, changes);
  }
  const counts = { added: 0, removed: 0, changed: 0 };
  for (const c of changes) {
    if (c.kind.endsWith("+")) counts.added++;
    else if (c.kind.endsWith("-")) counts.removed++;
    else counts.changed++;
  }
  return { changes, counts };
}
