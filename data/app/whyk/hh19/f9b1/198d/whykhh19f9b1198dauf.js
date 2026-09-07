// webgl.js — the one WebGL capability probe. Tiny, THREE-free, so the router
// can decide between floweditor3d (WebGL) and the 2D floweditor fallback
// WITHOUT pulling in the 684KB THREE bundle on the fallback path. flow3d
// routing (frame.js) and the 3D control both read it.
//
// LIBRARY control — headless: the api lives on this control's own element
// (zero-globals doctrine). Consumers mount it as a hidden data-control child
// and call el.api.hasWebGL() from their ready.

var me = this;
var ME = document.getElementById(me.UUID);

var cached = null;

/** True when a WebGL (or WebGL2) context is creatable in this browser. */
me.hasWebGL = function () {
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
};
