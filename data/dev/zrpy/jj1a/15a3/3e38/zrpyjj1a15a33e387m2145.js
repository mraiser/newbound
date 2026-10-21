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
      // TERMINAL node is a WIRING gesture (delegated to the editor via the
      // host's shared onPortTap hook); a tap on the BODY is selection.
      click(ctx, hit) {
        if (!ctx.host) return;
        const node = hit && hit.node;
        // route a terminal tap to the editor's wiring logic (P2)
        if (node && /^(in|out)\d+$/.test(node) && typeof ctx.host.state.onPortTap === "function") {
          ctx.host.state.onPortTap({ key: ctx.key, opIndex: ctx.me.opIndex, node, opType: ctx.me.opType });
          return;
        }
        ctx.host.setState("lastClick", {
          key: ctx.key, node, opType: ctx.me.opType, name: ctx.me.opName, t: Date.now(),
        });
        // selection emphasis rides the shared state (decision 1)
        ctx.host.setState("selectedKey", ctx.key);
      },

      // drag gestures. A drag that began on an output socket is a WIRE drag
      // (the editor moves the ghost tip + previews legal targets); any other
      // drag is an op-move in the front plane.
      drag(ctx, evt) {
        if (!ctx || !ctx.rig || !evt) return;
        if (typeof ctx.host.state.onOpDrag === "function") { ctx.host.state.onOpDrag(ctx.me.opIndex, evt); return; }
        if (evt.phase === "move" && typeof evt.x === "number") {
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
