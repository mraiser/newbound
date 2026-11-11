// card — the paper control-card: name, access groups, description, and six
// facet dots showing which facets the control carries. Used by the shelf.
//
// DATA: {name, onOpen}. api: setRecord(record).

var me = this;
var ME = document.getElementById(me.UUID);

var root = ME.querySelector(".nb-card");
var dotsEl = root.querySelector(".c-dots");
root.querySelector(".c-name").textContent = ME.DATA.name;
root.addEventListener("click", ME.DATA.onOpen);

// one glyph per well-known group, from the shared app icon set; any other
// group name gets the lock
var GROUP_ICONS = { admin: "shield", anonymous: "group", user: "user", update: "refresh" };
function groupIcon(g) {
  return "url(../app/asset/app/icons/ui/light/" + (GROUP_ICONS[g] || "lock") + ".svg)";
}

// the dots wait on the facets library (a child div, ready before this
// control's ready); setRecord queues behind them
var dotsReady = new Promise(function (res) { me.ready = res; }).then(function () {
  const { FACETS } = ME.querySelector('[data-control="dev:facets"]').api;
  for (const facet of FACETS) {
    const dot = document.createElement("span");
    dot.className = "c-dot";
    dot.dataset.facet = facet;
    dot.setAttribute("role", "img");
    dot.setAttribute("aria-label", `${facet}: unknown`);
    dotsEl.appendChild(dot);
  }
});

/** Fill in groups, description + facet dots once the control record is loaded. */
me.setRecord = function (record) {
  dotsReady.then(function () {
    root.querySelector(".c-desc").textContent = record?.desc ?? "";
    // The access groups: the security-group string, one chip per group; no
    // groups = the platform default, admin-only.
    const gateEl = root.querySelector(".c-gate");
    gateEl.replaceChildren();
    if (record) {
      const g = (record.groups ?? "").trim();
      const names = g ? g.split(",").map((s) => s.trim()).filter(Boolean) : ["admin"];
      for (const name of names) {
        const chip = document.createElement("span");
        chip.className = "c-group";
        const icon = document.createElement("i");
        icon.className = "c-gi";
        icon.setAttribute("aria-hidden", "true");
        icon.style.setProperty("--ic", groupIcon(name));
        chip.append(icon, document.createTextNode(name));
        gateEl.appendChild(chip);
      }
      gateEl.title = g ? `security groups: ${g}` : "admin only — no groups granted";
    }
    for (const dot of dotsEl.children) {
      const facet = dot.dataset.facet;
      // The 3d dot lights on the scene facet OR the legacy three facet
      // (scene-facet-design SC-Q2).
      const present = facet === "scene"
        ? record?.scene !== undefined || record?.three !== undefined
        : record?.[facet] !== undefined
          && (facet !== "cmd" || (record.cmd?.length ?? 0) > 0);
      dot.classList.toggle(`on-${facet}`, present);
      // a COMPONENT control: its scene facet is a SHAPE and its js declares
      // per-instance behaviors (me.render / me.animate / me.click) — hosted by
      // app:scenehost. Mark the dot so the shelf can tell it from a declarative
      // scene (read straight from record.js — no boot).
      if (facet === "scene" && present && typeof record?.js === "string") {
        const js = record.js;
        const isComp = /me\.(render|animate|click)\s*=\s*function/.test(js);
        if (isComp) {
          dot.classList.add("on-component");
          dot.title = "component — a 3D object: shape (scene facet) + per-instance behaviors (js)";
        }
      }
      dot.setAttribute("aria-label", `${facet}: ${record ? (present ? "present" : "absent") : "unknown"}`);
    }
  });
};
