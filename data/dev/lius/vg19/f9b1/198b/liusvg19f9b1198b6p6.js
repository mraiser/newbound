// facets.js — the six facet kinds in display order (DESIGN §4.2.3). Shared
// here (not in a control) so control modules never import each other — in
// platform mode control js is a facet, not an importable URL.
//
// `scene` is the redesigned 3D facet (docs/scene-facet-design.md). The
// legacy `three` facet is NOT in the fixed order — where a control carries
// one, the workbench appends a read-only "three · legacy" chip, and the
// shelf's 3d dot lights on either (SC-Q2).
//
// LIBRARY control — headless: the api rides this control's own element
// (zero-globals doctrine). Consumers mount it as a hidden data-control
// child div and read the element's api.

var me = this;
var ME = document.getElementById(me.UUID);

(function () {

const FACETS = ["html", "css", "js", "data", "scene", "cmd"];

    me.FACETS = FACETS;
  })();
