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
        // stagger by phase so a deck of nodes doesn't bob in lockstep
        ctx.me._phase = phase;
        // front-ortho anchor: the seeded flow position is the rest height
        if (d.pos && typeof d.pos.y === "number") ctx.me.baseY = d.pos.y;
        // label the body with the op's name (per-node override rides setRig)
        if (ctx.setRig && ctx.me.opName) ctx.setRig("label", "text", ctx.me.opName);
      },

      // every frame: a gentle bob — the visible proof that the scenehost frame
      // loop drives a control-scene behavior (the P0 gate). Also stamps a
      // heartbeat into host.state._beats so the gate can CONFIRM the loop
      // reaches behaviors headlessly.
      render(ctx, dt) {
        if (!ctx || !ctx.rig) return;
        const t = ctx.t || 0;
        if (ctx.host && ctx.host.state) {
          const beats = ctx.host.state._beats || (ctx.host.state._beats = {});
          beats[ctx.key] = t;
        }
        const base = (ctx.me.baseY !== undefined) ? ctx.me.baseY : (ctx.me.baseY = ctx.rig.pos.y);
        const sel = ctx.host && ctx.host.state && ctx.host.state.selectedKey === ctx.key;
        // selected nodes hold still & lift; the rest breathe
        ctx.rig.pos.y = sel ? base + 0.15 : base + Math.sin(t * 1.4 + ctx.me._phase) * 0.04;
      },

      // tap → the host's raycast hit. hit = { node, specId, key }.
      click(ctx, hit) {
        if (!ctx.host) return;
        ctx.host.setState("lastClick", {
          key: ctx.key, node: hit && hit.node, opType: ctx.me.opType, name: ctx.me.opName, t: Date.now(),
        });
        // selection emphasis rides the shared state (decision 1: per-deck
        // grouping via host.state, not per-instance shape swaps)
        ctx.host.setState("selectedKey", ctx.key);
      },

      // drag gestures (P2 will turn this into op-move / wire-ghost). For P0 it
      // just follows the pointer in the front plane so we can feel the affordance.
      drag(ctx, evt) {
        if (!ctx || !ctx.rig || !evt) return;
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
