// flowdebug.js — the 3D flow editor's view of a dev.flowstep DEBUG SESSION
// (Flow step debugger P4). Pure where it can be: a debug_state reply (the P3
// session view — state.frames, ready, default, event, cursor...) plus the
// editor's flow body in, plain view objects out. No DOM, no THREE, no stage.
//
//   frameViews(rootCase, st)  one view per stepper frame, root first:
//       { fi, top, kind, path, case, phase, outcome, root, external, caseObj,
//         opIndex, iter, opName, ops[], wires[], syncs[], frame }
//     root is the EDITOR's case object the frame runs (identity with the
//     doc tree, so the editor can compare it with its focus): frame 0 runs
//     rootCase; a LOCAL frame runs its parent case's op.localdata; a COMMAND
//     frame runs a callee flow the editor does not hold (root null, external
//     = { cmd, name }) - and so does every frame above it.
//   opState(frame, i, ready)    done | running | ready | skipped | waiting
//       done    - the op evaluated in this case (frame.done[i])
//       running - the op is in progress (frame.inprog.op: an open frame, an
//                 iteration, a closing eval) - the op a child frame belongs to
//       ready   - in the TOP frame's ready set (pickable next)
//       skipped - never ran and never will: the case is closing/ended
//       waiting - everything else
//   wireState(frame, k, ready)  delivered | ready | skipped | pending
//   syncState(frame, j, ready)  fired | ready | skipped | pending
//   deckView(views, root, deck) the deepest view running `root` at case `deck`
//   focusChain(views)           the drill path to the deepest frame the editor
//       can show: [{ root, op, title, fi, case }] (frame 0 first)
//   eventText(ev, views)        one human line for a stepper event
//   rideEvents(events, view)    the deliver/sync/next events that move
//                               something on view's picture (D2 tokens)
//   drillEvents(events, view)   the enter/leave events whose op sits on
//                               view's picture (D2 drill fly)
//   client                      debug_start/step/state/stop/set_breakpoints
//                               over invokeCommand (all FLAT replies)
//
// LIBRARY control — headless: the api rides this control's own element
// (zero-globals doctrine). Consumers mount it as a hidden data-control
// child div and read the element's api.

var me = this;
var ME = document.getElementById(me.UUID);

