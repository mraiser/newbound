// facets.js — the six facet kinds in display order (DESIGN §4.2.3). Shared
// here (not in a control) so control modules never import each other — in
// platform mode control js is a facet, not an importable URL.
//
// `scene` is the redesigned 3D facet (docs/scene-facet-design.md). The
// legacy `three` facet is NOT in the fixed order — where a control carries
// one, the workbench appends a read-only "three · legacy" chip, and the
// shelf's 3d dot lights on either (SC-Q2).
export const FACETS = ["html", "css", "js", "data", "scene", "cmd"];
