// jump — global search. Library and control NAMES match instantly from a
// list built in the browser; CONTENT hits (command source, facets, assets)
// follow from dev.search.query once the query has 3+ characters. ⌘K focuses,
// arrows move, Enter opens, Escape closes.
//
// DATA: {openLib, openControl}.

var me = this;
var ME = document.getElementById(me.UUID);

var MAX_NAMES = 8;
var MAX_CONTENT = 20;
var CONTENT_MIN = 3;      // dev.search needs 3 bytes to use its masks
var CONTENT_DELAY = 220;  // ms of quiet typing before the backend is asked

var input = ME.querySelector(".j-input");
var pop = ME.querySelector(".j-pop");
var results = [];     // name rows first, then content rows, in display order
var nameCount = 0;
var note = "";        // status line under the rows
var selected = 0;
var seq = 0;          // bumps on every keystroke and close; stale replies drop
var timer = null;

const jsonP = (c2, v2) => new Promise((res2) => json(c2, v2, res2));

// Names jump can match without the backend — libraries and controls — built
// once from the platform's own reads (relative paths: tunnel-correct).
var INDEX = null;
async function searchIndex() {
  if (INDEX) return INDEX;
  const libsR = await jsonP("../app/libs", null);
  const libs = libsR.status === "ok" ? (libsR.data ?? []) : [];
  const rows = libs.map((l2) => ({ kind: "lib", name: l2.id, lib: l2.id }));
  await Promise.all(libs.map(async (l2) => {
    const r2 = await jsonP("../app/read", "lib=" + encodeURIComponent(l2.id) + "&id=controls");
    if (r2.status === "ok") {
      for (const c2 of (r2.data.list ?? [])) {
        rows.push({ kind: "ctl", name: c2.name, lib: l2.id, id: c2.id });
      }
    }
  }));
  INDEX = rows;
  return rows;
}

// dev.search.query through app/exec; the command id is resolved once.
var QUERY_ID = null;
async function contentQuery(q) {
  if (!QUERY_ID) {
    const index = await searchIndex();
    const ctl = index.find((row) => row.kind === "ctl" && row.lib === "dev" && row.name === "search");
    if (!ctl) return { status: "err", msg: "dev.search is not installed" };
    const rec = await jsonP("../app/read", "lib=dev&id=" + encodeURIComponent(ctl.id));
    const entry = rec.status === "ok" ? (rec.data.cmd ?? []).find((c2) => c2.name === "query") : null;
    if (!entry) return { status: "err", msg: "dev.search.query not found" };
    QUERY_ID = entry.id;
  }
  const args = { lib: "", ctl: "", kinds: "", query: q, limit: MAX_CONTENT };
  return jsonP("../app/exec", "lib=dev&id=" + encodeURIComponent(QUERY_ID)
    + "&args=" + encodeURIComponent(JSON.stringify(args)));
}

var KIND = { command: "cmd", facet: "facet", asset: "asset", control: "ctl" };
function label(m) {
  if (m.kind === "command") return m.ctl + "." + m.cmd;
  if (m.kind === "facet") return m.ctl + " · " + m.facet;
  if (m.kind === "asset") return m.asset || m.name;
  return m.ctl || m.name;
}

async function search(query) {
  const raw = query.trim();
  const q = raw.toLowerCase();
  const mine = ++seq;
  clearTimeout(timer);
  if (!q) return close();
  const index = await searchIndex();
  if (mine !== seq) return;
  results = index
    .filter((row) => row.name.toLowerCase().includes(q))
    .sort((a, b) =>
      a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q)
      || a.name.localeCompare(b.name))
    .slice(0, MAX_NAMES);
  nameCount = results.length;
  selected = 0;
  if (q.length < CONTENT_MIN) {
    note = nameCount ? "" : "nothing on the shelf matches";
    return render();
  }
  note = "searching content…";
  render();
  timer = setTimeout(() => searchContent(raw, mine, index), CONTENT_DELAY);
}

