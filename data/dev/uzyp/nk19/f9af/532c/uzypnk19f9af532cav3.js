// card — the paper control-card: name, description, and six facet dots
// showing which facets the control carries. Used by the shelf's fan.

import { FACETS } from "../../assets/facets.js";

export function init(host, { name, onOpen }) {
  const root = host.querySelector(".nb-card");
  root.querySelector(".c-name").textContent = name;
  root.addEventListener("click", onOpen);

  const dotsEl = root.querySelector(".c-dots");
  for (const facet of FACETS) {
    const dot = document.createElement("span");
    dot.className = "c-dot";
    dot.dataset.facet = facet;
    dot.setAttribute("role", "img");
    dot.setAttribute("aria-label", `${facet}: unknown`);
    dotsEl.appendChild(dot);
  }

  return {
    /** Fill in description + facet dots once the control record is loaded. */
    setRecord(record) {
      root.querySelector(".c-desc").textContent = record?.desc ?? "";
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
    },
  };
}
