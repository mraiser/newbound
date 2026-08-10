// sceneexpr.js — the scene facet's expression language (scene-facet-design
// §2.6). Total, pure, side-effect-free, parsed by THIS parser — no eval, no
// new Function, anywhere (design acceptance 2). Pure data: no DOM, no THREE,
// no network.
//
// Grammar (precedence low→high):
//   ternary ?:  ·  ||  ·  &&  ·  == !=  ·  < <= > >=  ·  + -  ·  * / %
//   ·  unary - !  ·  primary (number, 'str'/"str", true false null,
//   identifier, call fn(args), parenthesized)
//
// Identifiers resolve against a caller-supplied scope (state fields, `t`,
// wire-event locals); `PI` is a constant. Free identifiers are reported as
// `deps` so callers can (a) classify them against what's legal in their
// context (scenedoc SD-6) and (b) re-evaluate only when a dependency changes
// (scenerun). Function names are not deps.
//
// Semantics: `==`/`!=` are strict; `+` concatenates when either side is a
// string, else numeric; truthiness is JS-like; `&&`/`||`/`?:` short-circuit.
// Eval never throws to callers — evalExpr returns {ok, value|error}; a
// failed eval keeps the property's last good value (design §2.6).
//
// LIBRARY control — headless: defines window.NB_SCENEEXPR once (idempotent across
// installs). Consumers list this control as a hidden data-control child
// div and use the global from their ready.

var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function () {
  if (window.NB_SCENEEXPR) return;
  window.NB_SCENEEXPR = (function () {

const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, atan2: Math.atan2,
  sqrt: Math.sqrt, abs: Math.abs, min: Math.min, max: Math.max,
  clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
  lerp: (a, b, k) => a + (b - a) * k,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  pow: Math.pow, sign: Math.sign,
  deg: (x) => x * 180 / Math.PI, rad: (x) => x * Math.PI / 180,
};
const ARITY = {
  sin: 1, cos: 1, tan: 1, atan2: 2, sqrt: 1, abs: 1, min: 2, max: 2,
  clamp: 3, lerp: 3, floor: 1, ceil: 1, round: 1, pow: 2, sign: 1,
  deg: 1, rad: 1,
};
const CONSTANTS = { PI: Math.PI };

// ── tokenizer ───────────────────────────────────────────────────────────────
const PUNCT = ["||", "&&", "==", "!=", "<=", ">=", "<", ">", "+", "-", "*",
  "/", "%", "!", "?", ":", "(", ")", ",", "."];

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") { i++; continue; }
    if (ch >= "0" && ch <= "9" || (ch === "." && src[i + 1] >= "0" && src[i + 1] <= "9")) {
      const m = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(src.slice(i));
      toks.push({ t: "num", v: Number(m[0]), pos: i }); i += m[0].length; continue;
    }
    if (ch === "'" || ch === '"') {
      let j = i + 1, out = "";
      while (j < src.length && src[j] !== ch) {
        if (src[j] === "\\" && j + 1 < src.length) {
          const e = src[j + 1];
          out += e === "n" ? "\n" : e === "t" ? "\t" : e; j += 2;
        } else { out += src[j]; j++; }
      }
      if (j >= src.length) throw { message: "unterminated string", pos: i };
      toks.push({ t: "str", v: out, pos: i }); i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      toks.push({ t: "ident", v: m[0], pos: i }); i += m[0].length; continue;
    }
    const p = PUNCT.find((op) => src.startsWith(op, i));
    if (p) { toks.push({ t: p, pos: i }); i += p.length; continue; }
    throw { message: `unexpected character "${ch}"`, pos: i };
  }
  toks.push({ t: "end", pos: src.length });
  return toks;
}

// ── parser (recursive descent) ──────────────────────────────────────────────
function parseTokens(toks) {
  let k = 0;
  const peek = () => toks[k];
  const eat = (t) => {
    if (toks[k].t !== t) throw { message: `expected "${t}", got "${toks[k].t === "end" ? "end of expression" : toks[k].t}"`, pos: toks[k].pos };
    return toks[k++];
  };

  function ternary() {
    const cond = or();
    if (peek().t === "?") {
      eat("?"); const a = ternary(); eat(":"); const b = ternary();
      return { k: "?:", cond, a, b };
    }
    return cond;
  }
  const binary = (next, ops) => () => {
    let left = next();
    while (ops.includes(peek().t)) {
      const op = toks[k++].t;
      left = { k: "bin", op, l: left, r: next() };
    }
    return left;
  };
  const or = binary(() => and(), ["||"]);
  const and = binary(() => eq(), ["&&"]);
  const eq = binary(() => cmp(), ["==", "!="]);
  const cmp = binary(() => add(), ["<", "<=", ">", ">="]);
  const add = binary(() => mul(), ["+", "-"]);
  const mul = binary(() => unary(), ["*", "/", "%"]);
  function unary() {
    if (peek().t === "-") { k++; return { k: "neg", v: unary() }; }
    if (peek().t === "!") { k++; return { k: "not", v: unary() }; }
    return primary();
  }
  function primary() {
    return members(atom());
  }
  // postfix member access on json values: item.displayname (design §2.8a)
  function members(base) {
    while (peek().t === ".") {
      eat(".");
      const nameTok = eat("ident");
      base = { k: "member", obj: base, name: nameTok.v };
    }
    return base;
  }
  function atom() {
    const tok = peek();
    if (tok.t === "num") { k++; return { k: "lit", v: tok.v }; }
    if (tok.t === "str") { k++; return { k: "lit", v: tok.v }; }
    if (tok.t === "ident") {
      k++;
      if (tok.v === "true") return { k: "lit", v: true };
      if (tok.v === "false") return { k: "lit", v: false };
      if (tok.v === "null") return { k: "lit", v: null };
      if (peek().t === "(") {
        if (!(tok.v in FUNCTIONS)) throw { message: `unknown function "${tok.v}"`, pos: tok.pos };
        eat("(");
        const args = [];
        if (peek().t !== ")") { args.push(ternary()); while (peek().t === ",") { eat(","); args.push(ternary()); } }
        eat(")");
        if (args.length !== ARITY[tok.v]) throw { message: `${tok.v}() takes ${ARITY[tok.v]} argument${ARITY[tok.v] === 1 ? "" : "s"}`, pos: tok.pos };
        return { k: "call", fn: tok.v, args };
      }
      if (tok.v in CONSTANTS) return { k: "lit", v: CONSTANTS[tok.v] };
      return { k: "ref", name: tok.v };
    }
    if (tok.t === "(") { eat("("); const e = ternary(); eat(")"); return e; }
    throw { message: tok.t === "end" ? "unexpected end of expression" : `unexpected "${tok.t}"`, pos: tok.pos };
  }

  const ast = ternary();
  eat("end");
  return ast;
}