async function searchContent(q, mine, index) {
  const r = await contentQuery(q);
  if (mine !== seq) return;
  if (!r || r.status !== "ok") {
    note = "content search unavailable" + (r && r.msg ? ": " + r.msg : "");
    return render();
  }
  const matches = r.matches ?? [];
  const named = new Set(results.slice(0, nameCount)
    .filter((row) => row.kind === "ctl").map((row) => row.lib + "|" + row.name));
  const rows = [];
  for (const m of matches) {
    if (m.kind === "control" && named.has(m.lib + "|" + m.ctl)) continue;
    const ctl = m.ctl
      ? index.find((row) => row.kind === "ctl" && row.lib === m.lib && row.name === m.ctl)
      : null;
    rows.push({
      kind: KIND[m.kind] || m.kind, content: true, lib: m.lib,
      id: ctl ? ctl.id : null, name: label(m), line: m.line,
      facet: m.kind === "facet" ? m.facet : null,
      cmd: m.kind === "command" ? m.cmd : null,
      preview: String(m.preview ?? "").split("\n")[0].trim(),
    });
  }
  results = results.slice(0, nameCount).concat(rows);
  const more = (r.count ?? matches.length) - matches.length;
  if (more > 0) note = more + " more content match" + (more === 1 ? "" : "es") + " — refine the query";
  else if (results.length === 0) note = "nothing matches";
  else if (rows.length === 0) note = "no content matches";
  else note = "";
  render();
}

function render() {
  pop.hidden = false;
  input.setAttribute("aria-expanded", "true");
  const nodes = [];
  results.forEach((row, i) => {
    if (row.content && i === nameCount) {
      const sep = document.createElement("div");
      sep.className = "j-sep";
      sep.textContent = "in content";
      nodes.push(sep);
    }
    const btn = document.createElement("button");
    btn.className = "j-row" + (i === selected ? " sel" : "");
    btn.setAttribute("role", "option");
    btn.innerHTML =
      `<span class="j-kind"></span><span class="j-name"></span><span class="j-path"></span>`;
    const kind = btn.querySelector(".j-kind");
    kind.textContent = row.kind;
    kind.classList.add(`k-${row.kind}`);
    btn.querySelector(".j-name").textContent = row.name;
    btn.querySelector(".j-path").textContent = row.kind === "lib" ? "" : row.lib;
    if (row.content && row.preview) {
      const prev = document.createElement("span");
      prev.className = "j-prev";
      prev.textContent = (row.line ? row.line + ": " : "") + row.preview;
      btn.appendChild(prev);
    }
    btn.addEventListener("mousedown", (e) => { e.preventDefault(); open(row); });
    nodes.push(btn);
  });
  if (note) {
    const n = document.createElement("div");
    n.className = "j-none";
    n.textContent = note;
    nodes.push(n);
  }
  pop.replaceChildren(...nodes);
  const sel = pop.querySelector(".j-row.sel");
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
}

// A content hit opens the control that owns it, then its facet tab or its
// command; an asset opens its library.
function open(row) {
  close();
  input.value = "";
  if (row.kind === "lib" || !row.id) return ME.DATA.openLib(row.lib);
  const before = location.hash;
  ME.DATA.openControl(row.lib, row.id);
  if (!row.facet && !row.cmd) return;
  if (location.hash === before) reveal(row);
  else window.addEventListener("hashchange", () => reveal(row), { once: true });
}

// The workbench takes no facet or command in its route, so the hit is shown
// the way a person would show it: once the workbench has mounted (the frame's
// breadcrumb carries the control's name), press the facet's tab, or the
// commands tab and then the command's row. Gives up quietly after 8 s, or as
// soon as the user navigates elsewhere.
function reveal(row) {
  const at = location.hash;
  const t0 = Date.now();
  let tabbed = false;
  const tick = () => {
    if (location.hash !== at || Date.now() - t0 > 8000) return;
    const crumb = document.querySelector(".seg-ctl");
    const facet = row.cmd ? "cmd" : row.facet;
    const tab = document.querySelector('.wb-chip[id$="-tab-' + facet + '"]');
    if (!tab || !crumb || crumb.hidden || crumb.textContent === "\u2026") return setTimeout(tick, 60);
    if (!tabbed) { tabbed = true; tab.click(); }
    if (!row.cmd) return;
    const rows = document.querySelector(".wb-cmd-rows");
    if (rows && rows.hidden) return;   // a command is already open: leave it
    const hit = [...document.querySelectorAll(".wb-cmd-main")]
      .find((b) => b.querySelector(".cname")?.textContent === row.cmd);
    if (hit) hit.click(); else setTimeout(tick, 60);
  };
  tick();
}

function close() {
  seq++;
  clearTimeout(timer);
  pop.hidden = true;
  input.setAttribute("aria-expanded", "false");
  results = [];
  nameCount = 0;
  note = "";
}

input.addEventListener("input", () => search(input.value));
input.addEventListener("blur", () => setTimeout(close, 150));
input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { close(); input.blur(); }
  else if (event.key === "ArrowDown") { event.preventDefault(); selected = Math.min(selected + 1, results.length - 1); render(); }
  else if (event.key === "ArrowUp") { event.preventDefault(); selected = Math.max(selected - 1, 0); render(); }
  else if (event.key === "Enter" && results[selected]) open(results[selected]);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault();
    input.focus();
  }
});
