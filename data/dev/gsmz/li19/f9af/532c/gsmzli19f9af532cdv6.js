// floweditor3d — RETIRED (P5 cutover of the floweditor3d → app-scene-stack
// conversion, 2026-08). The 3D flow editor is now dev.flowedit3d: the flow as
// app:scenehost-hosted dev:flownode instances (one per op, kind-parametrized),
// the editing gestures as flownode behaviors, run tokens as dev:flowtoken
// instances, the flow body authoritative and the scene facet a derived view
// (flowproject.toSceneDoc). dev.frame mounts flowedit3d directly.
//
// This control survives only as a DELEGATE so that any remaining mounter (a
// bookmark, another library, a peer's page) keeps working: it installs
// dev:flowedit3d into its own slot with the SAME props contract
// {title, graph, source, onBack} and forwards the child's api (dispose,
// the editor surface) as its own; waitReady resolves once the child is ready.
// The hand-rolled scenestage host that used to live here (the R-4 port: own
// spec map, raycast pick/drag, link re-resolution, run-token animation) is
// gone; its full source is the `old` of this facet's retirement entry in the
// control's _patches journal.

var me = this;
var ME = document.getElementById(me.UUID);

var readyP = new Promise(function (res) { me.ready = res; }).then(function () {
  var slot = ME.querySelector(".fx-delegate-slot");
  return new Promise(function (res) {
    installControl(slot, "dev", "flowedit3d", function (child) {
      if (child && child.waitReady) child.waitReady(function () { res(child); });
      else res(child);
    }, ME.DATA || {});
  });
}).then(function (child) {
  if (!child) return null;
  // forward the child's whole function surface (dispose included); the
  // lifecycle hooks stay this control's own
  var api = { retired: true, delegate: function () { return child; } };
  Object.keys(child).forEach(function (k) {
    if (k === "ready" || k === "waitReady") return;
    if (typeof child[k] === "function") api[k] = child[k];
  });
  return api;
}).catch(function (e) {
  console.log("floweditor3d (delegate to flowedit3d) failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