function collectDeps(ast, out) {
  if (!ast || typeof ast !== "object") return;
  if (ast.k === "ref") { out.add(ast.name); return; }
  if (ast.k === "member") { collectDeps(ast.obj, out); return; }
  if (ast.k === "call") { for (const a of ast.args) collectDeps(a, out); return; }
  if (ast.k === "bin") { collectDeps(ast.l, out); collectDeps(ast.r, out); return; }
  if (ast.k === "?:") { collectDeps(ast.cond, out); collectDeps(ast.a, out); collectDeps(ast.b, out); return; }
  if (ast.k === "neg" || ast.k === "not") collectDeps(ast.v, out);
}

/** Parse an expression. Returns {ok:true, ast, deps:Set} or
    {ok:false, error, pos}. Never throws. */
function parse(src) {
  if (typeof src !== "string" || src.trim() === "") {
    return { ok: false, error: "empty expression", pos: 0 };
  }
  try {
    const ast = parseTokens(tokenize(src));
    const deps = new Set();
    collectDeps(ast, deps);
    return { ok: true, ast, deps };
  } catch (e) {
    return { ok: false, error: e.message || String(e), pos: e.pos ?? 0 };
  }
}

function ev(ast, scope) {
  switch (ast.k) {
    case "lit": return ast.v;
    case "ref": {
      if (!(ast.name in scope)) throw { message: `unknown identifier "${ast.name}"` };
      return scope[ast.name];
    }
    case "member": {
      const obj = ev(ast.obj, scope);
      if (obj === null || typeof obj !== "object") throw { message: `"${ast.name}" of a non-object` };
      return Object.prototype.hasOwnProperty.call(obj, ast.name) ? obj[ast.name] : null;
    }
    case "call": return FUNCTIONS[ast.fn](...ast.args.map((a) => Number(ev(a, scope))));
    case "neg": return -Number(ev(ast.v, scope));
    case "not": return !ev(ast.v, scope);
    case "?:": return ev(ast.cond, scope) ? ev(ast.a, scope) : ev(ast.b, scope);
    case "bin": {
      const op = ast.op;
      if (op === "&&") return ev(ast.l, scope) && ev(ast.r, scope);
      if (op === "||") return ev(ast.l, scope) || ev(ast.r, scope);
      const a = ev(ast.l, scope), b = ev(ast.r, scope);
      switch (op) {
        case "==": return a === b;
        case "!=": return a !== b;
        case "<": return a < b; case "<=": return a <= b;
        case ">": return a > b; case ">=": return a >= b;
        case "+": return (typeof a === "string" || typeof b === "string") ? String(a) + String(b) : Number(a) + Number(b);
        case "-": return Number(a) - Number(b);
        case "*": return Number(a) * Number(b);
        case "/": return Number(a) / Number(b);
        case "%": return Number(a) % Number(b);
      }
    }
  }
  throw { message: "malformed expression tree" };
}

/** Evaluate a parsed ast against a scope object. Returns {ok:true, value} or
    {ok:false, error} — never throws (a scene never throws, design §2.6). */
function evalExpr(ast, scope) {
  try {
    return { ok: true, value: ev(ast, scope || {}) };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/** Convenience: parse once, evaluate many. Returns {ok, error?, deps?,
    run(scope) → {ok, value|error}}. (Named `run`, not `eval`, so the
    no-dynamic-code grep stays unambiguous — design acceptance 2.) */
function compile(src) {
  const p = parse(src);
  if (!p.ok) return { ok: false, error: p.error, pos: p.pos };
  return { ok: true, deps: p.deps, run: (scope) => evalExpr(p.ast, scope) };
}

    return { FUNCTIONS, CONSTANTS, parse, evalExpr, compile };
  })();
};
