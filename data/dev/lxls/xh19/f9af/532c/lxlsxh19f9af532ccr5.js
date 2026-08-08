// floweditor — read-only viewer for flowlang graphs (format: docs/
// flowlang-format.md). Renders one Case as SVG: input bar top, output bar
// bottom, operations between, wires from `cons`. Local sub-flows drill down
// on double-click; `nextcase` chains render as case tabs. Editing is a later
// milestone.

const S = 140;               // px per world unit
const NODE_H = 46;
const BAR_H = 36;
const MARGIN = 60;
const SVG_NS = "http://www.w3.org/2000/svg";

const KIND_GLYPHS = { primitive: "⚙", command: "▤", local: "▣", constant: "◇" };

function svgEl(tag, attrs = {}, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}

export function init(host, { title, graph, onBack }) {
  host.querySelector(".fe-title").innerHTML = "";
  const titleEl = host.querySelector(".fe-title");
  titleEl.append(title.prefix + " ");
  const t = document.createElement("span");
  t.className = "t";
  t.textContent = title.name;
  titleEl.append(t, ` ${title.suffix ?? "(flowlang)"}`);

  const wrap = host.querySelector(".fe-svg-wrap");
  const crumbsEl = host.querySelector(".fe-crumbs");
  const inspectBody = host.querySelector(".fe-inspect-body");
  const stack = [{ label: "case 1", graph }];

  host.querySelector(".fe-back").addEventListener("click", () => {
    if (stack.length > 1) {
      stack.pop();
      render();
    } else {
      onBack();
    }
  });

  function currentCase() {
    return stack[stack.length - 1].graph;
  }

  function inspect(op, kind, extra = {}) {
    inspectBody.replaceChildren();
    const name = document.createElement("div");
    name.className = "fi-name";
    name.textContent = op?.name ?? extra.name ?? "";
    const badge = document.createElement("span");
    badge.className = "fi-kind";
    badge.textContent = kind;
    const dl = document.createElement("dl");
    const rows = {
      ...(op?.ctype ? { ctype: op.ctype } : {}),
      ...(op?.cmd ? { "command id": op.cmd } : {}),
      ...(op?.condition
        ? { condition: `${op.condition.rule} when match=${op.condition.value}` }
        : {}),
      ...(op ? {
        inputs: Object.keys(op.in ?? {}).join(", ") || "—",
        outputs: Object.keys(op.out ?? {}).join(", ") || "—",
      } : {}),
      ...extra.rows,
    };
    for (const [k, v] of Object.entries(rows)) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      dl.append(dt, dd);
    }
    inspectBody.append(name, badge, dl);
    if (op?.type === "local") {
      const p = document.createElement("p");
      p.textContent = "double-click the node to open this sub-flow";
      inspectBody.append(p);
    }
  }

  function render() {
    crumbsEl.textContent = stack.length > 1
      ? stack.map((s) => s.label).join(" ▸ ")
      : "";
    const c = currentCase();
    wrap.replaceChildren();

    // ── layout: world → screen ────────────────────────────
    const xs = c.cmds.map((op) => op.pos.x);
    const ys = c.cmds.map((op) => op.pos.y);
    const minX = Math.min(-1.5, ...xs) - 0.8;
    const maxX = Math.max(1.5, ...xs) + 0.8;
    const minY = Math.min(0, ...ys) - 0.5;
    const maxY = Math.max(0, ...ys) + 0.5;
    const W = (maxX - minX) * S + MARGIN * 2;
    const H = (maxY - minY) * S + MARGIN * 2 + BAR_H * 2 + 60;
    const sx = (x) => (x - minX) * S + MARGIN;
    // world +y is up; screen: input bar top, output bar bottom
    const sy = (y) => BAR_H + 50 + (maxY - y) * S;

    const svg = svgEl("svg", {
      width: W, height: H, viewBox: `0 0 ${W} ${H}`,
      role: "img", "aria-label": `Dataflow graph of ${title.name}`,
    });
    wrap.appendChild(svg);

    const centerX = W / 2;
    const barW = Math.min(W - MARGIN * 2, 320);

    // terminal position resolvers used by wires
    const termPos = new Map(); // `${idx}:${which}:${name}` -> [x, y]
    function barTerms(nodes, y, which, idx) {
      const names = Object.keys(nodes ?? {});
      names.forEach((name) => {
        const tx = centerX + (nodes[name].x ?? 0) * S;
        termPos.set(`${idx}:${which}:${name}`, [tx, y]);
      });
      return names;
    }

    // ── input bar (idx -1, outputs face DOWN into the case) ──
    const inBar = svgEl("g", { class: "fnode dark" });
    inBar.appendChild(svgEl("rect", {
      class: "body", x: centerX - barW / 2, y: 10, width: barW, height: BAR_H, rx: BAR_H / 2,
    }));
    inBar.appendChild(svgEl("text", {
      x: centerX, y: 10 + BAR_H / 2 + 4, "text-anchor": "middle",
    }, `⌘ params — ${Object.keys(c.input).join(", ") || "none"}`));
    for (const name of barTerms(c.input, 10 + BAR_H, "out", -1)) {
      const [tx, ty] = termPos.get(`-1:out:${name}`);
      inBar.appendChild(svgEl("circle", { class: "term", cx: tx, cy: ty, r: 5 }));
    }
    inBar.addEventListener("click", () =>
      inspect(null, "entry", { name: "params", rows: mapTypes(c.input) }));
    svg.appendChild(inBar);

    // ── output bar (idx -2, inputs face UP) ──
    const outY = H - BAR_H - 10;
    const outBar = svgEl("g", { class: "fnode dark" });
    outBar.appendChild(svgEl("rect", {
      class: "body", x: centerX - barW / 2, y: outY, width: barW, height: BAR_H, rx: BAR_H / 2,
    }));
    outBar.appendChild(svgEl("text", {
      x: centerX, y: outY + BAR_H / 2 + 4, "text-anchor": "middle",
    }, `⌘ return — ${Object.keys(c.output).join(", ") || "none"}`));
    for (const name of barTerms(c.output, outY, "in", -2)) {
      const [tx, ty] = termPos.get(`-2:in:${name}`);
      outBar.appendChild(svgEl("circle", { class: "term", cx: tx, cy: ty, r: 5 }));
    }
    outBar.addEventListener("click", () =>
      inspect(null, "exit", { name: "return", rows: mapTypes(c.output) }));
    svg.appendChild(outBar);

    // ── operations ────────────────────────────────────────
    c.cmds.forEach((op, idx) => {
      const w = Math.max(op.width * S * 0.6, 90);
      const cx = sx(op.pos.x);
      const cy = sy(op.pos.y);
      const g = svgEl("g", { class: `fnode k-${op.type}`, tabindex: 0 });
      g.appendChild(svgEl("rect", {
        class: "body", x: cx - w / 2, y: cy - NODE_H / 2, width: w, height: NODE_H,
        rx: op.type === "constant" ? NODE_H / 2 : 8,
      }));
      if (op.type === "local") {
        g.appendChild(svgEl("rect", {
          class: "inner", x: cx - w / 2 + 4, y: cy - NODE_H / 2 + 4,
          width: w - 8, height: NODE_H - 8, rx: 5,
        }));
      }
      const label = `${KIND_GLYPHS[op.type] ?? ""} ${op.name}`;
      g.appendChild(svgEl("text", {
        x: cx, y: cy + (op.type === "constant" ? 4 : 0), "text-anchor": "middle",
      }, label.length > 24 ? label.slice(0, 23) + "…" : label));
      if (op.type !== "constant") {
        g.appendChild(svgEl("text", {
          class: "sub", x: cx, y: cy + 14, "text-anchor": "middle",
        }, op.type === "command" ? "command" : op.type));
      }
      if (op.condition) {
        g.appendChild(svgEl("text", {
          class: "cond-flag", x: cx + w / 2 + 4, y: cy - NODE_H / 2 + 10,
        }, `⚑ ${op.condition.rule}`));
      }

      for (const [which, nodes, edgeY] of [
        ["in", op.in, cy - NODE_H / 2],
        ["out", op.out, cy + NODE_H / 2],
      ]) {
        for (const [name, node] of Object.entries(nodes ?? {})) {
          const tx = cx + Math.max(-w / 2 + 8, Math.min(w / 2 - 8, (node.x ?? 0) * S));
          termPos.set(`${idx}:${which}:${name}`, [tx, edgeY]);
          const cls = node.loop ? "term t-loop" : node.list ? "term t-list" : "term";
          g.appendChild(svgEl("circle", { class: cls, cx: tx, cy: edgeY, r: 5 }));
        }
      }

      g.addEventListener("click", () => {
        for (const n of svg.querySelectorAll(".fnode.sel")) n.classList.remove("sel");
        g.classList.add("sel");
        inspect(op, op.type);
      });
      if (op.type === "local" && op.localdata) {
        g.addEventListener("dblclick", () => {
          stack.push({ label: `local: ${op.name}`, graph: op.localdata });
          render();
        });
      }
      svg.appendChild(g);
    });

    // ── wires (drawn under nothing — append first would be nicer, but
    //     terminals are small; insert wires before nodes for z-order) ──
    const wireGroup = svgEl("g");
    svg.insertBefore(wireGroup, svg.firstChild);
    for (const con of c.cons) {
      const [si, st] = con.src;
      const [di, dt] = con.dest;
      const from = termPos.get(`${si}:out:${st}`) ?? termPos.get(`${si}:in:${st}`);
      const to = termPos.get(`${di}:in:${dt}`) ?? termPos.get(`${di}:out:${dt}`);
      if (!from || !to) continue;
      const midY = (from[1] + to[1]) / 2;
      wireGroup.appendChild(svgEl("path", {
        class: "wire",
        d: `M ${from[0]} ${from[1]} C ${from[0]} ${midY}, ${to[0]} ${midY}, ${to[0]} ${to[1]}`,
      }));
    }

    // ── nextcase tab ──────────────────────────────────────
    if (c.nextcase) {
      const tab = svgEl("text", {
        x: W - MARGIN, y: 30, "text-anchor": "end",
        class: "wire-lbl", style: "cursor:pointer",
      }, "next case ▸");
      tab.addEventListener("click", () => {
        stack.push({ label: "next case", graph: c.nextcase });
        render();
      });
      svg.appendChild(tab);
    }
  }

  function mapTypes(nodes) {
    return Object.fromEntries(
      Object.entries(nodes ?? {}).map(([k, v]) => [k, v.type ?? "?"]));
  }

  render();
  return {};
}
