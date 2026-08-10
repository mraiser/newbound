// preview — renders a control's html+css facets inside a shadow root (styles
// stay scoped both ways) and implements in-situ picking: hover shows an amber
// tag naming the source, click maps the element back to its line in the html
// facet via onPick. JS execution is deliberately off in M1 (see DEVIATIONS.md).


var me = this;
var ME = document.getElementById(me.UUID);

var readyP = (async () => {

function init(host, { lib, name, record, onPick }) {
  host.querySelector(".pv-where").textContent = `${lib} ▸ ${name}`;
  const stage = host.querySelector(".pv-stage");
  const tag = host.querySelector(".pv-tag");
  const html = record.html;

  if (html === undefined || html.trim() === "") {
    const empty = host.querySelector(".pv-empty");
    empty.hidden = false;
    empty.textContent = html === undefined
      ? "this control has no html facet — nothing to render"
      : "the html facet is empty — this control draws itself in js (js execution lands in M2)";
    stage.hidden = true;
    return {};
  }

  const shadow = stage.attachShadow({ mode: "open" });
  shadow.innerHTML =
    `<style>:host{display:block}${record.css ?? ""}</style>` +
    `<div class="nb-pv-root">${html}</div>`;

  const root = shadow.querySelector(".nb-pv-root");
  const sourceLines = html.split("\n");

  /** Map an element to the line of its opening tag in the html facet source.
      Heuristic (M1): find the nth source line containing the same tag (and
      first class, when present) counting matching elements in DOM order. */
  function sourceLineOf(el) {
    const tagName = el.tagName.toLowerCase();
    const cls = el.classList[0];
    const needle = cls
      ? new RegExp(`<${tagName}[^>]*class=["'][^"']*(?:^|[\\s"'])?${cls}`)
      : new RegExp(`<${tagName}[\\s>/]`);
    const peers = [...root.querySelectorAll(cls ? `${tagName}.${CSS.escape(cls)}` : tagName)];
    const nth = peers.indexOf(el);
    let seen = 0;
    for (let i = 0; i < sourceLines.length; i++) {
      if (needle.test(sourceLines[i]) && seen++ === nth) return i + 1;
    }
    return null;
  }

  function labelOf(el) {
    const cls = el.classList[0];
    return `html · <${el.tagName.toLowerCase()}${cls ? "." + cls : ""}>`;
  }

  for (const el of root.querySelectorAll("*")) {
    el.style.cursor = "pointer";
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `open source of ${labelOf(el)}`);

    el.addEventListener("mouseenter", () => {
      el.style.outline = "2px solid #f0a63c";
      el.style.outlineOffset = "2px";
      const rect = el.getBoundingClientRect();
      tag.textContent = labelOf(el);
      tag.style.left = `${rect.left}px`;
      tag.style.top = `${Math.max(rect.top - 22, 4)}px`;
      tag.hidden = false;
    });
    el.addEventListener("mouseleave", () => {
      el.style.outline = "";
      tag.hidden = true;
    });
    const pick = (event) => {
      event.stopPropagation();
      event.preventDefault();
      onPick({ label: labelOf(el), line: sourceLineOf(el) });
    };
    el.addEventListener("click", pick);
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") pick(event);
    });
  }

  return {};
}

  return init(ME, ME.DATA || {});
})().catch(function (e) {
  console.log("preview failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
