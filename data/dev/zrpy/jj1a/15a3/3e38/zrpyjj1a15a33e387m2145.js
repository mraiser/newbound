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
        if (!ctx.setRig) return;
        // label the body with the op's name (per-node override rides setRig)
        if (ctx.me.opName) ctx.setRig("label", "text", ctx.me.opName);
        // PICK PROXY (the default): the editor's facade (flowproject.toSceneDoc)
        // draws the Prograph icon; this instance is the invisible tap/drag
        // surface sized to that icon's outer box, plus the selection halo.
        const fpEl = document.querySelector('[data-control="dev:flowproject"]');
        const fp = fpEl && fpEl.api;
        const box = (d.body && typeof d.body.x === "number") ? d.body
          : (fp && fp.opBox) ? fp.opBox({ type: kind, width: d.width })
          : { x: d.width || 1, y: 0.5, z: 0.26 };
        ctx.setRig("body", "params.size.x", box.x);
        // the body stops short of the top/bottom edge: the sockets straddle
        // those edges, and a full-height body (nearer the eye than a socket's
        // centre) would win the raycast there and swallow the socket tap
        ctx.setRig("body", "params.size.y", Math.max(0.1, box.y - 0.12));
        ctx.setRig("body", "params.size.z", box.z);
        ctx.setRig("halo", "params.size.x", box.x + 0.16);
        ctx.setRig("halo", "params.size.y", box.y + 0.16);
        ctx.setRig("halo", "pos.z", -box.z / 2 + 0.02);
        // STEP DEBUGGER (P4): the debug-state plate - a wider frame behind the
        // halo, tinted by the op's state in the editor's debug session
        // (host.state.dbg; see render). Hidden while waiting / not debugging.
        ctx.setRig("dbg", "params.size.x", box.x + 0.34);
        ctx.setRig("dbg", "params.size.y", box.y + 0.34);
        ctx.setRig("dbg", "pos.z", -box.z / 2 - 0.01);
        ctx.me._dbg = null;
        // D4: the BREAKPOINT dot - the icon's top-left corner, just outside
        // it (clear of the sockets on the top edge and the sync-in handle on
        // the left), in front of the plate; shown by render from
        // host.state.bps, a tap toggles it (click → host.state.onBpTap)
        ctx.setRig("bp", "pos.x", -box.x / 2 - 0.1);
        ctx.setRig("bp", "pos.y", box.y / 2 + 0.1);
        ctx.setRig("bp", "pos.z", box.z / 2);
        ctx.me._bp = -1;
        // selection = the bench accent (tokens.css: selection/focus/primary)
        const acc = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
        ctx.setRig("halo", "material", { color: /^#[0-9a-f]{3,8}$/i.test(acc) ? acc : "#f0a63c", emissive: true });
        // STANDALONE (seed proxy:false, or no facade on the stage — the
        // flowspike harness): the instance draws itself, generic geometry
        const st = ctx.host && ctx.host.stage;
        const facade = !!(st && st.objects && [...st.objects.keys()].some((k) => String(k).startsWith("fx_")));
        ctx.me._standalone = d.proxy === false || (d.proxy !== true && !facade);
        if (ctx.me._standalone) {
          ctx.setRig("body", "material", { color: "#e8e4dc", flat: true });
          for (let k = 0; k < 8; k++) {
            ctx.setRig("in" + k, "material", { color: "#f0a63c", flat: true });
            ctx.setRig("out" + k, "material", { color: "#62bd8c", flat: true });
          }
          ctx.setRig("label", "visible", true);
        }
      },

      // every frame: stamp the beat (the proof that the scenehost frame loop
      // drives a control-scene behavior) and show selection as the halo. A
      // proxy never leaves its op, so taps keep landing on the drawn sockets;
      // only a standalone node bobs, and lifts when selected.
      render(ctx, dt) {
        if (!ctx || !ctx.rig) return;
        const t = ctx.t || 0;
        if (ctx.host && ctx.host.state) {
          const beats = ctx.host.state._beats || (ctx.host.state._beats = {});
          beats[ctx.key] = t;
        }
        const base = (ctx.me.baseY !== undefined) ? ctx.me.baseY : (ctx.me.baseY = ctx.rig.pos.y);
        const hs = ctx.host && ctx.host.state;
        const sel = !!(hs && hs.selectedKey === ctx.key);
        if (sel !== ctx.me._sel && ctx.setRig) { ctx.me._sel = sel; ctx.setRig("halo", "visible", sel); }
        // STEP DEBUGGER (P4): host.state.dbg = { deck, ops: [state...] } for
        // the editor's FOCUSED case (null when not debugging / no frame runs
        // it). States: waiting (hidden) | ready | running | done | skipped.
        // Colours: dbg.colors (the editor's --fe-dbg-<state> tokens), else a
        // page-level --fe-dbg-<state>, else the defaults below.
        {
          const dbg = hs && hs.dbg;
          const km = /^d(\d+)_op(\d+)$/.exec(ctx.key || "");
          let ds = null;
          if (dbg && Array.isArray(dbg.ops) && km && +km[1] === dbg.deck) ds = dbg.ops[ctx.me.opIndex] || null;
          if (ds !== ctx.me._dbg && ctx.setRig) {
            ctx.me._dbg = ds;
            const show = !!ds && ds !== "waiting";
            if (show) {
              const DEF = { ready: "#f0a63c", running: "#5aa9e6", done: "#62bd8c", skipped: "#6b6f78" };
              const tok = String((dbg.colors && dbg.colors[ds]) || getComputedStyle(document.documentElement).getPropertyValue("--fe-dbg-" + ds)).trim();
              const color = /^#[0-9a-f]{3,8}$/i.test(tok) ? tok : (DEF[ds] || "#8a8f98");
              ctx.setRig("dbg", "material", { color, opacity: ds === "skipped" ? 0.35 : ds === "ready" ? 0.9 : 0.7, emissive: ds === "ready" || ds === "running" });
            }
            ctx.setRig("dbg", "visible", show);
          }
        }
        if (!ctx.me._standalone) { ctx.rig.pos.y = base; return; }
        // a node mid wire-gesture freezes; the rest breathe
        const wiring = hs && hs.wireSrc;
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
        // a BODY tap is op selection. An editor that owns selection (flowedit3d:
        // op XOR wire, inspector + status follow, Del deletes) takes it through
        // host.state.onOpSelect — the op twin of onSceneTap's wire pick. A
        // viewer without the hook gets the plain shared-state emphasis
        // (decision 1).
        if (typeof st.onOpSelect === "function") {
          st.onOpSelect({ key: ctx.key, opIndex: ctx.me.opIndex, node, opType: ctx.me.opType });
          return;
        }
        ctx.host.setState("selectedKey", ctx.key);
      },

      // drag gestures. The editor owns the interpretation via host.state.onOpDrag
      // (P2): it sees the start socket (in<N>/out<N> → begin a wire from that
      // socket, committed on release over a socket of the other kind;
      // anything else → begin an op
      // move) and routes move/end accordingly — ghost + I-1/I-2 target
      // preview on socket moves, op-position live update on body moves. The
      // evt carries {phase, id, x, y, z, dx, dy, dz, clientX, clientY, alt};
      // evt.id is the stage spec id "<key>:<node>". The P0/P1 fallback
      // (direct rig move) keeps the older harness working — body drags only.
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
        if (phase === "move" && typeof evt.x === "number" && !/:(in|out)\d+$/.test(evt.id || "")) {
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
