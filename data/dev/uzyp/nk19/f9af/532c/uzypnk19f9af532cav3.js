// card — the paper control-card: name, description, and six facet dots
// showing which facets the control carries. Used by the shelf's fan.
//
// DATA: {name, onOpen}. api: setRecord(record).

var me = this;
var ME = document.getElementById(me.UUID);

var root = ME.querySelector(".nb-card");
var dotsEl = root.querySelector(".c-dots");
root.querySelector(".c-name").textContent = ME.DATA.name;
root.addEventListener("click", ME.DATA.onOpen);

// the dots wait on the facets module; setRecord queues behind them
var dotsReady = requireModule("facets", "card").then(function (m) {
  for (const facet of m.FACETS) {
    const dot = document.createElement("span");
    dot.className = "c-dot";
    dot.dataset.facet = facet;
    dot.setAttribute("role", "img");
    dot.setAttribute("aria-label", `${facet}: unknown`);
    dotsEl.appendChild(dot);
  }
});

/** Fill in description + facet dots once the control record is loaded. */
me.setRecord = function (record) {
  dotsReady.then(function () {
    root.querySelector(".c-desc").textContent = record?.desc ?? "";
    // The access badge: the security-group string verbatim; open
    // (anonymous) shows nothing; no groups = the platform default,
    // admin-only.
    const gateEl = root.querySelector(".c-gate");
    const g = (record?.groups ?? "").trim();
    const open = g.split(",").map((s) => s.trim()).includes("anonymous");
    gateEl.textContent = record ? (g ? (open ? "" : `⛨ ${g}`) : "⛨ admin") : "";
    gateEl.title = g ? `security groups: ${g}` : "admin only — no groups granted";
    for (const dot of dotsEl.children) {
      const facet = dot.dataset.facet;
      // The 3d dot lights on the scene facet OR the legacy three facet
      // (scene-facet-design SC-Q2).
      const present = facet === "scene"
        ? record?.scene !== undefined || record?.three !== undefined
        : record?.[facet] !== undefined
          && (facet !== "cmd" || (record.cmd?.length ?? 0) > 0);
      dot.classList.toggle(`on-${facet}`, present);
      dot.setAttribute("aria-label", `${facet}: ${record ? (present ? "present" : "absent") : "unknown"}`);
    }
  });
};
