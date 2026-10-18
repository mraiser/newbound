// scenehost — the component-scene host. A control IS a 3D object.
//
// The host owns a 3D canvas and a frame loop. Its own js facet (the app
// front-end) calls me.addControl(lib, ctl, data) for each instance it wants in
// the scene — instancing is the HOST's call, not a data binding. Each added
// control is booted (its live `me`, full privilege — no cage), its scene facet
// is read for its SHAPE (declarative nodes: a sphere, a label), and it is
// wrapped in a RIG. The child's per-instance behaviors — animate(ctx),
// render(ctx, dt), and click(ctx) — come from its js facet (me.sceneBehaviors
// or direct me.animate/render/click) and run as the child's own `me`, so a
// behavior sees its siblings (ctx.host.children) and drives its own rig.
//
// The ctx a behavior gets:
//   me        — the child control's live api (its `this`; behavior methods are
//               already on it, so `this` works too)
//   rig       — this instance's transform {pos, rot, scale}; write it and the
//               stage syncs it to the mesh (the rig IS the plumbing)
//   setRig(path, value) — e.g. setRig("pos.y", 1.2); per-node override
//   shape     — the child's scene-doc (its declarative nodes, by id)
//   host      — the scenehost api: host.children (all instances), host.stage,
//               host.setState / host.state (the host's shared world state)
//   data      — the `data` passed to addControl (per-instance seed, e.g. a peer)
//   t, dt     — clock seconds / frame delta
//   key       — this instance's key
//
// DATA: {lib, ctl} to host ONE control's scene, or {} / {env} for an empty
// canvas the caller populates via addControl. Optional {caption, onReady}.
//
// api: addControl(lib, ctl, data?, key?) → Promise<instance>,
//      removeControl(key), children (live array), stage, state/setState,
//      frameAll(), dispose(), waitReady(cb).

var me = this;
var ME = document.getElementById(me.UUID);

me.children = [];      // live array of instances: {key, lib, ctl, me, rig, shape, specIds, data}
me.state = {};         // shared world state the host's own js facet owns
me.stage = null;
me.runtime = null;

var dark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
var reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

var rt = null;          // the frame loop
var keySeq = 0;
var byKey = new Map();

me.setState = function (field, value) {
  me.state[field] = value;
  // a state change re-renders next frame; behaviors read it via ctx.host.state
  if (me.stage) me.stage.requestRender();
};