(function () {

const caseChain = (root) => { const o = []; let c = root; while (c) { o.push(c); c = c.nextcase; } return o; };
const hasItem = (ready, kind, i) => Array.isArray(ready) && ready.some((r) => r && r.kind === kind && r.index === i);
const closed = (f) => f && (f.phase === "closing" || f.phase === "ended");

function opState(f, i, ready) {
  if (!f) return "waiting";
  if (Array.isArray(f.done) && f.done[i]) return "done";
  if (f.inprog && f.inprog.op === i) return "running";
  if (hasItem(ready, "op", i)) return "ready";
  if (closed(f)) return "skipped";
  return "waiting";
}
function wireState(f, k, ready) {
  if (!f) return "pending";
  if (Array.isArray(f.wires) && f.wires[k]) return "delivered";
  if (hasItem(ready, "wire", k)) return "ready";
  if (closed(f)) return "skipped";
  return "pending";
}
function syncState(f, j, ready) {
  if (!f) return "pending";
  if (Array.isArray(f.syncs) && f.syncs[j]) return "fired";
  if (hasItem(ready, "sync", j)) return "ready";
  if (closed(f)) return "skipped";
  return "pending";
}

function framesOf(st) { return st && st.state && Array.isArray(st.state.frames) ? st.state.frames : []; }

function frameViews(rootCase, st) {
  const frames = framesOf(st);
  const ready = st && Array.isArray(st.ready) ? st.ready : [];
  const views = [];
  for (let fi = 0; fi < frames.length; fi++) {
    const f = frames[fi] || {};
    const top = fi === frames.length - 1;
    let root = null, external = null, op = null, opIndex = null, iter = null;
    if (fi === 0) root = rootCase || null;
    else {
      const parent = views[fi - 1];
      const step = Array.isArray(f.path) && f.path.length ? f.path[f.path.length - 1] : null;
      opIndex = step ? step[0] : null; iter = step ? step[1] : null;
      const pc = parent && parent.root ? caseChain(parent.root)[parent.case] : null;
      op = pc && opIndex != null ? pc.cmds[opIndex] || null : null;
      if (op && op.type === "local" && op.localdata) root = op.localdata;
      else external = op ? { cmd: op.cmd || "", name: op.name || "", type: op.type || "" } : { inherited: true };
    }
    const c = root ? caseChain(root)[f.case || 0] || null : null;
    const rdy = top ? ready : null;
    views.push({
      fi, top, kind: f.kind || "", path: Array.isArray(f.path) ? f.path : [], case: f.case || 0,
      phase: f.phase || "", outcome: f.outcome || "", root, external, caseObj: c,
      opIndex, iter, opName: op ? (op.name || op.type || "op") : (fi === 0 ? "root" : null), op,
      ops: c ? c.cmds.map((_, i) => opState(f, i, rdy)) : [],
      wires: c ? c.cons.map((_, k) => wireState(f, k, rdy)) : [],
      syncs: c ? (c.syncs || []).map((_, j) => syncState(f, j, rdy)) : [],
      frame: f,
    });
  }
  return views;
}

function deckView(views, root, deck) {
  for (let k = (views || []).length - 1; k >= 0; k--) {
    const v = views[k];
    if (v.root && v.root === root && v.case === deck) return v;
  }
  return null;
}

function focusChain(views) {
  const out = [];
  for (const v of views || []) {
    if (!v.root) break;
    out.push({ root: v.root, op: v.op, title: v.fi === 0 ? "case 1" : (v.opName || "local"), fi: v.fi, case: v.case });
  }
  return out;
}

const short = (v) => { let s; try { s = JSON.stringify(v); } catch (e) { s = String(v); } if (s === undefined) s = "null"; return s.length > 40 ? s.slice(0, 39) + "…" : s; };
function nameIn(c, i) { if (i === -1) return "params"; if (i === -2) return "return"; const op = c && c.cmds[i]; return op ? (op.name || op.type || "op" + i) : "op" + i; }
function eventText(ev, views) {
  if (!ev || !ev.type) return "not started";
  const v = (views || []).find((x) => x.path && JSON.stringify(x.path) === JSON.stringify(ev.frame || [])) || null;
  const c = v ? v.caseObj : null;
  const where = v && v.fi > 0 ? ` · in ${v.opName || "frame " + v.fi}` : "";
  switch (ev.type) {
    case "enter": return (ev.kind === "root" ? "enter flow" : `enter ${ev.kind} ${v && v.fi > 0 ? v.opName : "op " + ev.op}`) + (ev.iter != null ? ` [iter ${ev.iter}]` : "");
    case "seed": return `seed case ${(ev.case || 0) + 1}` + where;
    case "deliver": {
      const w = c && c.cons[ev.wire];
      const txt = w ? `${nameIn(c, w.src[0])}.${w.src[1]} → ${nameIn(c, w.dest[0])}.${w.dest[1]}` : `wire ${ev.wire}`;
      return `deliver ${txt} = ${short(ev.value)}` + where;
    }
    case "sync": return `synchro ${ev.sync != null ? ev.sync : ""} fired` + where;
    case "iter": return `iterate ${nameIn(c, ev.op)} [${ev.iter != null ? ev.iter : ""}]` + where;
    case "eval": return `eval ${nameIn(c, ev.op)}` + (ev.fail ? " (failed)" : "") + (ev.rule ? ` · rule ${ev.rule}` : "") + where;
    case "leave": return `leave ${ev.kind || "frame"}` + (ev.outcome ? ` (${ev.outcome})` : "");
    case "next": return `next → case ${(ev.case || 0) + 2}` + where;
    default: return ev.type + (ev.msg ? `: ${ev.msg}` : "") + where;
  }
}

// ── D2: what a move SHOWS on one picture ────────────────────────────────
// rideEvents(events, view): the stepper events that MOVE something on the
// picture of `view` (a frame view at its case) - deliver (a wire), sync (a
// synchro pulse), next (the jump pipe out of this case) - in tape order.
// Events of another frame or another case are not this picture's.
// drillEvents(events, view): the enter/leave events whose PARENT frame is
// `view`'s frame - the op the drill goes into / comes out of is on this
// picture (forward enter / undone leave before the redraw; forward leave /
// undone enter after it).
const pathKey = (p) => JSON.stringify(Array.isArray(p) ? p : []);
function rideEvents(events, view) {
  if (!view || !Array.isArray(events)) return [];
  const pk = pathKey(view.path);
  return events.filter((ev) => ev && (ev.type === "deliver" || ev.type === "sync" || ev.type === "next")
    && (ev.case || 0) === (view.case || 0) && pathKey(ev.frame) === pk);
}
function drillEvents(events, view) {
  if (!view || !Array.isArray(events)) return [];
  const pk = pathKey(view.path);
  return events.filter((ev) => ev && (ev.type === "enter" || ev.type === "leave") && ev.kind !== "root"
    && Array.isArray(ev.frame) && ev.frame.length > 0 && ev.op != null && pathKey(ev.frame.slice(0, -1)) === pk);
}

// ── client: the P3 session API (dev.flowstep, FLAT replies) ──────────────
const call = (cmd, args) => new Promise((res) => {
  try { invokeCommand("dev", "flowstep", cmd, args, (r) => res(r || { status: "err", msg: "no response" })); }
  catch (e) { res({ status: "err", msg: String(e && e.message ? e.message : e) }); }
});
const client = {
  start: (src, body, args) => call("debug_start", { lib: src.lib, ctl: src.ctl, cmd: src.cmd, body: body || {}, args: args || {} }),
  step: (session, mode, pick) => call("debug_step", { session, mode, pick: pick || {} }),
  state: (session) => call("debug_state", { session }),
  stop: (session) => call("debug_stop", { session }),
  setBreakpoints: (session, list) => call("debug_set_breakpoints", { session, list: list || [] }),
};

Object.assign(me, { caseChain, opState, wireState, syncState, frameViews, deckView, focusChain, eventText, rideEvents, drillEvents, client });
})();
