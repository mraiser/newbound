// flowspike — the P0 GATE for the floweditor3d → app-scene-stack conversion.
// Proves the ONE runtime (app:scenehost) can carry a flow deck before any
// editor chrome is ported. It parses a specimen flow (flowdoc), walks its ops
// (the same shape flowproject.toSceneDoc emits), and hosts each op as a
// dev:flownode instance via addControl — the instance's scene facet is its
// SHAPE, its me.sceneBehaviors carry the (dummy) gestures. The checklist in
// the rail flips as each property is demonstrated:
//   host booted · instances added · frame loop reaches behaviors · tap→node id
// This is decision-1 (one instance PER OP) and decision-2 (one shared
// kind-parametrized flownode) made concrete — the cheapest proof, per the
// plan's P0+P1 spike recommendation.

var me = this;
var ME = document.getElementById(me.UUID);

var readyP = new Promise(function (res) { me.ready = res; }).then(async () => {
  const { parse } = document.querySelector('[data-control="dev:flowdoc"]').api;
  const { GEO, halfH } = document.querySelector('[data-control="dev:flowproject"]').api;

  // ── specimen flow: params.a + a constant feed an add; the sum returns ─────
  // (a real Case graph: input/output bars, two ops, three wires — exercises
  //  op bodies, terminals and the deck chain the projector derives).
  const SPECIMEN = {
    input:  { a: { mode: "in", type: "int", x: -0.5 } },
    output: { r: { mode: "out", type: "int", x: 0 } },
    cmds: [
      { name: "41", type: "constant", ctype: "int", pos: { x: 0, y: 1, z: 0 }, width: 1,
        in: {}, out: { v: { mode: "out", type: "int", x: 0 } } },
      { name: "add", type: "primitive", pos: { x: 0, y: -1, z: 0 }, width: 1,
        in:  { a: { mode: "in", type: "int", x: -0.2 }, b: { mode: "in", type: "int", x: 0.2 } },
        out: { r: { mode: "out", type: "int", x: 0 } } },
    ],
    cons: [
      { src: [-1, "a"], dest: [1, "a"] },   // params.a -> add.in.a
      { src: [0, "v"],  dest: [1, "b"] },   // const.v  -> add.in.b
      { src: [1, "r"],  dest: [-2, "r"] },  // add.out.r -> return.r
    ],
  };

  const status = (t) => { const el = ME.querySelector(".fs-status"); if (el) el.textContent = t; };
  const gate = (cls, ok, note) => {
    const li = ME.querySelector(cls); if (!li) return;
    const b = li.querySelector("b"); if (b) b.textContent = (ok ? "pass" : "fail") + (note ? ` — ${note}` : "");
    li.style.color = ok ? "#2e8b57" : "#c15a5a";
  };

  function init(host) {
    const hostEl = host.querySelector(".fs-host");
    const lastEl = host.querySelector(".fs-last");
    const lastBody = host.querySelector(".fs-last-body");

    // the ONE runtime is mounted declaratively; grab its element. Its api is
    // assigned ASYNCHRONOUSLY at the end of the scenehost's boot (after the
    // vendor import + facade controls resolve), so addControl is NOT there yet
    // on first read — a race that fails intermittently on GL and GL-less hosts
    // alike. Wait for readiness before touching addControl.
    const hostApi = () => hostEl.api;
    const gate0 = hostApi();
    if (!gate0 || typeof gate0.waitReady !== "function") { status("no scenehost api"); gate(".fs-g-host", false, "no waitReady"); return null; }
    return new Promise((res) => gate0.waitReady(() => res(gate0))).then((scenehost) => {
    if (!scenehost || !scenehost.addControl) { status("no scenehost api"); gate(".fs-g-host", false, "no addControl"); return null; }
    gate(".fs-g-host", true, scenehost.headless ? "headless (no WebGL)" : "webgl");

    // parse the specimen into the flowdoc model (diagnostics never reject)
    const doc = parse(SPECIMEN);
    const c = doc.root;

    // decision 1: ONE instance PER OP. Walk the active deck's ops and host
    // each as a flownode, seeding it with the op's type/name/width/terminals
    // and its flow position (the front-ortho anchor — passed as the rig pos).
    const adds = [];
    (c.cmds || []).forEach((op, i) => {
      const phase = i * 0.9;
      adds.push(
        scenehost.addControl("dev", "flownode", {
          opType: op.type, name: op.name, width: op.width,
          inTerms: Object.keys(op.in || {}), outTerms: Object.keys(op.out || {}),
          phase,
          // front-ortho anchor: the op's flow position becomes the rig pos
          pos: { x: op.pos.x, y: op.pos.y, z: op.pos.z },
        }, `op${i}`).then((inst) => {
          // place the instance's rig at the op's flow position (z=0 deck)
          if (inst && inst.rig) {
            inst.rig.pos.x = op.pos.x; inst.rig.pos.y = op.pos.y; inst.rig.pos.z = op.pos.z;
          }
          return inst;
        })
      );
    });

    return Promise.all(adds).then((instances) => {
      const n = instances.filter(Boolean).length;
      gate(".fs-g-instances", n === (c.cmds || []).length, `${n} flownode instance${n === 1 ? "" : "s"}`);

      // frame-loop proof: a behavior writes a heartbeat into host.state on
      // render; poll for it. (flownode.render bobs the rig AND stamps
      // host.state._beats[key] = t each frame.)
      let loopConfirmed = false;
      const loopPoll = setInterval(() => {
        const beats = scenehost.state && scenehost.state._beats;
        const count = beats ? Object.keys(beats).length : 0;
        if (count >= n && n > 0 && !loopConfirmed) {
          loopConfirmed = true;
          gate(".fs-g-loop", true, `${count} behavior${count === 1 ? "" : "s"} rendering`);
          clearInterval(loopPoll);
        }
      }, 120);
      setTimeout(() => { if (!loopConfirmed) { gate(".fs-g-loop", false, "no render heartbeat"); clearInterval(loopPoll); } }, 4000);

      // tap-dispatch proof: flownode.click writes host.state.lastClick with
      // the node id — mirror it into the readout and flip the gate.
      let tapConfirmed = false;
      const tapPoll = setInterval(() => {
        const lc = scenehost.state && scenehost.state.lastClick;
        if (lc && !tapConfirmed) {
          tapConfirmed = true;
          gate(".fs-g-tap", true, `node "${lc.node}" @ ${lc.key}`);
          if (lastEl) { lastEl.hidden = false; lastBody.textContent = JSON.stringify(lc, null, 2); }
          clearInterval(tapPoll);
        }
      }, 120);

      host.querySelector(".fs-frame").addEventListener("click", () => scenehost.frameAll && scenehost.frameAll());
      // tap proof: on the GL stage a real click raycasts to a node and the
      // stage's onTap fires; the null stage has no raycaster, so a click on
      // the deck drives the same dispatch via host.tap (the headless surface).
      if (scenehost.headless) {
        hostEl.addEventListener("click", () => {
          const k = (instances[0] && instances[0].key) || "op0";
          if (scenehost.tap) scenehost.tap(`${k}:body`);
        });
        status(`${n} ops hosted — click the deck to tap`);
      } else {
        status(`${n} ops hosted — click a node`);
      }
      return { dispose() { clearInterval(loopPoll); clearInterval(tapPoll); } };
    }).catch((e) => { status("add failed: " + (e && e.message ? e.message : e)); return null; });
    }); // waitReady: scenehost api resolved
  }

  return init(ME);
}).catch(function (e) {
  console.log("flowspike failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