var readyP = new Promise(function (res) { me.ready = res; }).then(async () => {
  const canvasEl = ME.querySelector(".sh-canvas");
  const footEl = ME.querySelector(".sh-foot");
  const capEl = ME.querySelector(".sh-cap");
  const { hasWebGL } = document.querySelector('[data-control="app:webgl"]').api;
  const { parse: parseScene } = document.querySelector('[data-control="app:scenedoc"]').api;
  const { project, envOf } = document.querySelector('[data-control="app:sceneproject"]').api;
  const { mountScene } = await import("../app/asset/app/vendor/nb_three/scenestage.js");
  const jsonP = (c2, v2) => new Promise((res2) => json(c2, v2, res2));
  const readRec = async (l2, id2) => {
    const r2 = await jsonP("../app/read", "lib=" + encodeURIComponent(l2) + "&id=" + encodeURIComponent(id2));
    return r2.status === "ok" ? r2.data : new Error(r2.msg || "read failed");
  };
  const controlsOf = async (l2) => {
    const d2 = await readRec(l2, "controls");
    return d2 instanceof Error ? d2 : (d2.list ?? []);
  };

  if (!hasWebGL()) {
    canvasEl.innerHTML = '<p style="padding:14px" class="sh-cap">no WebGL here — this scene cannot render</p>';
    return;
  }
  if (ME.DATA.caption) { footEl.hidden = false; capEl.textContent = ME.DATA.caption; }

  me.frameAll = function () { if (me.stage && me.stage.frameAll) me.stage.frameAll(); };

  // ── the stage + the frame loop ────────────────────────────────────────────
  const stage = mountScene(canvasEl, {
    pickMode: "affordant",
    showSlots: false,
    onTap: (id) => handleTap(id),
    onHover: (id, entered) => {},
    onDrag: (evt) => handleDrag(evt),
  });
  me.stage = stage;
  const env = ME.DATA.env || {};
  stage.setScene([], {
    lights: env.lights === "none" ? "none" : "default",
    grid: env.grid !== false,
    camera: (env.camera && typeof env.camera === "object") ? env.camera : null,
  });

  let last = performance.now();
  let raf = 0;
  let running = true;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    tick(dt, now / 1000);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // one frame: run every instance's render behavior, then sync rigs → stage
  function tick(dt, t) {
    for (const inst of me.children) {
      if (inst.renderFn) {
        try { inst.renderFn.call(inst.me, inst.ctx, dt); }
        catch (e) { diag(`${inst.key}.render: ${e && e.message ? e.message : e}`); }
      }
    }
    // rig → stage (the plumbing): write each instance's accumulated rig
    for (const inst of me.children) syncRig(inst, t);
    stage.requestRender();
  }

  function diag(m) {
    footEl.hidden = false;
    capEl.textContent = `△ ${m}`;
    console.log("scenehost: " + m);
  }

  // ── rig sync: an instance's rig applies to its shape's root node ─────────
  function syncRig(inst) {
    const rootId = inst.rootNodeId;
    if (!rootId) return;
    const id = inst.specPrefix + rootId;
    const r = inst.rig;
    stage.applyDelta(id, "pos.x", r.pos.x);
    stage.applyDelta(id, "pos.y", r.pos.y);
    stage.applyDelta(id, "pos.z", r.pos.z);
    stage.applyDelta(id, "rot.x", r.rot.x);
    stage.applyDelta(id, "rot.y", r.rot.y);
    stage.applyDelta(id, "rot.z", r.rot.z);
    if (r.scale.x !== 1 || r.scale.y !== 1 || r.scale.z !== 1) {
      stage.applyDelta(id, "scale.x", r.scale.x);
      stage.applyDelta(id, "scale.y", r.scale.y);
      stage.applyDelta(id, "scale.z", r.scale.z);
    }
    if (r.visible === false) stage.applyDelta(id, "visible", false);
    // per-node overrides (setRig) ride along
    for (const [nodeId, props] of inst.nodeRig) {
      for (const [path, value] of Object.entries(props)) {
        stage.applyDelta(inst.specPrefix + nodeId, path, value);
      }
    }
  }

  // ── child shape loading: scene facet → stage specs, prefixed per instance ──
  async function loadChildShape(lib, ctl, prefix, theme) {
    const controls = await controlsOf(lib);
    if (controls instanceof Error) return null;
    const entry = controls.find((c) => c.name === ctl);
    if (!entry) return null;
    const rec = await readRec(lib, entry.id);
    if (rec instanceof Error) return null;
    if (rec.scene === undefined) return { doc: null, specs: [], rootNodeId: null };
    const doc = parseScene(rec.scene);
    // project the child's declarative nodes to stage specs, prefixed so this
    // instance's nodes are unique in the shared stage
    const specs = project(doc, { theme, prefix, parent: null });
    // the root node = the first top-level node (no parent) — the rig target
    let rootNodeId = null;
    for (const n of doc.nodes()) { if (!n.parent) { rootNodeId = n.id; break; } }
    return { doc, specs, rootNodeId };
  }

  // ── addControl: the host's instancing call ────────────────────────────────
  me.addControl = async function (lib, ctl, data, key) {
    key = key || `i${keySeq++}`;
    const prefix = `${key}:`;
    const theme = dark() ? "dark" : "light";

    // boot the child control in a hidden host → its live me (no cage)
    const host2 = document.createElement("div");
    host2.style.display = "none";
    ME.appendChild(host2);

    const shape = await loadChildShape(lib, ctl, prefix, theme);

    const inst = await new Promise((resolve) => {
      installControl(host2, lib, ctl, function (api) {
        const rig = {
          pos: { x: 0, y: 0, z: 0 },
          rot: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          visible: true,
        };
        const inst = {
          key, lib, ctl, me: api, rig,
          shape: shape ? shape.doc : null,
          rootNodeId: shape ? shape.rootNodeId : null,
          specPrefix: prefix,
          specIds: [],
          nodeRig: new Map(),     // nodeId -> {path: value} overrides
          data: data || {},
          renderFn: null, clickFn: null, animateFn: null,
          ctx: null,
        };
        // the behavior ctx — runs as the child's own me
        const ctx = {
          me: api,
          rig,
          data: inst.data,
          key,
          t: 0, dt: 0,
          shape: inst.shape,
          host: me,
          setRig(nodeId, path, value) {
            if (value === undefined) return; // (nodeId,path,value) only
            if (!inst.nodeRig.has(nodeId)) inst.nodeRig.set(nodeId, {});
            inst.nodeRig.get(nodeId)[path] = value;
          },
        };
        inst.ctx = ctx;
        api.rig = rig;                 // the child sees its own rig as me.rig
        api.scene = me;                // … and the host as me.scene
        api.owner = me;                // (the scenegraph names)
        api.model = { rig, key };      // a light model handle
        if (!api.children) api.children = [];

        // resolve behaviors: me.sceneBehaviors.<impl> OR direct me.animate/render/click
        const impls = api.sceneBehaviors || {};
        const impl = impls.default || impls[Object.keys(impls)[0]] || null;
        inst.animateFn = api.animate || (impl && impl.animate) || null;
        inst.renderFn = api.render || (impl && impl.render) || null;
        inst.clickFn = api.click || (impl && impl.click) || null;

        // draw the child's shape
        if (shape && shape.specs.length) {
          for (const s of shape.specs) { stage.upsert(s); inst.specIds.push(s.id); }
        }
        resolve(inst);
      }, data);
    });

    me.children.push(inst);
    byKey.set(key, inst);

    // animate(ctx): once, now that the shape exists and the rig is live
    if (inst.animateFn) {
      try { inst.animateFn.call(inst.me, inst.ctx); }
      catch (e) { diag(`${key}.animate: ${e && e.message ? e.message : e}`); }
    }
    syncRig(inst, performance.now() / 1000);
    stage.requestRender();
    return inst;
  };

  me.removeControl = function (key) {
    const inst = byKey.get(key);
    if (!inst) return;
    for (const id of inst.specIds) stage.removeObject(id);
    // drop any links this instance touched
    for (const [lk, l] of [...links]) if (l.a === key || l.b === key) { stage.removeObject(lk); links.delete(lk); }
    byKey.delete(key);
    const i = me.children.indexOf(inst);
    if (i >= 0) me.children.splice(i, 1);
    stage.requestRender();
  };

  // ── connection links (world-space connectors that track two instances) ────
  const links = new Map();   // linkId -> {a, b} instance keys
  me.addLink = function (linkId, keyA, keyB, tone) {
    if (links.has(linkId)) return;
    links.set(linkId, { a: keyA, b: keyB });
    stage.upsert({
      id: linkId, kind: "link", from: `${keyA}:orb`, to: `${keyB}:orb`,
      material: { token: tone || "wire" }, visible: true,
    });
    stage.requestRender();
  };
  me.removeLink = function (linkId) {
    if (!links.has(linkId)) return;
    links.delete(linkId);
    stage.removeObject(linkId);
    stage.requestRender();
  };

  me.byId = function (key) { return byKey.get(key) || null; };

  // ── click dispatch: raycast hit → the instance's click(ctx) ──────────────
  function instForSpec(specId) {
    if (!specId) return null;
    const colon = specId.indexOf(":");
    const key = colon < 0 ? specId : specId.slice(0, colon);
    return byKey.get(key) || null;
  }

  function handleTap(specId) {
    const inst = instForSpec(specId);
    if (!inst || !inst.clickFn) return;
    const nodeId = specId.indexOf(":") < 0 ? specId : specId.slice(specId.indexOf(":") + 1);
    try { inst.clickFn.call(inst.me, inst.ctx, { node: nodeId, specId, key: inst.key }); }
    catch (e) { diag(`${inst.key}.click: ${e && e.message ? e.message : e}`); }
  }

  function handleDrag(evt) {
    const inst = instForSpec(evt.id);
    if (!inst) return;
    const fn = inst.me && (inst.me.drag || (inst.me.sceneBehaviors && inst.me.sceneBehaviors.default && inst.me.sceneBehaviors.default.drag));
    if (typeof fn === "function") {
      try { fn.call(inst.me, inst.ctx, evt); } catch (e) { diag(`${inst.key}.drag: ${e && e.message ? e.message : e}`); }
    }
  }

  me.dispose = function () {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (stage) stage.dispose();
  };

  // host ONE control directly (DATA.lib/ctl) — the single-instance posture
  if (ME.DATA.lib && ME.DATA.ctl) {
    await me.addControl(ME.DATA.lib, ME.DATA.ctl, ME.DATA.data || {});
    me.frameAll();
  }
}).catch((e) => {
  console.log("scenehost failed to start: " + (e && e.message ? e.message : e));
});

me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
