// webgl.js — the one WebGL capability probe. Tiny, THREE-free, so the router
// can decide between floweditor3d (WebGL) and the 2D floweditor fallback
// WITHOUT pulling in the 684KB THREE bundle on the fallback path. flow3d
// routing (frame.js) and the 3D control both read it.
//
// LIBRARY control — headless: defines window.NB_WEBGL once (idempotent across
// installs). Consumers list this control as a hidden data-control child
// div and use the global from their ready.

var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function () {
  if (window.NB_WEBGL) return;
  window.NB_WEBGL = (function () {

let cached = null;

/** True when a WebGL (or WebGL2) context is creatable in this browser. */
function hasWebGL() {
  if (cached !== null) return cached;
  try {
    const c = document.createElement("canvas");
    cached = Boolean(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    cached = false;
  }
  return cached;
}

    return { hasWebGL };
  })();
};
