// flowtoken — ONE flow EXECUTION TOKEN as a scenehost node control (P4 of the
// floweditor3d → app-scene-stack conversion). The delivery IS the behavior:
// the editor (dev:flowedit3d run ▸) addControl's one token per wire, seeded
//   { runId, k, wire, round, from, to, dur, reduced }
// and this control's render behavior rides that wire during its propagation
// round (flowdoc.propagationRounds) and reports through the host's shared
// state: host.state.onTokenDelivered({ runId, k, round, key }).
//
// Timing rides ONE shared clock — host.state.run = { id, t0 } (performance.now
// ms) set by the editor once every token is added — so the per-instance boot
// stagger of addControl can never reorder deliveries across rounds. Before
// t0 (or before its round) a token is hidden; after delivery it hides again.
//
// Position: host.stage.linkCurvePoint(wire, u) when the GL stage offers it
// (lockstep with the rendered link by construction, the 3D-5 contract), else
// flowproject.wireCurvePoint(from, to, u) — the same spline as pure math, so
// the headless null-renderer path runs the identical schedule.
// prefers-reduced-motion (seed.reduced): step-through — the token sits on its
// destination terminal for its round instead of travelling.

var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function () {
  const curve = () => {
    const fp = document.querySelector('[data-control="dev:flowproject"]');
    return fp && fp.api && fp.api.wireCurvePoint ? fp.api.wireCurvePoint : null;
  };
  const lerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u });

  function pointAt(ctx, d, u) {
    const st = ctx.host && ctx.host.stage;
    if (st && typeof st.linkCurvePoint === "function" && d.wire) {
      try { const p = st.linkCurvePoint(d.wire, u); if (p) return p; } catch (e) { /* fall through */ }
    }
    const from = d.from || { x: 0, y: 0, z: 0 }, to = d.to || from;
    const wcp = curve();
    return wcp ? wcp(from, to, u) : lerp(from, to, u);
  }
  function place(ctx, p) { if (ctx.rig && p) { ctx.rig.pos.x = p.x; ctx.rig.pos.y = p.y; ctx.rig.pos.z = p.z; } }
  function show(ctx, on) {
    const s = ctx.me && ctx.me._tok; if (!s || s.shown === on) return;
    s.shown = on; ctx.setRig("tok", "visible", on);
  }

  me.sceneBehaviors = {
    default: {
      // once, on add: park on the source terminal, hidden, awaiting the run clock
      animate(ctx) {
        const d = ctx.data || {};
        ctx.me._tok = { done: false, shown: null, u: 0,
          delay: (d.round || 0) * (d.dur || 0.42), dur: d.dur || 0.42 };
        place(ctx, pointAt(ctx, d, d.reduced ? 1 : 0));
        show(ctx, false);
      },

      // every frame: ride the wire during this token's round, then deliver
      render(ctx) {
        const d = ctx.data || {};
        const s = ctx.me && ctx.me._tok; if (!s || s.done) return;
        const run = ctx.host && ctx.host.state && ctx.host.state.run;
        if (!run || run.id !== d.runId || typeof run.t0 !== "number") return;
        const local = (performance.now() - run.t0) / 1000 - s.delay;
        if (local < 0) { show(ctx, false); return; }
        show(ctx, true);
        s.u = d.reduced ? 1 : Math.min(1, local / s.dur);
        place(ctx, pointAt(ctx, d, s.u));
        if (local >= s.dur) {
          s.done = true;
          show(ctx, false);
          const cb = ctx.host.state.onTokenDelivered;
          if (typeof cb === "function") {
            try { cb({ runId: d.runId, k: d.k, round: d.round, key: ctx.key }); } catch (e) { /* never break the frame loop */ }
          }
        }
      },

      // tokens are scenery — a tap passes through to nothing
      click() {},

      dispose(ctx) { if (ctx && ctx.me) ctx.me._tok = null; },
    },
  };
};