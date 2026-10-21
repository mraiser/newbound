// flownode — ONE flow op as a scene-facet node control (the P0 spike for the
// floweditor3d → app-scene-stack conversion). Kind-parametrized by the
// addControl seed (me.data): { opType, name, width, inTerms, outTerms, phase }.
// The scene facet gives the SHAPE (body + label + in/out sockets, one generic
// geometry for the spike); these behaviors are where the editing gestures live
// in P2 (port hover/pick/drag, wire-ghost). For P0 they are deliberately
// minimal: render bobs the body (proves the host frame loop reaches a control),
// click reports through host.state.lastClick (proves tap dispatch + node id).

var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function () {
  const d = me.data || {};
  const kind = d.opType || "primitive";
  const phase = (typeof d.phase === "number") ? d.phase : 0;

  me.sceneBehaviors = {
    default: {
      // once, on add: fold the seed into the rig + shared state
      animate(ctx) {
        ctx.me.opType = kind;
        ctx.me.opName = d.name || "op";
        ctx.me.opIndex = (typeof d.opIndex === "number") ? d.opIndex : -1;
        // stagger by phase so a deck of nodes doesn't bob in lockstep
        ctx.me._phase = phase;
        // front-ortho anchor: the seeded flow position is the rest height
        if (d.pos && typeof d.pos.y === "number") ctx.me.baseY = d.pos.y;
        // label the body with the op's name (per-node override rides setRig)
        if (ctx.setRig && ctx.me.opName) ctx.setRig("label", "text", ctx.me.opName);
      },

      // every frame: a gentle bob — the visible proof that the scenehost frame
      // loop drives a control-scene behavior. Selected nodes hold still & lift.
      render(ctx, dt) {
        if (!ctx || !ctx.rig) return;
        const t = ctx.t || 0;
        if (ctx.host && ctx.host.state) {
          const beats = ctx.host.state._beats || (ctx.host.state._beats = {});
          beats[ctx.key] = t;
        }
        const base = (ctx.me.baseY !== undefined) ? ctx.me.baseY : (ctx.me.baseY = ctx.rig.pos.y);
        const sel = ctx.host && ctx.host.state && ctx.host.state.selectedKey === ctx.key;
        // a node mid wire-gesture freezes; the rest breathe
        const wiring = ctx.host && ctx.host.state && ctx.host.state.wireSrc;
        ctx.rig.pos.y = sel ? base + 0.15 : (wiring ? base : base + Math.sin(t * 1.4 + ctx.me._phase) * 0.04);
      },

      // tap → the host's raycast hit. hit = { node, specId, key }. A tap on a
      // TERMINAL node (in<N>/out<N>) is a WIRING gesture, routed to the
      // editor's wiring engine via host.state.onSocketTap (P2: it owns I-1/I-2
      // enforcement, the wire-source latch, and the legal-target commit). A tap
      // on the BODY is selection. The P0/P1 onPortTap hook is kept as a
      // fallback so the older flowspike harness still runs.
      click(ctx, hit) {
        if (!ctx.host) return;
        const node = hit && hit.node;
        const st = ctx.host.state || (ctx.host.state = {});
        if (node && /^(in|out)\d+$/.test(node)) {
          // which = "in"|"out", socket ordinal = the trailing number
          const which = node.slice(0, 2) === "in" ? "in" : "out";
          const ord = +node.slice(which.length);
          const payload = { key: ctx.key, opIndex: ctx.me.opIndex, which, ord, node, opType: ctx.me.opType };
          if (typeof st.onSocketTap === "function") { st.onSocketTap(payload); return; }
          if (typeof st.onPortTap === "function") { st.onPortTap({ key: ctx.key, opIndex: ctx.me.opIndex, node, opType: ctx.me.opType }); return; }
        }
        ctx.host.setState("lastClick", {
          key: ctx.key, node, opType: ctx.me.opType, name: ctx.me.opName, t: Date.now(),
        });
        // selection emphasis rides the shared state (decision 1)
        ctx.host.setState("selectedKey", ctx.key);
      },

      // drag gestures. The editor owns the interpretation via host.state.onOpDrag
      // (P2): it sees the start socket (out<N> → begin a wire from that output;
      // anything else → begin an op move) and routes move/end accordingly —
      // wire-source latch + I-1/I-2 target preview on socket moves, op-position
      // live update on body moves. The evt carries {phase, id, x, y, z, dx, dy,
      // dz, clientX, clientY, alt}; evt.id is the stage spec id "<key>:<node>".
      // The P0/P1 fallback (direct rig move) keeps the older harness working.
      drag(ctx, evt) {
        if (!ctx || !ctx.rig || !evt) return;
        const st = ctx.host.state || (ctx.host.state = {});
        // the real stage names the gesture phase evt.type (start/move/end);
        // older harnesses sent evt.phase - accept either, hand on .phase
        const phase = evt.phase || evt.type;
        if (typeof st.onOpDrag === "function") {
          const m = /^([^:]+):(in|out)(\d+)$/.exec(evt.id || "");
          const payload = { phase, key: ctx.key, opIndex: ctx.me.opIndex, evt };
          if (m) { payload.which = m[2]; payload.ord = +m[3]; payload.node = m[2] + m[3]; }
          else {
            // a BODY drag moves the op: follow the pointer live by the plane
            // delta (dx/dy from the grab point - no jump to the cursor); the
            // editor commits the snapped move on end and re-hosts the node
            if (phase === "start") {
              ctx.me._drag0 = { x: ctx.rig.pos.x, y: (ctx.me.baseY !== undefined) ? ctx.me.baseY : ctx.rig.pos.y };
              ctx.host.setState("selectedKey", ctx.key);
            } else if (phase === "move" && ctx.me._drag0 && typeof evt.dx === "number") {
              ctx.rig.pos.x = ctx.me._drag0.x + evt.dx;
              ctx.me.baseY = ctx.me._drag0.y + (evt.dy || 0);
            } else if (phase === "end") {
              ctx.me._drag0 = null;
            }
          }
          st.onOpDrag(payload);
          return;
        }
        if (phase === "move" && typeof evt.x === "number") {
          ctx.rig.pos.x = evt.x;
          if (typeof evt.y === "number") ctx.me.baseY = evt.y;
        }
      },

      dispose(ctx) {
        if (ctx.host && ctx.host.state && ctx.host.state.selectedKey === ctx.key) {
          ctx.host.setState("selectedKey", null);
        }
      },
    },
  };
};
