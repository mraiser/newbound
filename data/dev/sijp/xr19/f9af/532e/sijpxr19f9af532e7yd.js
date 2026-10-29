// workbench — one control's facets, editors, commands, wiring and preview.
// Every save is a patch through dev.code.patch_control_facet — minimal
// exact-match snippet (whole-facet replace as the fallback shape),
// base-hash concurrency — and the shared per-control journal renders as
// the timeline strip with inverse-patch revert. Absent ui facets are
// creatable (empty old_snippet).


var me = this;
var ME = document.getElementById(me.UUID);

var readyP = new Promise(function (res) { me.ready = res; }).then(async () => {
  const { FACETS } = document.querySelector('[data-control="dev:facets"]').api;
  const viewctx = document.querySelector(".nb-viewctx").api;
  // ── backend calls: api.js primitives only ─────────────────
  const jsonP = (c2, v2) => new Promise((res2) => json(c2, v2, res2));
  const invokeP = (l2, c2, m2, a2) => new Promise((res2) => invokeCommand(l2, c2, m2, a2, res2));
  const invoke = async (l2, c2, m2, a2) => {
    const t0 = performance.now();
    const envelope = await invokeP(l2, c2, m2, a2);
    return { envelope, ms: Math.round(performance.now() - t0) };
  };
  const code = (m2, a2) => invokeP("dev", "code", m2, a2);
  const readRec = async (l2, id2) => {
    const r2 = await jsonP("../app/read", "lib=" + encodeURIComponent(l2) + "&id=" + encodeURIComponent(id2));
    return r2.status === "ok" ? r2.data : new Error(r2.msg || "read failed");
  };
  const controlsOf = async (l2) => {
    const d2 = await readRec(l2, "controls");
    return d2 instanceof Error ? d2 : (d2.list ?? []);
  };
  const readFacet = (l2, c2, f2) => code("read_control_facet", { lib: l2, ctl: c2, facet: f2 });
  const patchFacet = (l2, c2, f2, { oldSnippet, newSnippet, base = "", label = "" }) =>
    code("patch_control_facet", { lib: l2, ctl: c2, facet: f2, old_snippet: oldSnippet,
      new_snippet: newSnippet, base, label, author: "" });
  const listPatches = (l2, c2, n2) => code("list_control_patches", { lib: l2, ctl: c2, limit: n2 ?? 0 });
  const setControlMeta = (l2, c2, d2, g2) => code("set_control_meta", { lib: l2, ctl: c2, desc: d2, groups: g2 });
  const setCommandMeta = (l2, c2, m2, d2, g2) => code("set_command_meta", { lib: l2, ctl: c2, cmd: m2, desc: d2, groups: g2 });
  const setTags = (l2, c2, m2, t2) => code("set_tags", { lib: l2, ctl: c2, cmd: m2, tags: t2, author: "" });
  const setGroups = (l2, c2, m2, g2) => code("set_groups", { lib: l2, ctl: c2, cmd: m2, groups: g2, author: "" });
  const securityGroups = async () => {
    const r2 = await jsonP("../security/groups", null);
    return r2 && r2.status === "ok" && Array.isArray(r2.data) ? r2.data : [];
  };
  const writeControlScene = (l2, c2, sc2, { base = "", label = "" } = {}) =>
    code("write_control_scene", { lib: l2, ctl: c2, scene: sc2, base, label, author: "" });
  const readCommand = async (l2, c2, m2) => {
    const r2 = await code("read_command", { lib: l2, ctl: c2, cmd: m2 });
    if (r2.status !== "ok") return r2;
    return { status: "ok", ...(r2.data && typeof r2.data === "object" ? r2.data : {}) };
  };
  const patchCommandBody = (l2, c2, m2, o2, n2) =>
    code("patch_command_body", { lib: l2, ctl: c2, cmd: m2, old_snippet: o2, new_snippet: n2 });
  const setCommandImports = (l2, c2, m2, i2) => code("set_command_imports", { lib: l2, ctl: c2, cmd: m2, imports: i2 });
  const upsertCommand = (l2, c2, m2, { lang, returnType, params = [], imports = "", codeBody = "" }) =>
    code("upsert_command", { lib: l2, ctl: c2, cmd: m2, lang, return_type: returnType, params, imports, code_body: codeBody });
  const writeFlowBody = (l2, c2, m2, b2, { base = "", label = "" } = {}) =>
    code("write_flow_body", { lib: l2, ctl: c2, cmd: m2, body: b2, base, label, author: "" });
  const deleteCommand = (l2, c2, m2) => code("delete_command", { lib: l2, ctl: c2, cmd: m2, author: "" });
  const setTimer = (l2, c2, t2) => code("set_timer", { lib: l2, ctl: c2, ...t2, author: "" });
  const removeTimer = (l2, c2, n2) => code("remove_timer", { lib: l2, ctl: c2, name: n2, author: "" });
  const setEventHandler = (l2, c2, e2) => code("set_event_handler", { lib: l2, ctl: c2, ...e2, author: "" });
  const removeEventHandler = (l2, c2, n2) => code("remove_event_handler", { lib: l2, ctl: c2, name: n2, author: "" });
  const metaIdentity = () => code("get_meta_identity", {});
  const setMetaIdentity = (d2, o2) => code("set_meta_identity", { displayname: d2, organization: o2, author: "" });
  // mount a child control and resolve with its api once it is ready —
  // installControl is the platform's own mounter; waitReady is the
  // convention converted controls expose when their setup is async
  function mount(name, el, props) {
    return new Promise(function (res) {
      installControl(el, "dev", name, function (api) {
        if (api && api.waitReady) api.waitReady(function () { res(api); });
        else res(api);
      }, props || {});
    });
  }

const UI_FACETS = new Set(["html", "css", "js"]);
const CMD_LANGS = ["rust", "js", "java", "python", "py", "flow"];
const LANG_NAMES = { rust: "Rust", python: "Python", flow: "Flow", js: "JavaScript", java: "Java", py: "Python" };
// the platform save hint: ⌘S on macOS, Ctrl+S elsewhere (C3/C12)
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
const SAVE_KBD = IS_MAC ? "⌘S" : "Ctrl+S";
const TRASH_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>';
const LOCK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const EDITOR_LANG = { html: "html", css: "css", js: "js", data: "json", three: "json" };
const FACET_HUES = {
  html: "var(--f-html)", css: "var(--f-css)", js: "var(--f-js)",
  data: "var(--f-data)", scene: "var(--f-3d)", three: "var(--f-3d)", cmd: "var(--f-cmd)",
  // journal-only facets: flow/timer/event entries share the strip
  flow: "var(--f-cmd)", timer: "var(--f-data)", event: "var(--f-3d)",
};
const TIME_UNITS = ["milliseconds", "seconds", "minutes", "hours", "days"];
const HISTORY_LIMIT = 30;

function commandLang(entry) {
  return CMD_LANGS.find((lang) => entry[lang] !== undefined) ?? "?";
}

async function init(host, { lib, ctlId, toast }) {
  const index = await controlsOf(lib);
  const entry = (index instanceof Error ? [] : index).find((c) => c.id === ctlId);
  const record = await readRec(lib, ctlId);
  if (record instanceof Error) {
    host.querySelector(".wb-absent").hidden = false;
    host.querySelector(".wb-absent").textContent =
      `could not read this control: ${record.message}`;
    return { name: entry?.name ?? "unavailable" };
  }
  const name = record.name ?? entry?.name ?? "unnamed";
  const writable = true;
  const journalMode = true;
  const patchMode = writable && journalMode;
  const hashes = new Map();       // facet -> base hash from read_control_facet

  const chipsEl = host.querySelector(".wb-chips");
  const editorsEl = host.querySelector(".wb-editors");
  const cmdsEl = host.querySelector(".wb-cmds");
  const threeEl = host.querySelector(".wb-three");
  const sceneEl = host.querySelector(".wb-scene");
  const absentEl = host.querySelector(".wb-absent");
  const conflictEl = host.querySelector(".wb-conflict");

  const chips = new Map();
  const editors = new Map();      // facet -> {api, slot}
  const baselines = new Map();    // facet -> source at load/last save
  const dirty = new Set();
  let activeFacet = null;

  function facetPresent(facet) {
    if (facet === "cmd") return (record.cmd?.length ?? 0) > 0;
    return record[facet] !== undefined;
  }

  function facetSource(facet) {
    if (facet === "data") {
      return record.data === undefined ? "" : JSON.stringify(record.data, null, 1);
    }
    if (facet === "three") {
      return typeof record.three === "string"
        ? record.three : JSON.stringify(record.three, null, 1);
    }
    return record[facet] ?? "";
  }

  // ── chips + actions ───────────────────────────────────────
  // One shared tabpanel (the pane): every tab's aria-controls points at it
  // and setFacet re-labels it (C1).
  const paneEl = host.querySelector(".wb-pane");
  const paneId = `${host.id}-pane`;
  paneEl.id = paneId;
  paneEl.setAttribute("role", "tabpanel");

  function makeChip(facet, label) {
    const chip = document.createElement("button");
    chip.className = "wb-chip";
    chip.id = `${host.id}-tab-${facet}`;
    chip.setAttribute("role", "tab");
    chip.setAttribute("aria-selected", "false");
    chip.setAttribute("aria-controls", paneId);
    chip.tabIndex = -1;
    chip.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="fname"></span><span class="cnt"></span>`;
    chip.querySelector(".dot").style.background = FACET_HUES[facet];
    chip.querySelector(".fname").textContent = label;
    chip.addEventListener("click", () => setFacet(facet));
    chipsEl.appendChild(chip);
    chips.set(facet, chip);
    return chip;
  }
  for (const facet of FACETS) makeChip(facet, facet === "cmd" ? "commands" : facet);

  // Legacy `three` facet: not in the fixed order — a read-only chip appears
  // only where the facet exists (scene-facet-design Part V).
  if (record.three !== undefined) {
    makeChip("three", "three · legacy").title =
      "the pre-redesign 3D facet — read-only; the go-forward facet is scene";
  }

  // Roving tabindex (C1): ←/→ wrap around the tabs, Home/End jump.
  chipsEl.addEventListener("keydown", (e) => {
    if (!e.target.closest(".wb-chip")) return;
    const order = [...chips.keys()];
    let i = Math.max(0, order.indexOf(activeFacet));
    if (e.key === "ArrowRight") i = (i + 1) % order.length;
    else if (e.key === "ArrowLeft") i = (i - 1 + order.length) % order.length;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = order.length - 1;
    else return;
    e.preventDefault();
    setFacet(order[i]).then(() => chips.get(order[i])?.focus());
  });

  const actionsEl = host.querySelector(".wb-actions");
  const stateEl = actionsEl.querySelector(".wb-ctl-state");
  const saveBtn = actionsEl.querySelector(".wb-save");
  saveBtn.querySelector("kbd").textContent = SAVE_KBD;
  saveBtn.addEventListener("click", () => save());
  const labelInput = actionsEl.querySelector(".wb-label");

  // A facet's chip ungreys the moment its editor holds content, before any
  // save; the commands chip counts, or reads `none` (C1).
  function refreshChip(facet) {
    const chip = chips.get(facet);
    if (!chip || facet === "three") return;
    const cnt = chip.querySelector(".cnt");
    if (facet === "cmd") {
      const n = record.cmd?.length ?? 0;
      chip.classList.toggle("absent", n === 0);
      if (cnt) cnt.textContent = n > 0 ? String(n) : "none";
      return;
    }
    const buf = editors.get(facet)?.api.getValue();
    const present = facetPresent(facet) || Boolean(buf);
    chip.classList.toggle("absent", !present);
    if (cnt) cnt.textContent = present ? "" : "none";
  }

  function refreshDirtyUi() {
    for (const [facet, chip] of chips) {
      refreshChip(facet);
      const mark = chip.querySelector(".dirty");
      if (dirty.has(facet) && !mark) {
        const dot = document.createElement("span");
        dot.className = "dirty";
        dot.textContent = "•";
        dot.setAttribute("aria-label", "unsaved changes");
        chip.appendChild(dot);
      } else if (!dirty.has(facet) && mark) {
        mark.remove();
      }
    }
    // Save control covers EVERY dirty ui facet, from any editor (C3).
    const dirtyUi = [...UI_FACETS].filter((f) => dirty.has(f));
    stateEl.textContent = dirtyUi.length ? `unsaved: ${dirtyUi.join(", ")}` : "no control changes";
    stateEl.classList.toggle("dirty", dirtyUi.length > 0);
    saveBtn.disabled = dirtyUi.length === 0;
  }

  // ── facet switching ───────────────────────────────────────
  async function ensureEditor(facet) {
    if (editors.has(facet)) return editors.get(facet);
    const slot = document.createElement("div");
    editorsEl.appendChild(slot);
    const api = await mount("editor", slot, {
      language: EDITOR_LANG[facet] ?? "html",
      readOnly: !(writable && UI_FACETS.has(facet)),
      onChange: () => {
        const changed = api.getValue() !== baselines.get(facet);
        if (changed) dirty.add(facet); else dirty.delete(facet);
        refreshDirtyUi();
      },
      onSave: () => save(),
    });
    let source = facetSource(facet);
    if (journalMode && UI_FACETS.has(facet)) {
      // The API's read is the authority: \r-normalized source + the base
      // hash that patch_control_facet checks concurrency against.
      const rf = await readFacet(lib, name, facet);
      if (rf.status === "ok") {
        source = rf.source;
        hashes.set(facet, rf.hash);
      }
    }
    api.setSource(source);
    baselines.set(facet, source);
    editors.set(facet, { api, slot });
    return editors.get(facet);
  }

  async function setFacet(facet) {
    activeFacet = facet;
    for (const [f, chip] of chips) {
      chip.classList.toggle("on", f === facet);
      chip.setAttribute("aria-selected", String(f === facet));
      chip.tabIndex = f === facet ? 0 : -1;
    }
    paneEl.setAttribute("aria-labelledby", chips.get(facet)?.id ?? "");
    cmdsEl.hidden = true;
    threeEl.hidden = true;
    sceneEl.hidden = true;
    absentEl.hidden = true;
    // hide the editors CONTAINER too — it is 100% tall, and an empty visible
    // container pushes the commands/three panes below the fold
    editorsEl.hidden = true;
    for (const { slot } of editors.values()) slot.hidden = true;

    if (facet === "scene") {
      // The scene pane owns its own absent/read-only states (the editor
      // creates the facet on first save when the pair is present).
      sceneEl.hidden = false;
      await renderScene();
    } else if (facet === "cmd" && (facetPresent("cmd") || patchMode)) {
      // zero commands is a normal state in patch mode: the pane's
      // new-command form IS the create affordance — same spirit as the
      // html/css/js create-on-save editors, so it must not sit behind
      // the absent gate
      cmdsEl.hidden = false;
      renderCommands();
    } else if (facet === "three") {
      threeEl.hidden = false;
      await renderThree();
    } else {
      // C2: an absent facet opens the same full-height editor as a present
      // one — no empty-state message in its place. Saving a ui facet
      // creates it (empty old_snippet = create/replace); the data editor
      // stays read-only.
      const { slot } = await ensureEditor(facet);
      editorsEl.hidden = false;
      slot.hidden = false;
    }
    refreshDirtyUi();
  }

  // ── saving ────────────────────────────────────────────────
  // Save control (and Mod-S from any facet editor) saves EVERY dirty ui
  // facet — one journaled patch per facet, all under the same label (C3).
  async function save() {
    if (!writable) return;
    const targets = [...UI_FACETS].filter((f) => dirty.has(f));
    if (!targets.length) return;
    const label = labelInput?.value.trim() ?? "";
    const outcomes = [];
    for (const facet of targets) {
      const source = editors.get(facet).api.getValue();
      outcomes.push({ facet, result: await savePatch(facet, source, false, label) });
    }
    const facetsOf = (kind) =>
      outcomes.filter((o) => o.result === kind).map((o) => o.facet);
    const saved = facetsOf("saved");
    const conflicted = facetsOf("conflict");
    const failed = facetsOf("failed");
    if (saved.length && labelInput) labelInput.value = "";
    refreshDirtyUi();
    renderStrip();
    refreshPreview();
    const bits = [];
    if (saved.length) bits.push(`saved ${saved.join(", ")}`);
    if (conflicted.length) bits.push(`${conflicted.join(", ")} conflicted — see the banner`);
    if (failed.length) bits.push(`${failed.join(", ")} failed`);
    if (bits.length) toast.show(`patch_control_facet → ${bits.join(" · ")}`);
  }

  // The patch path: compute the minimal exact-match snippet
  // between the last-known server state and the editor; widen it until it is
  // unique, or fall back to a whole-facet replace. Returns null on no change.
  function computePatch(oldText, newText) {
    if (oldText === newText) return null;
    if (!oldText) return { oldSnippet: "", newSnippet: newText };
    let p = 0;
    while (p < oldText.length && p < newText.length && oldText[p] === newText[p]) p++;
    let s = 0;
    while (s < oldText.length - p && s < newText.length - p
           && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
    let start = p;
    let end = oldText.length - s;
    for (;;) {
      const snippet = oldText.slice(start, end);
      if (snippet && oldText.split(snippet).length === 2) {
        return {
          oldSnippet: snippet,
          newSnippet: newText.slice(start, newText.length - (oldText.length - end)),
        };
      }
      if (start === 0 && end === oldText.length) {
        return { oldSnippet: "", newSnippet: newText };
      }
      start = Math.max(0, start - 24);
      end = Math.min(oldText.length, end + 24);
    }
  }

  // One facet's save. Returns "saved" | "conflict" | "failed" | "nochange";
  // the caller reports the whole batch. A stale base raises the conflict
  // banner for THIS facet only — the rest of the batch still saves (C3).
  async function savePatch(facet, source, overwrite, label = "") {
    let patch;
    let base;
    if (overwrite) {
      // Rebase mine over theirs: re-read for a fresh base, replace whole.
      const rf = await readFacet(lib, name, facet);
      if (rf.status !== "ok") {
        toast.show(`re-read failed: ${rf.msg}`);
        return "failed";
      }
      patch = { oldSnippet: "", newSnippet: source };
      base = rf.hash;
    } else {
      patch = computePatch(baselines.get(facet) ?? "", source);
      if (!patch) {
        dirty.delete(facet);
        refreshDirtyUi();
        return "nochange";
      }
      base = hashes.get(facet) ?? "";
    }

    const r = await patchFacet(lib, name, facet, { ...patch, base, label });
    if (r.status !== "ok") {
      if (r.msg === "stale_base") {
        conflictEl.hidden = false;
        conflictEl.querySelector(".wc-msg").textContent =
          `the ${facet} facet changed on the server since you loaded it`;
        conflictEl.querySelector(".wc-theirs").onclick = async () => {
          pushHistory(facet, source, "conflict-stash");
          const rf = await readFacet(lib, name, facet);
          if (rf.status === "ok") {
            editors.get(facet).api.setSource(rf.source);
            baselines.set(facet, rf.source);
            hashes.set(facet, rf.hash);
            record[facet] = rf.source;
            dirty.delete(facet);
          }
          conflictEl.hidden = true;
          refreshDirtyUi();
          renderStrip();
          refreshPreview();
          toast.show("loaded theirs — your version is in the strip's stash");
        };
        conflictEl.querySelector(".wc-mine").onclick = async () => {
          conflictEl.hidden = true;
          const r2 = await savePatch(facet, source, true, label);
          refreshDirtyUi();
          renderStrip();
          refreshPreview();
          toast.show(r2 === "saved"
            ? `overwrote theirs — ${facet} saved`
            : `the ${facet} save failed`);
        };
        return "conflict";
      }
      toast.show(`patch failed: ${r.msg}`);
      return "failed";
    }

    baselines.set(facet, source);
    hashes.set(facet, r.hash);
    record[facet] = source;
    dirty.delete(facet);
    refreshDirtyUi();
    return "saved";
  }

  // ── local history ─────────────────────────────────────────
  const historyKey = `bench.history.${lib}.${ctlId}`;

  function readHistory() {
    try {
      return JSON.parse(localStorage.getItem(historyKey)) ?? [];
    } catch {
      return [];
    }
  }

  function pushHistory(facet, content, kind) {
    const entries = readHistory();
    entries.unshift({ n: (entries[0]?.n ?? 0) + 1, facet, kind, ts: Date.now(), content });
    localStorage.setItem(historyKey, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
  }

  // ── the timeline strip ────────────────────────────────────
  // journalMode: the shared per-control journal (list_control_patches),
  // newest first, with inverse-patch revert; local conflict stashes are
  // appended so nothing is lost. Fallback: the M2 localStorage history.
  async function renderStrip() {
    if (!journalMode) {
      renderHistory();
      return;
    }
    host.querySelector(".wb-history .lbl").textContent = "patches";
    host.querySelector(".wb-hist-cap").innerHTML =
      `every save is a patch through <span class="hi">patch_control_facet</span>
       — every caller uses the same door`;
    const wrap = host.querySelector(".wb-hist-chips");
    const r = await listPatches(lib, name, 40);
    const entries = r.status === "ok" ? (r.patches ?? []) : [];
    const chipsOut = entries.map((p) => {
      const chip = document.createElement("span");
      chip.className = "wb-hist-chip wb-patch-chip";
      const when = new Date(p.time).toTimeString().slice(0, 5);
      chip.innerHTML = `<span class="hdot"></span><span class="ptxt"></span>`;
      chip.querySelector(".hdot").style.background = FACET_HUES[p.facet];
      const full = `${p.patch_id} · ${p.author || "?"} · ${p.facet}${p.label ? ` · ${p.label}` : ""}`;
      chip.querySelector(".ptxt").textContent = full;
      // the chip ellipsizes (C13) — the title carries the whole line
      chip.title = `${full} · ${when}`;
      // Revert routes per facet family: ui facets = inverse snippet patch,
      // timer/event = re-apply the old component through the setters, scene
      // = write the entry's old whole-object as a new write. Flow entries
      // get no ↩ — a whole-body revert belongs to the flow editor.
      const componentEntry = p.facet === "timer" || p.facet === "event";
      const sceneEntry = p.facet === "scene";
      if (patchMode && (UI_FACETS.has(p.facet) || componentEntry || sceneEntry)) {
        const undo = document.createElement("button");
        undo.className = "wb-revert";
        undo.textContent = "↩";
        undo.title = componentEntry
          ? `revert ${p.patch_id} — re-applies the previous ${p.facet} state as a new set/remove`
          : sceneEntry
            ? `revert ${p.patch_id} — writes the entry's old scene as a new write`
            : `revert ${p.patch_id} — applies the inverse as a new patch`;
        undo.addEventListener("click", () =>
          componentEntry ? revertComponent(p) : sceneEntry ? revertScene(p) : revertPatch(p));
        chip.appendChild(undo);
      }
      return chip;
    });
    const stashes = readHistory().filter((e) => e.kind === "conflict-stash")
      .map(stashChip);
    wrap.replaceChildren(...chipsOut, ...stashes);
  }

  async function revertScene(p) {
    let body;
    try { body = p.old ? JSON.parse(p.old) : {}; } catch { body = {}; }
    const r = await writeControlScene(lib, name, body, {
      base: "", label: `revert ${p.patch_id}`,
    });
    if (r.status !== "ok") {
      toast.show(`revert failed: ${r.msg}`);
      return;
    }
    record.scene = body;
    toast.show(`${p.patch_id} reverted — a new scene write`);
    // The mounted pane holds its own doc: remount it fresh from the store.
    host.querySelector(".wb-scene-slot").replaceChildren();
    if (activeFacet === "scene") await renderScene();
    renderStrip();
  }

  async function revertPatch(p) {
    // Revert = the inverse edit as a NEW patch (history is append-only).
    // The inverse's old_snippet is the patch's `new`; if that text is no
    // longer present exactly once, the facet has moved on — no write.
    const r = await patchFacet(lib, name, p.facet, {
      oldSnippet: p.new, newSnippet: p.old, base: "",
      label: `revert ${p.patch_id}`,
    });
    if (r.status !== "ok") {
      toast.show(/not found|ambiguous/i.test(r.msg ?? "")
        ? `cannot revert ${p.patch_id} cleanly — the ${p.facet} facet has changed since`
        : `revert failed: ${r.msg}`);
      return;
    }
    const rf = await readFacet(lib, name, p.facet);
    if (rf.status === "ok") {
      record[p.facet] = rf.source;
      baselines.set(p.facet, rf.source);
      hashes.set(p.facet, rf.hash);
      editors.get(p.facet)?.api.setSource(rf.source);
      dirty.delete(p.facet);
    }
    refreshDirtyUi();
    renderStrip();
    refreshPreview();
    toast.show(`${r.patch_id} · reverted ${p.patch_id} (inverse patch)`);
  }

  function stashChip(e) {
    const chip = document.createElement("button");
    chip.className = "wb-hist-chip";
    chip.title = "conflict stash — load this version into the editor (does not save)";
    const when = new Date(e.ts).toTimeString().slice(0, 5);
    chip.innerHTML = `<span class="hdot"></span><span></span>`;
    chip.querySelector(".hdot").style.background = FACET_HUES[e.facet];
    chip.lastElementChild.textContent = `stash · ${e.facet} · ${when}`;
    chip.addEventListener("click", async () => {
      await setFacet(e.facet);
      editors.get(e.facet).api.setSource(e.content);
      if (e.content !== baselines.get(e.facet)) dirty.add(e.facet);
      refreshDirtyUi();
      toast.show(`stash loaded into the ${e.facet} editor — save to apply`);
    });
    return chip;
  }

  function renderHistory() {
    const wrap = host.querySelector(".wb-hist-chips");
    wrap.replaceChildren(...readHistory().map((e) => {
      const chip = document.createElement("button");
      chip.className = "wb-hist-chip";
      chip.title = "load this version into the editor (does not save)";
      const when = new Date(e.ts).toTimeString().slice(0, 5);
      chip.innerHTML = `<span class="hdot"></span><span></span>`;
      chip.querySelector(".hdot").style.background = FACET_HUES[e.facet];
      chip.lastElementChild.textContent =
        `h${e.n} · ${e.facet} · ${e.kind === "conflict-stash" ? "stashed · " : ""}${when}`;
      chip.addEventListener("click", async () => {
        await setFacet(e.facet);
        editors.get(e.facet).api.setSource(e.content);
        if (e.content !== baselines.get(e.facet)) dirty.add(e.facet);
        refreshDirtyUi();
        toast.show(`h${e.n} loaded into the ${e.facet} editor — save to apply`);
      });
      return chip;
    }));
  }

  // ── desc + tags (G-4/G-8; the 2026-07-31 groups correction) ──
  // desc and TAGS are the editable metadata — tags is comma-delimited
  // categorization (set_tags: explicit replace, "" clears). `groups` is
  // the SECURITY-group string: read-only here, edited only by the
  // deliberate set_groups act, never through a meta form.
  const metaEl = host.querySelector(".wb-meta");
  const aboutEl = host.querySelector(".wb-about");

  // C4: the first sentence of the desc reads as a plain paragraph; the
  // rest (and the tags) sit behind "Details and config".
  function firstSentence(t) {
    const i = t.search(/[.!?](\s|$)/);
    return i >= 0 ? t.slice(0, i + 1) : t;
  }

  function para(text) {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  }

  // Nice-to-have (C4): a `Config keys (...)` list like `KEY (default X) —
  // what it sets` renders as a three-column table; anything else falls
  // back to plain paragraphs.
  function renderAboutBody(rest) {
    const body = aboutEl.querySelector(".wb-about-body");
    body.replaceChildren();
    if (!rest) return;
    const ck = rest.match(/config keys?\s*\(([^)]*)\)\s*:?\s*/i);
    if (ck) {
      const rowRe = /([A-Z][A-Z0-9_]{2,})\s*\(default[:\s]*([^)]*)\)\s*(?:[—–:,-]\s*)?([^;.]*)/g;
      const after = rest.slice(ck.index + ck[0].length);
      const rows = [...after.matchAll(rowRe)];
      if (rows.length >= 2) {
        const before = rest.slice(0, ck.index).trim();
        if (before) body.appendChild(para(before));
        const wrap = document.createElement("div");
        wrap.className = "wb-cfg-wrap";
        const table = document.createElement("table");
        table.className = "wb-cfg";
        const thead = document.createElement("thead");
        const hr = document.createElement("tr");
        for (const h of [`Config key (${ck[1].trim() || "botd.properties"})`,
                         "Default", "What it sets"]) {
          const th = document.createElement("th");
          th.textContent = h;
          hr.appendChild(th);
        }
        thead.appendChild(hr);
        const tbody = document.createElement("tbody");
        for (const m of rows) {
          const tr = document.createElement("tr");
          for (const v of [m[1], m[2].trim() || "(empty)", m[3].trim()]) {
            const td = document.createElement("td");
            td.textContent = v;
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        table.append(thead, tbody);
        wrap.appendChild(table);
        body.appendChild(wrap);
        const last = rows[rows.length - 1];
        const tail = after.slice(last.index + last[0].length)
          .replace(/^[;.\s]+/, "").trim();
        if (tail) body.appendChild(para(tail));
        return;
      }
    }
    for (const chunk of rest.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)) {
      body.appendChild(para(chunk));
    }
  }

  function renderMeta() {
    const view = aboutEl.querySelector(".wm-view");
    const details = aboutEl.querySelector(".wm-details");
    const rest = aboutEl.querySelector(".wb-about-rest");
    const desc = record.desc ?? "";
    const lead = desc ? firstSentence(desc) : "";
    view.textContent = desc ? lead : "no description — discovery reads desc";
    view.classList.toggle("empty", !desc);
    const restText = desc.slice(lead.length).trim();
    renderAboutBody(restText);
    aboutEl.querySelector(".wm-tags-view").textContent =
      record.tags ? `tags: ${record.tags}` : "";
    const hasMore = Boolean(restText) || Boolean(record.tags);
    details.hidden = !hasMore;
    if (!hasMore) {
      rest.hidden = true;
      details.setAttribute("aria-expanded", "false");
      details.textContent = "Details and config";
    }
    const g = metaEl.querySelector(".wm-groups-view");
    g.replaceChildren();
    if (record.groups) {
      g.appendChild(document.createTextNode(`groups: ${record.groups}`));
    } else {
      g.insertAdjacentHTML("afterbegin", LOCK_SVG);
      g.appendChild(document.createTextNode(" admin only"));
    }
    metaEl.querySelector(".wm-edit").hidden = !patchMode;
    metaEl.querySelector(".wm-groups-btn").hidden = !patchMode;
    // publish rides dev commands, not the write API — live mode is enough
    metaEl.querySelector(".wm-publish").hidden = false;
  }

  aboutEl.querySelector(".wm-details").addEventListener("click", () => {
    const details = aboutEl.querySelector(".wm-details");
    const rest = aboutEl.querySelector(".wb-about-rest");
    rest.hidden = !rest.hidden;
    details.setAttribute("aria-expanded", String(!rest.hidden));
    details.textContent = rest.hidden ? "Details and config" : "Hide details";
  });

  metaEl.querySelector(".wm-edit").addEventListener("click", (ev) => {
    const form = metaEl.querySelector(".wm-form");
    form.hidden = !form.hidden;
    ev.currentTarget.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) {
      form.querySelector(".wm-desc").value = record.desc ?? "";
      form.querySelector(".wm-tags").value = record.tags ?? "";
      form.querySelector(".wm-note").textContent = "";
      form.querySelector(".wm-desc").focus();
    }
  });

  metaEl.querySelector(".wm-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = metaEl.querySelector(".wm-form");
    const note = form.querySelector(".wm-note");
    const desc = form.querySelector(".wm-desc").value.trim();
    const tags = form.querySelector(".wm-tags").value.trim();
    const dArg = desc && desc !== (record.desc ?? "") ? desc : "";
    const tChanged = tags !== (record.tags ?? "");
    if (record.desc && !desc) {
      note.textContent = "desc can't be cleared here — set a new value instead";
    }
    if (!dArg && !tChanged) {
      if (!note.textContent) note.textContent = "nothing changed";
      return;
    }
    if (dArg) {
      const r = await setControlMeta(lib, name, dArg, "");
      if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
      record.desc = dArg;
    }
    if (tChanged) {
      const r = await setTags(lib, name, "", tags);
      if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
      record.tags = tags;
    }
    form.hidden = true;
    renderMeta();
    toast.show(dArg && tChanged ? "meta + tags → saved"
      : dArg ? "set_control_meta → saved" : "set_tags → saved");
  });

  // ── groups (set_groups — the deliberate permission act) ────
  // Its own affordance and form, never part of the meta form (the
  // 2026-07-31 correction). Writes the control's groups string and derives
  // the enforced readers on the control record AND its inline data records
  // — the records app.read serves, so this is what gates rendering for
  // non-admin users.
  metaEl.querySelector(".wm-groups-btn").addEventListener("click", async (ev) => {
    const form = metaEl.querySelector(".wm-groups-form");
    form.hidden = !form.hidden;
    ev.currentTarget.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) {
      const input = form.querySelector(".wm-groups-in");
      input.value = record.groups ?? "";
      form.querySelector(".wm-groups-note").textContent = "";
      form.querySelector(".wm-groups-apply").textContent = "set groups";
      input.focus();
      const known = await securityGroups();
      form.querySelector(".wm-groups-known").textContent =
        known.length ? `known groups: ${known.join(", ")}` : "";
    }
  });

  metaEl.querySelector(".wm-groups-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = metaEl.querySelector(".wm-groups-form");
    const note = form.querySelector(".wm-groups-note");
    const apply = form.querySelector(".wm-groups-apply");
    const v = form.querySelector(".wm-groups-in").value.trim();
    if (v === (record.groups ?? "").trim()) { note.textContent = "nothing changed"; return; }
    if (!v && apply.textContent !== "really clear? (admin-only)") {
      apply.textContent = "really clear? (admin-only)";
      setTimeout(() => { apply.textContent = "set groups"; }, 2500);
      return;
    }
    const r = await setGroups(lib, name, "", v);
    if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
    if (v) record.groups = v; else delete record.groups;
    form.hidden = true;
    apply.textContent = "set groups";
    renderMeta();
    toast.show(`set_groups → readers [${(r.readers ?? []).join(", ") || "— admin only"}] on this control + its inline data`);
  });

  // ── publish (G-6, reusing dev.editcontrol) ────────────────
  // get_publish_context returns app.properties (or first-publish defaults:
  // the app id IS the control's name); publishapp takes them back, bumps
  // the version itself, signs, and writes _APPS/<id>/app.properties.
  // HTTP exposure additionally needs the control named after its library
  // and an `apps=` entry in config.properties — a restart-boundary call.
  const publishEl = host.querySelector(".wb-publish");
  const PUB_EDITABLE = ["name", "desc", "img", "index", "libraries", "price", "forsale"];
  let pubProps = null;

  // Identity: publishing signs libraries with runtime/metaidentity
  // (authorname/authororg in every archive's meta) — and publishapp PANICS
  // while the record is absent (its known FIXME), so the panel surfaces
  // and fixes that state before the button is pressed.
  async function renderIdentity() {
    const view = publishEl.querySelector(".wpi-view");
    const form = publishEl.querySelector(".wpi-form");
    const edit = publishEl.querySelector(".wpi-edit");
    const mi = await metaIdentity();
    const data = mi?.status === "ok" && mi.exists ? mi : null;
    edit.hidden = !writable || !data;
    if (data) {
      // dev.code.init auto-seeds a fresh instance with the platform default
      // identity, so the missing-record warning below can no longer nudge the
      // owner to personalize — nudge on the untouched default instead.
      const isDefault = data.displayname === "Some Dev" && !data.organization;
      view.classList.toggle("warn", isDefault);
      view.textContent = isDefault
        ? 'publishing as "Some Dev" — the default identity; set yours before publishing:'
        : `publishing as ${data.displayname ?? "?"}` +
          (data.organization ? ` · ${data.organization}` : "");
      form.hidden = isDefault ? !writable : true;
    } else {
      view.classList.add("warn");
      view.textContent =
        "no meta identity on this instance — publishing will fail until one is set:";
      form.hidden = !writable;
    }
    form.querySelector(".wpi-name").value = data?.displayname ?? "";
    form.querySelector(".wpi-org").value = data?.organization ?? "";
  }
  publishEl.querySelector(".wpi-edit").addEventListener("click", () => {
    const form = publishEl.querySelector(".wpi-form");
    form.hidden = !form.hidden;
  });
  publishEl.querySelector(".wpi-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const note = publishEl.querySelector(".wpi-note");
    const displayname = publishEl.querySelector(".wpi-name").value.trim();
    const organization = publishEl.querySelector(".wpi-org").value.trim();
    if (!displayname) { note.textContent = "a display name is required"; return; }
    const r = await setMetaIdentity(displayname, organization);
    if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
    note.textContent = "";
    toast.show(`set_meta_identity → ${r.created ? "created" : "updated"}`);
    await renderIdentity();
  });

  host.querySelector(".wm-publish").addEventListener("click", async (ev) => {
    publishEl.hidden = !publishEl.hidden;
    ev.currentTarget.setAttribute("aria-expanded", String(!publishEl.hidden));
    if (publishEl.hidden) return;
    const cap = publishEl.querySelector(".wp-cap");
    cap.textContent = "loading publish context…";
    const got = await invoke("dev", "editcontrol", "get_publish_context",
      { lib, control_id: ctlId });
    if (got instanceof Error || got.envelope.status !== "ok") {
      cap.textContent = `could not load the publish context: ${
        got instanceof Error ? got.message : got.envelope.msg}`;
      return;
    }
    pubProps = got.envelope.data.properties ?? {};
    cap.innerHTML = name === lib
      ? `Publishing writes <code>_APPS/${pubProps.id ?? name}/app.properties</code>
         (signed, version-bumped) and offers the app to peers in the
         <code>update</code>/<code>admin</code> groups. This control shares its
         library's name, so adding <code>${lib}</code> to <code>apps=</code> in
         config.properties exposes it over HTTP at <code>/${lib}/…</code> after a
         restart — the owner's call.`
      : `Publishing writes <code>_APPS/${pubProps.id ?? name}/app.properties</code>
         (signed, version-bumped). Note: HTTP exposure requires a control named
         after its library — <code>${name}</code> ≠ <code>${lib}</code>, so this
         becomes an app descriptor but not a routable app.`;
    const fields = publishEl.querySelector(".wp-fields");
    fields.replaceChildren(...PUB_EDITABLE.map((key) => {
      const label = document.createElement("label");
      label.className = "lbl";
      label.textContent = key + " ";
      const input = document.createElement("input");
      input.dataset.key = key;
      input.value = pubProps[key] ?? "";
      label.appendChild(input);
      return label;
    }));
    const version = pubProps.version ?? "0";
    publishEl.querySelector(".wp-version").textContent =
      `version ${version} → publishing writes ${Number(version) + 1}`;
    publishEl.querySelector(".wp-go").hidden = !writable;
    publishEl.querySelector(".wp-log").hidden = true;
    publishEl.querySelector(".wp-note").textContent = "";
    await renderIdentity();
  });

  publishEl.querySelector(".wp-go").addEventListener("click", async () => {
    if (!pubProps) return;
    const note = publishEl.querySelector(".wp-note");
    const data = { ...pubProps };
    for (const input of publishEl.querySelectorAll(".wp-fields input")) {
      data[input.dataset.key] = input.value;
    }
    const r = await invoke("dev", "editcontrol", "publishapp", { data });
    if (r instanceof Error || r.envelope.status !== "ok") {
      note.textContent = `publish failed: ${
        r instanceof Error ? r.message : r.envelope.msg}`;
      return;
    }
    note.textContent = "";
    const log = publishEl.querySelector(".wp-log");
    log.hidden = false;
    log.textContent = (r.envelope.data ?? []).join("\n") || "(no output)";
    toast.show(`publishapp → published · ${data.id ?? name}`);
  });

  // ── timers/events (set_timer / set_event_handler) ─────────
  // The control record's timer/event arrays link component records by
  // {id, name}; details live in the components. Sets are replace-only by
  // name and register LIVE (no restart) — a short-interval timer fires
  // for real, so edit wiring on a disposable instance.
  const wiringEl = host.querySelector(".wb-wiring");

  function cmdNameById(id) {
    return record.cmd?.find((c) => c.id === id)?.name;
  }

  async function refreshWiringArrays() {
    // A replaced component keeps its record id — drop the cached copies or
    // the detail line re-renders stale.
    const fresh = await readRec(lib, ctlId);
    if (fresh instanceof Error) return;
    record.timer = fresh.timer;
    record.event = fresh.event;
  }

  function wiringRow(kind, entry) {
    const row = document.createElement("div");
    row.className = "ww-row";
    row.innerHTML = `<span class="ww-name"></span><span class="ww-detail">…</span>`;
    row.querySelector(".ww-name").textContent = entry.name;
    const detail = row.querySelector(".ww-detail");
    readRec(lib, entry.id).then((comp) => {
      if (comp instanceof Error) {
        detail.textContent = "component record unreadable";
        return;
      }
      const cmd = cmdNameById(comp.cmd) ?? comp.cmd ?? "?";
      detail.textContent = kind === "timer"
        ? `runs ${cmd} · first after ${comp.start} ${comp.startunit}` +
          (comp.repeat ? ` · repeats every ${comp.interval} ${comp.intervalunit}` : " · once")
        : `on ${comp.bot}:${comp.event} → runs ${cmd}`;
      if (patchMode) {
        const edit = document.createElement("button");
        edit.className = "ww-act";
        edit.textContent = "edit ▸";
        edit.addEventListener("click", () => openWiringForm(kind, entry.name, comp));
        row.appendChild(edit);
      }
    });
    if (patchMode) {
      const del = document.createElement("button");
      del.className = "ww-act ww-del";
      del.textContent = "remove";
      del.addEventListener("click", async () => {
        if (del.textContent !== "sure?") {
          del.textContent = "sure?";
          setTimeout(() => { del.textContent = "remove"; }, 2500);
          return;
        }
        const r = kind === "timer"
          ? await removeTimer(lib, name, entry.name)
          : await removeEventHandler(lib, name, entry.name);
        if (r.status !== "ok") {
          toast.show(`remove failed: ${r.msg}`);
          return;
        }
        await refreshWiringArrays();
        renderWiring();
        renderStrip();
        toast.show(`remove_${kind === "timer" ? "timer" : "event_handler"} → removed · ${entry.name} · unregistered live`);
      });
      row.appendChild(del);
    }
    return row;
  }

  function fillSelect(sel, values, current) {
    sel.replaceChildren(...values.map((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      if (v === current) opt.selected = true;
      return opt;
    }));
  }

  function openWiringForm(kind, compName = "", comp = null) {
    const form = wiringEl.querySelector(kind === "timer" ? ".ww-timer-form" : ".ww-event-form");
    form.hidden = false;
    form.querySelector(".ww-note").textContent = "";
    const cmdNames = (record.cmd ?? []).map((c) => c.name).sort();
    if (kind === "timer") {
      form.querySelector(".wt-name").value = compName;
      fillSelect(form.querySelector(".wt-cmd"), cmdNames, cmdNameById(comp?.cmd));
      form.querySelector(".wt-start").value = comp?.start ?? 1;
      fillSelect(form.querySelector(".wt-startunit"), TIME_UNITS, comp?.startunit ?? "hours");
      form.querySelector(".wt-repeat").checked = Boolean(comp?.repeat);
      form.querySelector(".wt-interval").value = comp?.interval ?? 1;
      fillSelect(form.querySelector(".wt-intervalunit"), TIME_UNITS, comp?.intervalunit ?? "hours");
      form.querySelector(".wt-name").focus();
    } else {
      form.querySelector(".we-name").value = compName;
      form.querySelector(".we-bot").value = comp?.bot ?? "";
      form.querySelector(".we-event").value = comp?.event ?? "";
      fillSelect(form.querySelector(".we-cmd"), cmdNames, cmdNameById(comp?.cmd));
      form.querySelector(".we-name").focus();
    }
  }

  function renderWiring() {
    const cap = wiringEl.querySelector(".ww-cap");
    cap.innerHTML = `The control's wiring: timers and event handlers run this control's
         commands without a browser. Sets are <span class="hi">replace-only</span>
         by name and register <span class="hi">live immediately</span> — a
         short-interval timer fires for real on this instance. Changes are
         journaled in the strip (facets <code>timer</code>/<code>event</code>).`;
    for (const kind of ["timer", "event"]) {
      const rows = wiringEl.querySelector(kind === "timer" ? ".ww-timer-rows" : ".ww-event-rows");
      const entries = record[kind] ?? [];
      rows.replaceChildren(...entries.map((e) => wiringRow(kind, e)));
      if (entries.length === 0) {
        const none = document.createElement("p");
        none.className = "ww-none";
        none.textContent = kind === "timer" ? "no timers" : "no event handlers";
        rows.appendChild(none);
      }
      wiringEl.querySelector(kind === "timer" ? ".ww-timer-add" : ".ww-event-add")
        .hidden = !patchMode;
    }
  }

  host.querySelector(".wm-wiring").addEventListener("click", (ev) => {
    wiringEl.hidden = !wiringEl.hidden;
    ev.currentTarget.setAttribute("aria-expanded", String(!wiringEl.hidden));
    if (!wiringEl.hidden) renderWiring();
  });
  wiringEl.querySelector(".ww-timer-add").addEventListener("click", () => openWiringForm("timer"));
  wiringEl.querySelector(".ww-event-add").addEventListener("click", () => openWiringForm("event"));

  wiringEl.querySelector(".ww-timer-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const note = form.querySelector(".ww-note");
    const r = await setTimer(lib, name, {
      name: form.querySelector(".wt-name").value.trim(),
      cmd: form.querySelector(".wt-cmd").value,
      start: Number(form.querySelector(".wt-start").value),
      startunit: form.querySelector(".wt-startunit").value,
      interval: Number(form.querySelector(".wt-interval").value),
      intervalunit: form.querySelector(".wt-intervalunit").value,
      repeat: form.querySelector(".wt-repeat").checked,
    });
    if (r.status !== "ok") {
      note.textContent = `failed: ${r.msg}`;
      return;
    }
    form.hidden = true;
    await refreshWiringArrays();
    renderWiring();
    renderStrip();
    toast.show(`set_timer → ${r.created ? "created" : "replaced"} · registered live`);
  });

  wiringEl.querySelector(".ww-event-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const note = form.querySelector(".ww-note");
    const r = await setEventHandler(lib, name, {
      name: form.querySelector(".we-name").value.trim(),
      bot: form.querySelector(".we-bot").value.trim(),
      event: form.querySelector(".we-event").value.trim(),
      cmd: form.querySelector(".we-cmd").value,
    });
    if (r.status !== "ok") {
      note.textContent = `failed: ${r.msg}`;
      return;
    }
    form.hidden = true;
    await refreshWiringArrays();
    renderWiring();
    renderStrip();
    toast.show(`set_event_handler → ${r.created ? "created" : "replaced"} · listening live`);
  });

  // Revert of a timer/event journal entry: old present → set_* of the old
  // fields (the component record's cmd is an id; the setter wants the
  // name); old empty (the entry was a create) → remove_*.
  async function revertComponent(p) {
    let r;
    if (!p.old) {
      r = p.facet === "timer"
        ? await removeTimer(lib, name, p.cmd)
        : await removeEventHandler(lib, name, p.cmd);
    } else {
      let old;
      try {
        old = JSON.parse(p.old);
      } catch {
        toast.show(`cannot revert ${p.patch_id} — its old state is unreadable`);
        return;
      }
      const cmdName = cmdNameById(old.cmd);
      if (!cmdName) {
        toast.show(`cannot revert ${p.patch_id} — the command it ran is gone from this control`);
        return;
      }
      r = p.facet === "timer"
        ? await setTimer(lib, name, {
            name: p.cmd, cmd: cmdName, start: old.start, startunit: old.startunit,
            interval: old.interval, intervalunit: old.intervalunit, repeat: old.repeat,
          })
        : await setEventHandler(lib, name, {
            name: p.cmd, bot: old.bot, event: old.event, cmd: cmdName,
          });
    }
    if (r.status !== "ok") {
      toast.show(`revert failed: ${r.msg}`);
      return;
    }
    await refreshWiringArrays();
    if (!wiringEl.hidden) renderWiring();
    renderStrip();
    toast.show(`${r.patch_id} · reverted ${p.patch_id} (${p.facet} re-applied)`);
  }

  async function commandMeta(cmdEntry) {
    // desc/tags/groups live on the command's implementation record.
    const cmdRec = await readRec(lib, cmdEntry.id);
    if (cmdRec instanceof Error) return null;
    const lang = cmdRec.type ?? commandLang(cmdEntry);
    const implId = cmdRec[lang];
    if (!implId) return null;
    const impl = await readRec(lib, implId);
    if (impl instanceof Error) return null;
    return { desc: impl.desc ?? "", tags: impl.tags ?? "", groups: impl.groups ?? "", implId };
  }

  // ── command code pane: text-language commands open a code
  // pane in place of the table ──────────────────────────────
  // read_command / patch_command_body; the snippet is
  // computed like facet saves. patch_command_body recompiles on success
  // and has no base hash — exact-match is the only concurrency guard, so
  // a server-side change surfaces as "snippet not found" with a re-read.
  const codeEl = host.querySelector(".wb-cmd-code");
  let codeApi = null;
  let codeState = null;   // {cmdName, ext, baseline, dirty}
  const paramsText = (ps) => (ps ?? []).map((p) => `${p.name}: ${p.type}`).join(", ");

  const cmdsHeadEl = host.querySelector(".wb-cmds-head");
  const guardEl = codeEl.querySelector(".wcc-guard");

  // C12: ● Saved (green) / ● unsaved changes (accent) in the pane header
  function setCodeStatus() {
    const st = codeEl.querySelector(".wcc-status");
    if (!codeState) { st.textContent = ""; return; }
    st.classList.toggle("dirty", codeState.dirty);
    st.classList.toggle("clean", !codeState.dirty);
    st.textContent = codeState.dirty ? "unsaved changes" : "Saved";
  }

  function closeCommandPane() {
    codeEl.hidden = true;
    guardEl.hidden = true;
    codeState = null;
    cmdsHeadEl.hidden = false;
    host.querySelector(".wb-cmd-rows").hidden = false;
  }
  // C12: leaving with unsaved edits asks first — save, discard, or stay.
  host.querySelector(".wcc-back").addEventListener("click", () => {
    if (codeState?.dirty) {
      guardEl.hidden = false;
      const msg = guardEl.querySelector(".wcc-guard-msg");
      msg.replaceChildren("You have unsaved changes to ");
      const b = document.createElement("b");
      b.textContent = codeState.cmdName;
      msg.append(b, ".");
      guardEl.querySelector(".wcc-guard-save").focus();
      return;
    }
    closeCommandPane();
  });
  guardEl.querySelector(".wcc-guard-save").addEventListener("click", async () => {
    await saveCommandBody();
    guardEl.hidden = true;
    if (!codeState?.dirty && codeEl.querySelector(".wcc-err").hidden) closeCommandPane();
  });
  guardEl.querySelector(".wcc-guard-discard").addEventListener("click", () => closeCommandPane());
  guardEl.querySelector(".wcc-guard-keep").addEventListener("click", () => {
    guardEl.hidden = true;
  });

  async function openCommandPane(cmdEntry, lang) {
    cmdsHeadEl.hidden = true;
    newCmdForm.hidden = true;
    host.querySelector(".wb-cmd-rows").hidden = true;
    codeEl.hidden = false;
    guardEl.hidden = true;
    const errEl = codeEl.querySelector(".wcc-err");
    errEl.hidden = true;
    codeEl.querySelector(".wcc-name").textContent = cmdEntry.name;
    const typeEl = codeEl.querySelector(".wcc-type");
    const setPaneLang = (l) => {
      typeEl.textContent = l;
      typeEl.className = `wcc-type wb-cmd-type t-${l}`;
    };
    setPaneLang(lang);
    codeEl.querySelector(".wcc-sig").textContent = "…";
    const saveCmdBtn = codeEl.querySelector(".wcc-save");
    saveCmdBtn.replaceChildren(`Save ${cmdEntry.name} `);
    const kbd = document.createElement("kbd");
    kbd.textContent = SAVE_KBD;
    saveCmdBtn.appendChild(kbd);

    const r = await readCommand(lib, name, cmdEntry.name);
    if (r.status !== "ok") {
      codeEl.querySelector(".wcc-sig").textContent = "";
      errEl.hidden = false;
      errEl.textContent = `could not read this command's body: ${r.msg}`;
      return;
    }
    // the resolved type is the authority — never the caller's guess (C7)
    if (r.type) setPaneLang(r.type);
    const ext = (r.type ?? lang) === "rust" ? "rs" : (r.type ?? lang);
    const source = typeof r[ext] === "string" ? r[ext] : "";
    const sig = `(${paramsText(r.params)}) → ${r.returntype ?? "?"}`;
    codeEl.querySelector(".wcc-sig").textContent = sig;

    if (!codeApi) {
      codeApi = await mount("editor", codeEl.querySelector(".wcc-editor"), {
        language: "js",   // closest tinting for rust/python; not semantic
        readOnly: !patchMode,
        onChange: () => updateCodeDirty(),
        onSave: () => saveCommandBody(),
      });
    }
    codeApi.setSource(source);
    codeEl.querySelector(".wcc-editor .cm-content")
      ?.setAttribute("aria-label", `${cmdEntry.name} command source`);
    const impEl = codeEl.querySelector(".wcc-imports");
    codeEl.querySelector(".wcc-imports-row").hidden = false;
    impEl.value = r.import ?? "";
    impEl.readOnly = !patchMode;
    fitImports();
    // the signature is editable in patch mode: returntype/params live on
    // the impl record and only upsert_command writes them, so the save
    // routes there when they change. An off-list returntype (InputStream,
    // …) keeps its own option — shown faithfully; upsert_command rejects
    // it, so retyping such a command fails visibly, never silently.
    const sigRow = codeEl.querySelector(".wcc-sig-row");
    sigRow.hidden = !patchMode;
    codeEl.querySelector(".wcc-sig").hidden = patchMode;
    const retSel = codeEl.querySelector(".wcc-ret");
    retSel.replaceChildren(...RETURN_TYPES.map((t) => {
      const o2 = document.createElement("option");
      o2.value = o2.textContent = t;
      return o2;
    }));
    const rt = r.returntype ?? "";
    if (rt && !RETURN_TYPES.includes(rt)) {
      const o2 = document.createElement("option");
      o2.value = o2.textContent = rt;
      retSel.appendChild(o2);
    }
    retSel.value = rt || "String";
    const parEl = codeEl.querySelector(".wcc-params");
    parEl.value = paramsText(r.params);
    parEl.readOnly = !patchMode;
    codeState = { cmdName: cmdEntry.name, ext, lang: r.type ?? lang,
                  params: r.params ?? [], returntype: r.returntype ?? "",
                  retBaseline: retSel.value, paramsBaseline: parEl.value,
                  baseline: source, importsBaseline: r.import ?? "", dirty: false };
    const saveBtn2 = codeEl.querySelector(".wcc-save");
    saveBtn2.hidden = !patchMode;
    saveBtn2.disabled = true;
    setCodeStatus();
  }
  host.querySelector(".wcc-save").addEventListener("click", () => saveCommandBody());
  host.querySelector(".wcc-imports").addEventListener("input", () => {
    fitImports();
    updateCodeDirty();
  });
  host.querySelector(".wcc-params").addEventListener("input", () => updateCodeDirty());
  host.querySelector(".wcc-ret").addEventListener("change", () => updateCodeDirty());
  // the platform save shortcut works from the sig/imports fields too (C12);
  // the editor's own keymap already handles Mod-S inside CodeMirror
  codeEl.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")
        && !e.target.closest(".wcc-editor")) {
      e.preventDefault();
      saveCommandBody();
    }
  });

  // the imports textarea grows to fit its content (C12; minimum 2 rows)
  function fitImports() {
    const impEl = codeEl.querySelector(".wcc-imports");
    impEl.rows = Math.max(2, impEl.value.split("\n").length);
  }

  function sigDirty() {
    if (!codeState) return false;
    return codeEl.querySelector(".wcc-ret").value !== codeState.retBaseline
      || codeEl.querySelector(".wcc-params").value.trim() !== codeState.paramsBaseline;
  }

  function updateCodeDirty() {
    if (!codeState) return;
    const impEl = codeEl.querySelector(".wcc-imports");
    codeState.dirty = codeApi.getValue() !== codeState.baseline
      || impEl.value !== (codeState.importsBaseline ?? "")
      || sigDirty();
    codeEl.querySelector(".wcc-save").disabled = !codeState.dirty;
    setCodeStatus();
  }

  // Reentrant guard: Mod-S can arrive from two listeners while a save is
  // mid-flight; the second call must not double-write.
  let codeSaving = false;
  async function saveCommandBody() {
    if (!codeState?.dirty || !patchMode || codeSaving) return;
    codeSaving = true;
    try {
      await saveCommandBodyInner();
    } finally {
      codeSaving = false;
      setCodeStatus();
    }
  }

  async function saveCommandBodyInner() {
    const errEl = codeEl.querySelector(".wcc-err");
    const impEl = codeEl.querySelector(".wcc-imports");
    const source = codeApi.getValue();
    const notes = [];
    errEl.hidden = true;

    // a signature change can't travel as a body patch: returntype/params
    // are written only by upsert_command, which stores the whole body and
    // imports and recompiles — one call carries everything. The trade-off
    // is concurrency: no exact-match guard here, the editor's copy wins.
    if (sigDirty()) {
      const parsed = parseParams(codeEl.querySelector(".wcc-params").value);
      if (parsed.error) {
        errEl.hidden = false;
        errEl.textContent = parsed.error;
        return;
      }
      const ret = codeEl.querySelector(".wcc-ret").value;
      const r = await upsertCommand(lib, name, codeState.cmdName,
        { lang: codeState.lang, returnType: ret, params: parsed.params,
          imports: impEl.value, codeBody: source });
      if (r.status !== "ok" && r.kind !== "compile_error") {
        errEl.hidden = false;
        errEl.textContent = `upsert_command failed: ${r.msg}`;
        return;
      }
      codeState.baseline = source;
      codeState.importsBaseline = impEl.value;
      codeState.params = parsed.params;
      codeState.returntype = ret;
      codeState.retBaseline = ret;
      codeState.paramsBaseline = paramsText(parsed.params);
      codeEl.querySelector(".wcc-params").value = codeState.paramsBaseline;
      codeEl.querySelector(".wcc-sig").textContent = `(${codeState.paramsBaseline}) → ${ret}`;
      if (r.status !== "ok") {
        errEl.hidden = false;
        errEl.textContent = `compile failed (the signature, imports and body were stored):\n${r.msg}`;
      }
      updateCodeDirty();
      toast.show(`upsert_command → signature ${r.status === "ok" ? "· compiled" : "· compile FAILED"} · ${codeState.cmdName}`);
      return;
    }

    // imports first (set_command_imports recompiles): a body edit that
    // needs a new `use` compiles on the second call, not on ordering luck
    if (impEl.value !== (codeState.importsBaseline ?? "")) {
      const r = await setCommandImports(lib, name, codeState.cmdName, impEl.value);
      if (r.status !== "ok" && r.kind !== "compile_error") {
        errEl.hidden = false;
        errEl.textContent = `set_command_imports failed: ${r.msg}`;
        return;
      }
      codeState.importsBaseline = impEl.value;
      notes.push(r.status === "ok" ? "imports · compiled" : "imports · compile FAILED");
      if (r.status !== "ok") {
        errEl.hidden = false;
        errEl.textContent = `compile failed (the imports were stored):\n${r.msg}`;
      }
    }

    const patch = computePatch(codeState.baseline, source);
    if (patch && !(patch.oldSnippet === "" && codeState.baseline !== "")) {
      const r = await patchCommandBody(lib, name, codeState.cmdName,
        patch.oldSnippet, patch.newSnippet);
      if (r.status !== "ok") {
        errEl.hidden = false;
        errEl.textContent = r.kind === "compile_error"
          ? `compile failed (the patch was stored):\n${r.msg}`
          : `patch failed: ${r.msg}`;
        if (/snippet not found/i.test(r.msg ?? "")) {
          errEl.textContent += "\n\nthe body changed on the server — reopen the command to load the current copy";
        }
        if (r.kind !== "compile_error") return;
      }
      codeState.baseline = source;
      notes.push(r.status === "ok" ? "body · compiled" : "body · compile FAILED");
    }

    updateCodeDirty();
    if (notes.length) toast.show(`${notes.join(" · ")} · ${codeState.cmdName}`);
  }

  // ── new command (upsert_command / write_flow_body) ────────
  // The platform's own valid sets (upsert_command validates both), plus a
  // starter body per return type so a fresh rust/python command COMPILES
  // on creation instead of landing red.
  const PARAM_TYPES = ["String", "Integer", "Double", "Float", "Boolean",
                       "JSONObject", "JSONArray", "Any"];
  const RETURN_TYPES = [...PARAM_TYPES, "File", "FLAT", "NULL"];
  const RUST_STARTER = {
    String: '"".to_string()', Integer: "0", Double: "0.0", Float: "0.0",
    Boolean: "false", JSONObject: "DataObject::new()", JSONArray: "DataArray::new()",
    FLAT: "DataObject::new()", Any: "DataObject::new()",
    File: '"".to_string()', NULL: "DataObject::new()",
  };
  const newCmdForm = host.querySelector(".wb-newcmd");
  const wcName = host.querySelector(".wc-name");
  const wcLang = host.querySelector(".wc-lang");
  const wcRet = host.querySelector(".wc-ret");
  const wcParams = host.querySelector(".wc-params");
  const wcNote = host.querySelector(".wc-note");
  const newBtn = host.querySelector(".wb-newbtn");
  // C11: the dashed `+ new command` button toggles the labelled form;
  // opening focuses Name.
  function setNewFormOpen(open) {
    newCmdForm.hidden = !open;
    newBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      wcNote.textContent = "";
      wcName.focus();
    }
  }
  newBtn.addEventListener("click", () => setNewFormOpen(newCmdForm.hidden));
  newCmdForm.querySelector(".wc-cancel").addEventListener("click", () => {
    setNewFormOpen(false);
    newBtn.focus();
  });
  wcRet.replaceChildren(...RETURN_TYPES.map((t) => {
    const o = document.createElement("option");
    o.value = o.textContent = t;
    return o;
  }));
  wcRet.value = "String";

  function syncLangUi() {
    // Flow signatures come from the Case's bars, which write_flow_body
    // derives on every write — the return picker doesn't apply.
    const flow = wcLang.value === "flow";
    wcRet.parentElement.style.opacity = flow ? "0.4" : "";
    wcRet.disabled = flow;
  }
  wcLang.addEventListener("change", syncLangUi);
  syncLangUi();

  /** "a: String, n: Integer" -> [{name, type}]; null + message on trouble. */
  function parseParams(text) {
    const out = [];
    for (const chunk of text.split(",").map((s) => s.trim()).filter(Boolean)) {
      const m = chunk.match(/^([a-z][a-z0-9_]*)\s*:\s*(\w+)$/i);
      if (!m) return { error: `can't read "${chunk}" — write it as name: Type` };
      const type = PARAM_TYPES.find((t) => t.toLowerCase() === m[2].toLowerCase());
      if (!type) return { error: `unknown type "${m[2]}" — one of ${PARAM_TYPES.join(", ")}` };
      out.push({ name: m[1], type });
    }
    return { params: out };
  }

  /** A minimal valid Case: the declared params as input-bar terminals and a
      single `a` return terminal, spread along x. Bars are the signature. */
  function starterFlowBody(params) {
    const bar = (names) => Object.fromEntries(names.map((n, i) => [n, {
      mode: "regular", type: "object",
      x: names.length > 1 ? -1 + (2 * i) / (names.length - 1) : 0,
    }]));
    return {
      input: bar(params.map((p) => p.name)),
      output: bar(["a"]),
      cmds: [],
      cons: [],
    };
  }

  newCmdForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const cmdName = wcName.value.trim();
    if (!/^[a-z_][a-z0-9_]*$/.test(cmdName)) {
      wcNote.textContent = "lowercase letters, digits and _ only, starting with a letter or _";
      wcName.focus();
      return;
    }
    if ((record.cmd ?? []).some((c) => c.name === cmdName)) {
      wcNote.textContent = `${name} already has a command named ${cmdName}`;
      wcName.focus();
      return;
    }
    const parsed = parseParams(wcParams.value);
    if (parsed.error) {
      wcNote.textContent = parsed.error;
      return;
    }
    wcNote.textContent = "creating…";

    let r;
    if (wcLang.value === "flow") {
      r = await writeFlowBody(lib, name, cmdName, starterFlowBody(parsed.params),
        { label: `create ${cmdName}` });
    } else {
      const ret = wcRet.value;
      const body = wcLang.value === "python"
        ? "return None"
        : RUST_STARTER[ret] ?? "DataObject::new()";
      r = await upsertCommand(lib, name, cmdName,
        { lang: wcLang.value, returnType: ret, params: parsed.params, codeBody: body });
    }
    if (r.status !== "ok" && r.kind !== "compile_error") {
      wcNote.textContent = `failed: ${r.msg}`;
      return;
    }
    wcNote.textContent = "";
    wcName.value = "";
    wcParams.value = "";
    setNewFormOpen(false);
    const fresh = await readRec(lib, ctlId);
    if (!(fresh instanceof Error)) record.cmd = fresh.cmd ?? [];
    const made = (record.cmd ?? []).find((c) => c.name === cmdName);
    host.querySelector(".wb-cmd-rows").replaceChildren();
    renderCommands();
    chips.get("cmd")?.classList.remove("absent");
    if (r.kind === "compile_error") {
      toast.show(`upsert_command → stored, but it did not compile — open ▸ ${cmdName} to fix it`);
    } else {
      toast.show(`${wcLang.value === "flow" ? "write_flow_body" : "upsert_command"} → ${cmdName} created`);
    }
    if (made && wcLang.value === "flow") {
      location.hash = `#/flow/${lib}/${ctlId}/${made.id}`;
    } else if (made) {
      openCommandPane(made, wcLang.value);
    }
  });

  // ── the workbench's own action toast: delete → Revert (C10). Unlike the
  // frame toast it stays up until dismissed or replaced.
  const wbToastEl = host.querySelector(".wb-toast");
  wbToastEl.querySelector(".wb-toast-x").addEventListener("click", () => {
    wbToastEl.hidden = true;
  });
  function wbToast(msg, action, onAction) {
    wbToastEl.querySelector(".wb-toast-msg").textContent = msg;
    const act = wbToastEl.querySelector(".wb-toast-act");
    act.hidden = !action;
    act.textContent = action ?? "";
    act.onclick = action ? () => onAction?.() : null;
    wbToastEl.hidden = false;
  }

  // C10's Revert: re-author the deleted command from the journal entry's
  // `old` ({command, impl} — delete_command's shape): upsert_command for
  // code, write_flow_body for flows, then the meta/tags/groups it carried.
  async function revertCommandDelete(p) {
    wbToastEl.hidden = true;
    let old;
    try { old = JSON.parse(p.old); } catch { old = null; }
    const implRec = old?.impl;
    if (!old?.command || !implRec) {
      toast.show(`cannot revert ${p.patch_id} — its old state is unreadable`);
      return;
    }
    const t = old.command.type || "rust";
    let r;
    if (t === "flow") {
      let body = implRec.flow;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
      if (!body || typeof body !== "object") {
        body = { input: implRec.input ?? {}, output: implRec.output ?? {},
                 cmds: implRec.cmds ?? [], cons: implRec.cons ?? [] };
        if (implRec.nextcase !== undefined) body.nextcase = implRec.nextcase;
      }
      r = await writeFlowBody(lib, name, p.cmd, body, { label: `revert ${p.patch_id}` });
    } else {
      const ext = t === "rust" ? "rs" : t;
      const codeBody = typeof implRec[ext] === "string" ? implRec[ext]
        : typeof implRec[t] === "string" ? implRec[t] : "";
      r = await upsertCommand(lib, name, p.cmd, {
        lang: t, returnType: implRec.returntype || "String",
        params: implRec.params ?? [], imports: implRec.import ?? "", codeBody,
      });
    }
    if (r.status !== "ok" && r.kind !== "compile_error") {
      toast.show(`revert failed: ${r.msg}`);
      return;
    }
    if (implRec.desc) await setCommandMeta(lib, name, p.cmd, implRec.desc, "");
    if (implRec.tags) await setTags(lib, name, p.cmd, implRec.tags);
    if (implRec.groups) await setGroups(lib, name, p.cmd, implRec.groups);
    const fresh = await readRec(lib, ctlId);
    if (!(fresh instanceof Error)) record.cmd = fresh.cmd ?? [];
    host.querySelector(".wb-cmd-rows").replaceChildren();
    renderCommands();
    refreshDirtyUi();
    renderStrip();
    wbToast(`Restored ${p.cmd} from ${p.patch_id}.`
      + (r.kind === "compile_error" ? " It was stored but did not compile." : ""));
  }

  // ── right-pane extras ─────────────────────────────────────
  // C7 rows: [LANG] name(params) → Ret + desc; the whole block is one
  // button that opens the command, with details · meta ▸ · delete on the
  // right. At most one sub-panel is open across ALL rows.
  let openSub = null;   // { close } of whichever row panel is open

  function renderCommands() {
    newBtn.hidden = !patchMode;
    const rows = host.querySelector(".wb-cmd-rows");
    if (rows.childElementCount > 0) return;
    openSub = null;
    for (const cmdEntry of record.cmd ?? []) rows.appendChild(commandRow(cmdEntry));
    const note = host.querySelector(".wb-cmds .wb-note");
    if (!note.querySelector("a")) {
      const link = document.createElement("a");
      link.href = "#/flow/sample";
      link.textContent = "View a sample flow ▸";
      link.style.color = "var(--accent)";
      note.append(" ", link);
    }
  }

  function commandRow(cmdEntry) {
    const row = document.createElement("div");
    row.className = "wb-cmd-row";
    const line = document.createElement("div");
    line.className = "wb-cmd-line";
    row.appendChild(line);

    const main = document.createElement("button");
    main.type = "button";
    main.className = "wb-cmd-main";
    main.innerHTML = `<span class="wb-cmd-type"></span>
      <span class="wb-cmd-sig"><span class="cname"></span><span class="params"></span><span class="ret"></span></span>
      <span class="wb-cmd-desc"><i>no description yet — discovery reads desc</i></span>`;
    main.querySelector(".cname").textContent = cmdEntry.name;
    line.appendChild(main);
    const typeEl = main.querySelector(".wb-cmd-type");
    // The entry's language keys are legacy artifacts (java ids linger on
    // rust commands); the command record's `type` is the authority, and
    // opening uses whatever is CURRENT at click time — never a stale guess.
    const state = { lang: commandLang(cmdEntry), meta: null, sig: null };
    const setLang = (l) => {
      state.lang = l;
      typeEl.textContent = l;
      typeEl.className = `wb-cmd-type t-${l}`;
      main.title = l === "flow" ? "open in the flow editor" : "open the code pane";
    };
    setLang(state.lang);

    const resolved = (async () => {
      const cmdRec = await readRec(lib, cmdEntry.id);
      if (cmdRec instanceof Error) return;
      if (cmdRec.type && cmdRec.type !== state.lang) setLang(cmdRec.type);
      const t = cmdRec.type ?? state.lang;
      const implId = cmdRec[t];
      if (!implId) return;
      const impl = await readRec(lib, implId);
      if (impl instanceof Error) return;
      state.meta = { desc: impl.desc ?? "", tags: impl.tags ?? "",
                     groups: impl.groups ?? "", implId };
      const params = impl.params ? paramsText(impl.params)
        : (t === "flow" && impl.input && typeof impl.input === "object")
          ? Object.keys(impl.input).join(", ") : "";
      state.sig = { params, returntype: impl.returntype ?? "" };
      main.querySelector(".params").textContent = `(${params})`;
      if (state.sig.returntype) {
        main.querySelector(".ret").textContent = `→ ${state.sig.returntype}`;
      }
      if (state.meta.desc) {
        main.querySelector(".wb-cmd-desc").textContent = state.meta.desc;
      }
    })();

    main.addEventListener("click", () => {
      if (state.lang === "flow") location.hash = `#/flow/${lib}/${ctlId}/${cmdEntry.id}`;
      else openCommandPane(cmdEntry, state.lang);
    });

    const actionsBox = document.createElement("div");
    actionsBox.className = "wb-cmd-actions";
    const detailsBtn = document.createElement("button");
    detailsBtn.className = "wb-tog";
    detailsBtn.textContent = "details";
    detailsBtn.setAttribute("aria-expanded", "false");
    const metaBtn = document.createElement("button");
    metaBtn.className = "wb-tog";
    metaBtn.innerHTML = `meta <span class="car" aria-hidden="true">▸</span>`;
    metaBtn.title = "the command's desc, tags and security groups";
    metaBtn.setAttribute("aria-expanded", "false");
    actionsBox.append(detailsBtn, metaBtn);
    line.appendChild(actionsBox);

    const sub = document.createElement("div");
    sub.hidden = true;
    row.appendChild(sub);
    let subKind = null;

    function closeSub() {
      sub.hidden = true;
      sub.replaceChildren();
      sub.className = "";
      subKind = null;
      detailsBtn.setAttribute("aria-expanded", "false");
      metaBtn.setAttribute("aria-expanded", "false");
      if (openSub && openSub.close === closeSub) openSub = null;
    }

    async function ensureMeta() {
      await resolved;
      if (!state.meta) state.meta = await commandMeta(cmdEntry);
      return state.meta;
    }

    async function openPanel(kind) {
      if (subKind === kind) { closeSub(); return; }
      if (openSub) openSub.close();      // only one sub-panel anywhere (C7)
      subKind = kind;
      openSub = { close: closeSub };
      (kind === "details" ? detailsBtn : metaBtn).setAttribute("aria-expanded", "true");
      sub.hidden = false;
      if (kind === "details") await fillDetails(); else await fillMeta();
    }
    detailsBtn.addEventListener("click", () => openPanel("details"));
    metaBtn.addEventListener("click", () => openPanel("meta"));

    // C8: a read-only key/value summary of the command
    async function fillDetails() {
      sub.className = "wb-cmd-sub wb-cmd-kv";
      sub.textContent = "…";
      const meta = await ensureMeta();
      if (subKind !== "details") return;
      sub.replaceChildren();
      const add = (k, v, cls) => {
        const ks = document.createElement("span");
        ks.className = "k";
        ks.textContent = k;
        const vs = document.createElement("span");
        if (cls) vs.className = cls;
        if (typeof v === "string") vs.textContent = v; else vs.appendChild(v);
        sub.append(ks, vs);
      };
      const none = (t) => {
        const s = document.createElement("span");
        s.className = "muted";
        s.textContent = t;
        return s;
      };
      add("Description", meta?.desc ? meta.desc : none("none — discovery reads desc"));
      add("Signature",
        `${cmdEntry.name}(${state.sig?.params ?? ""})${state.sig?.returntype ? ` → ${state.sig.returntype}` : ""}`,
        "mono");
      add("Language", LANG_NAMES[state.lang] ?? state.lang);
      add("Tags", meta?.tags ? meta.tags : none("none"));
      add("Security", meta?.groups ? `groups: ${meta.groups}` : "admin only");
    }

    // C9: the per-command meta editor — desc / tags · set · plugin slot /
    // groups · set groups / note. The .cm-ext slot and the bubbling
    // nb-command-meta event are the plugin contract; the workbench never
    // checks who listens.
    async function fillMeta() {
      sub.className = "wb-cmd-sub wb-cmd-meta";
      sub.textContent = "…";
      const meta = await ensureMeta();
      if (subKind !== "meta") return;
      if (!meta) {
        sub.textContent = "could not read this command's records";
        return;
      }
      if (!patchMode) {
        sub.innerHTML = `<span class="cm-desc"></span><span class="cm-tags"></span><span class="cm-groups"></span>`;
        sub.querySelector(".cm-desc").textContent =
          meta.desc || "no description — discovery reads desc";
        sub.querySelector(".cm-desc").classList.toggle("empty", !meta.desc);
        sub.querySelector(".cm-tags").textContent =
          meta.tags ? `tags: ${meta.tags}` : "";
        sub.querySelector(".cm-groups").textContent =
          meta.groups ? `security groups: ${meta.groups}` : "security: admin only";
        return;
      }
      sub.innerHTML = `
        <input class="cm-desc-in full" placeholder="describe this command — discovery reads this">
        <input class="cm-tags-in" placeholder="tags (comma-delimited — categorization, never security)">
        <div class="span2"><button class="cm-apply">set</button><span class="cm-ext"></span></div>
        <input class="cm-groups-in"
          placeholder="security groups (comma-delimited) — empty = admin only"
          title="who can execute this command — check_security reads the readers derived from this">
        <div class="span2"><button class="cm-groups-apply"
          title="the deliberate set_groups act — writes the groups string and derives the enforced readers on this command's meta + impl records">set groups</button></div>
        <p class="cm-note" role="status"></p>`;
      const descIn = sub.querySelector(".cm-desc-in");
      const tagsIn = sub.querySelector(".cm-tags-in");
      const groupsIn = sub.querySelector(".cm-groups-in");
      descIn.setAttribute("aria-label", `description of ${cmdEntry.name}`);
      tagsIn.setAttribute("aria-label", `tags of ${cmdEntry.name}`);
      groupsIn.setAttribute("aria-label", `security groups of ${cmdEntry.name}`);
      descIn.value = meta.desc;
      tagsIn.value = meta.tags;
      groupsIn.value = meta.groups ?? "";
      const note = sub.querySelector(".cm-note");
      const groupsApply = sub.querySelector(".cm-groups-apply");
      groupsApply.addEventListener("click", async () => {
        const gv = groupsIn.value.trim();
        if (gv === (meta.groups ?? "").trim()) { note.textContent = "groups: nothing changed"; return; }
        if (!gv && groupsApply.textContent !== "really clear? (admin-only)") {
          groupsApply.textContent = "really clear? (admin-only)";
          setTimeout(() => { groupsApply.textContent = "set groups"; }, 2500);
          return;
        }
        const r = await setGroups(lib, name, cmdEntry.name, gv);
        if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
        meta.groups = gv;
        groupsApply.textContent = "set groups";
        note.textContent = "";
        toast.show(`set_groups → readers [${(r.readers ?? []).join(", ") || "— admin only"}] on ${cmdEntry.name}`);
      });
      // the command-meta extension point: a slot plus one bubbling event —
      // whatever plugin cares (if any) injects its own affordances here;
      // the workbench neither knows nor checks who listens
      sub.querySelector(".cm-ext").dispatchEvent(
        new CustomEvent("nb-command-meta", { bubbles: true, detail: {
          lib, ctl: name, cmd: cmdEntry.name, groups: meta.groups ?? "",
          descInput: descIn,
          note,
        } }));
      sub.querySelector(".cm-apply").addEventListener("click", async () => {
        const desc = descIn.value.trim();
        const tags = tagsIn.value.trim();
        const dArg = desc && desc !== meta.desc ? desc : "";
        const tChanged = tags !== (meta.tags ?? "");
        if (meta.desc && !desc) {
          note.textContent = "desc can't be cleared here — set a new value instead";
        }
        if (!dArg && !tChanged) {
          if (!note.textContent) note.textContent = "nothing changed";
          return;
        }
        if (dArg) {
          const r = await setCommandMeta(lib, name, cmdEntry.name, dArg, "");
          if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
          meta.desc = dArg;
          main.querySelector(".wb-cmd-desc").textContent = dArg;
        }
        if (tChanged) {
          const r = await setTags(lib, name, cmdEntry.name, tags);
          if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
          meta.tags = tags;
        }
        note.textContent = "";
        toast.show(tChanged && !dArg ? "set_tags → saved" : "set_command_meta → saved");
      });
    }

    // C10: delete behind an inline confirm bar; the toast offers Revert.
    if (patchMode) {
      const del = document.createElement("button");
      del.className = "wb-tog del";
      del.innerHTML = `${TRASH_SVG}delete`;
      del.setAttribute("aria-label", `delete ${cmdEntry.name}`);
      del.title = "removes the command and its implementation record — "
        + "journaled on this control's timeline; revert re-authors from the entry";
      actionsBox.appendChild(del);
      del.addEventListener("click", () => {
        if (openSub) openSub.close();
        line.hidden = true;
        const confirm = document.createElement("div");
        confirm.className = "wb-cmd-confirm";
        confirm.setAttribute("role", "group");
        confirm.setAttribute("aria-label", `confirm deleting ${cmdEntry.name}`);
        const msg = document.createElement("span");
        msg.append("Delete ");
        const b = document.createElement("b");
        b.textContent = cmdEntry.name;
        msg.append(b, "? The delete is journaled, so you can revert it from the toast or the patch history.");
        const bar = document.createElement("div");
        bar.className = "wb-bar";
        const go = document.createElement("button");
        go.className = "wb-btn danger";
        go.textContent = `Delete ${cmdEntry.name}`;
        const cancel = document.createElement("button");
        cancel.className = "wb-btn";
        cancel.textContent = "Cancel";
        bar.append(go, cancel);
        confirm.append(msg, bar);
        row.insertBefore(confirm, sub);
        cancel.focus();
        const restore = () => {
          confirm.remove();
          line.hidden = false;
          del.focus();
        };
        cancel.addEventListener("click", restore);
        confirm.addEventListener("keydown", (e) => {
          if (e.key === "Escape") { e.stopPropagation(); restore(); }
        });
        go.addEventListener("click", async () => {
          go.disabled = true;
          const r = await deleteCommand(lib, name, cmdEntry.name);
          if (r.status !== "ok") {
            toast.show(`delete failed: ${r.msg}`);
            restore();
            return;
          }
          const fresh = await readRec(lib, ctlId);
          if (!(fresh instanceof Error)) record.cmd = fresh.cmd ?? [];
          host.querySelector(".wb-cmd-rows").replaceChildren();
          renderCommands();
          refreshDirtyUi();
          renderStrip();
          let entry = null;
          const lp = await listPatches(lib, name, 10);
          if (lp.status === "ok") {
            entry = (lp.patches ?? []).find(
              (p) => p.patch_id === r.patch_id && p.facet === "command");
          }
          wbToast(`Deleted ${cmdEntry.name}. Journaled as ${r.patch_id}.`,
            entry ? "Revert" : null,
            entry ? () => revertCommandDelete(entry) : null);
        });
      });
    }
    return row;
  }

  async function renderThree() {
    const slot = host.querySelector(".wb-three-slot");
    if (slot.childElementCount > 0) return;
    const viewer = document.createElement("div");
    viewer.style.height = "100%";
    slot.appendChild(viewer);
    const api = await mount("editor", viewer, { language: "json", readOnly: true });
    api.setSource(facetSource("three"));
  }

  async function renderScene() {
    const slot = host.querySelector(".wb-scene-slot");
    if (slot.childElementCount > 0) return;
    const inner = document.createElement("div");
    inner.style.height = "100%";
    slot.appendChild(inner);
    await mount("sceneeditor", inner, {
      lib, name, record, toast,
      onSaved: (scene) => {
        record.scene = scene;
        chips.get("scene")?.classList.remove("absent");
        if (journalMode) renderStrip(); else renderHistory();
      },
    });
  }

  // ── preview: static (shadow root, html+css) or LIVE ───────
  // Live = the platform's own /dev/preview.html in an iframe — a real
  // stock mount, js on. Saves reload it (every save path ends in
  // refreshPreview).
  const previewSlot = host.querySelector(".wb-left");
  const PREVIEW_MODE_KEY = "bench.preview.mode";

  // ── the preview pane's geometry: hidden / width / fullscreen ────────
  // Width and hidden PERSIST (they are a working preference). Fullscreen
  // does not: reloading into a pane that covers the editor, with no memory
  // of having asked for it, is a puzzle rather than a convenience.
  const PV_W_KEY = "bench.preview.w", PV_OFF_KEY = "bench.preview.off";
  const PV_DEFAULT = 400, PV_MIN = 240;
  const wbRoot = host.classList.contains("nb-workbench")
    ? host : host.querySelector(".nb-workbench");
  const pvToggle = host.querySelector(".wm-preview");
  const resizer = host.querySelector(".wb-resize");
  // C6: a control with no html facet defaults to a hidden preview — there
  // is nothing to render; otherwise the stored preference holds.
  let pvOff = localStorage.getItem(PV_OFF_KEY) === "1" || !facetPresent("html");
  let pvFull = false;
  let pvW = Math.max(PV_MIN, Number(localStorage.getItem(PV_W_KEY)) || PV_DEFAULT);

  // C6: the preview spans 240px up to 70% of the workbench
  const pvMax = () => Math.max(PV_MIN, (wbRoot.clientWidth || 1200) * 0.7);
  function applyPv() {
    pvW = Math.min(Math.max(pvW, PV_MIN), pvMax());
    wbRoot.style.setProperty("--pv-w", Math.round(pvW) + "px");
    wbRoot.classList.toggle("pv-off", pvOff && !pvFull);
    wbRoot.classList.toggle("pv-full", pvFull);
    if (pvToggle) {
      pvToggle.setAttribute("aria-pressed", String(!pvOff));
      pvToggle.textContent = pvOff ? "show preview" : "hide preview";
    }
    if (resizer) {
      resizer.setAttribute("aria-valuenow", String(Math.round(pvW)));
      resizer.setAttribute("aria-valuemax", String(Math.round(pvMax())));
    }
    const readout = host.querySelector(".wb-pv-w");
    if (readout) readout.textContent = Math.round(pvW) + "px";
    const fs = host.querySelector(".wb-pv-full");
    if (fs) {
      fs.setAttribute("aria-pressed", String(pvFull));
      fs.textContent = pvFull ? "⛶ exit" : "⛶";
      fs.title = pvFull ? "leave fullscreen (Esc)" : "fill the workbench with the preview";
    }
  }
  function setPvOff(off) {
    pvOff = off;
    localStorage.setItem(PV_OFF_KEY, off ? "1" : "0");
    applyPv();
  }
  function setPvFull(full) {
    pvFull = full;
    if (full) pvOff = false;              // fullscreen implies visible
    localStorage.setItem(PV_OFF_KEY, pvOff ? "1" : "0");
    applyPv();
  }
  if (pvToggle) pvToggle.addEventListener("click", () => setPvOff(!pvOff));

  if (resizer) {
    // Pointer capture, so a fast drag that outruns the handle (or leaves the
    // window) still steers it and still ends cleanly.
    resizer.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      resizer.setPointerCapture(e.pointerId);
      wbRoot.classList.add("wb-resizing");
      const x0 = e.clientX, w0 = pvW;
      const move = (ev) => { pvW = w0 + (ev.clientX - x0); applyPv(); };
      const up = () => {
        resizer.removeEventListener("pointermove", move);
        resizer.removeEventListener("pointerup", up);
        resizer.removeEventListener("pointercancel", up);
        wbRoot.classList.remove("wb-resizing");
        localStorage.setItem(PV_W_KEY, String(Math.round(pvW)));
      };
      resizer.addEventListener("pointermove", move);
      resizer.addEventListener("pointerup", up);
      resizer.addEventListener("pointercancel", up);
    });
    resizer.addEventListener("dblclick", () => {
      pvW = PV_DEFAULT; applyPv();
      localStorage.setItem(PV_W_KEY, String(PV_DEFAULT));
    });
    resizer.addEventListener("keydown", (e) => {
      // C6: ←/→ ±20px, Shift ±80px, Enter resets, Home/End to the limits
      const step = e.shiftKey ? 80 : 20;
      if (e.key === "ArrowLeft") pvW -= step;
      else if (e.key === "ArrowRight") pvW += step;
      else if (e.key === "Home") pvW = PV_MIN;
      else if (e.key === "End") pvW = pvMax();
      else if (e.key === "Enter") pvW = PV_DEFAULT;
      else return;
      e.preventDefault();
      applyPv();
      localStorage.setItem(PV_W_KEY, String(Math.round(pvW)));
    });
  }
  host.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pvFull) { e.preventDefault(); setPvFull(false); }
  });
  applyPv();
  let previewMode = localStorage.getItem(PREVIEW_MODE_KEY) === "live" ? "live" : "static";
  let liveFrame = null;

  async function refreshPreview() {
    previewSlot.replaceChildren();
    liveFrame = null;
    const bar = document.createElement("div");
    bar.className = "wb-pv-bar";
    // C6: Static · Live as text toggles with a · between — active = accent
    const modes = document.createElement("div");
    modes.className = "wb-pv-modes";
    modes.setAttribute("role", "group");
    modes.setAttribute("aria-label", "preview mode");
    const mk = (m, label, title) => {
      const b = document.createElement("button");
      b.className = "wb-tog";
      b.textContent = label;
      b.title = title;
      b.setAttribute("aria-pressed", String(previewMode === m));
      b.addEventListener("click", () => {
        if (previewMode === m) return;
        previewMode = m;
        localStorage.setItem(PREVIEW_MODE_KEY, m);
        refreshPreview();
      });
      return b;
    };
    const sep = document.createElement("span");
    sep.className = "sepdot";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "·";
    modes.append(
      mk("static", "static", "html+css in a shadow root — safe everywhere, with source picking"),
      sep,
      mk("live", "live", "a real stock mount (js runs) via the platform's /dev/preview.html"),
    );
    bar.appendChild(modes);
    const readout = document.createElement("span");
    readout.className = "wb-pv-w";
    bar.appendChild(readout);
    const full = document.createElement("button");
    full.className = "wb-tog wb-pv-full";
    full.addEventListener("click", () => setPvFull(!pvFull));
    bar.appendChild(full);
    previewSlot.appendChild(bar);
    applyPv();
    const inner = document.createElement("div");
    inner.className = "wb-pv-body";
    previewSlot.appendChild(inner);

    // C6: with no html there is nothing to render, in either mode
    const htmlNow = editors.get("html")?.api.getValue() ?? record.html ?? "";
    if (!htmlNow.trim()) {
      const eyebrow = document.createElement("div");
      eyebrow.className = "wb-pv-eyebrow";
      eyebrow.innerHTML = `<span class="idot" aria-hidden="true"></span><span></span>`;
      eyebrow.lastElementChild.textContent = `${previewMode} · nothing to render`;
      const box = document.createElement("div");
      box.className = "wb-pv-empty";
      box.textContent = "This control has no html facet, so there's nothing to render.";
      inner.append(eyebrow, box);
      return;
    }

    if (previewMode === "live") {
      const head = document.createElement("div");
      head.className = "wb-pv-live-head";
      const cap = document.createElement("span");
      cap.className = "lbl";
      cap.textContent = "stock mount · js runs · saves reload it";
      const re = document.createElement("button");
      re.textContent = "↻ reload";
      re.addEventListener("click", () => {
        if (liveFrame) liveFrame.src = liveFrame.src;
      });
      head.append(cap, re);
      inner.appendChild(head);
      liveFrame = document.createElement("iframe");
      liveFrame.className = "wb-pv-frame";
      liveFrame.title = `live preview of ${lib} ▸ ${name}`;
      liveFrame.src = `/dev/preview.html?lib=${encodeURIComponent(lib)}` +
        `&id=${encodeURIComponent(ctlId)}`;
      inner.appendChild(liveFrame);
      return;
    }

    await mount("preview", inner, {
      lib,
      name,
      record,
      onPick: async ({ label, line }) => {
        await setFacet("html");
        const chip = chips.get("html");
        chip.classList.remove("flash");
        void chip.offsetWidth;
        chip.classList.add("flash");
        if (line) {
          editors.get("html").api.highlight([line]);
        } else {
          toast.show(`${label} — source line not found (heuristic mapper)`);
        }
      },
    });
  }

  // ── chat context (the drawer reads these at send time) ────
  // Live getters: dirty editor buffers win over the loaded record, and the
  // command provider yields nothing while the code pane is closed.
  const unregCtx = [
    viewctx.register("workbench", () => ({
      label: `${lib} ▸ ${name} facets`,
      fields: {
        lib,
        ctl: name,
        html: editors.get("html")?.api.getValue() ?? record.html ?? null,
        css: editors.get("css")?.api.getValue() ?? record.css ?? null,
        js: editors.get("js")?.api.getValue() ?? record.js ?? null,
      },
    })),
    viewctx.register("command", () => codeState ? {
      label: `command ${codeState.cmdName} body`,
      fields: {
        cmdname: codeState.cmdName,
        lang: codeState.lang,
        cmdparams: codeState.params,
        cmdreturn: codeState.returntype,
        code: codeApi?.getValue() ?? codeState.baseline,
      },
    } : null),
  ];

  await refreshPreview();
  renderMeta();
  renderStrip();
  // A brand-new control has no facets and no commands: land on html, which
  // patchMode can CREATE by typing, rather than on the commands tab telling
  // you it isn't wired up.
  await setFacet(facetPresent("html") || (patchMode && !facetPresent("cmd"))
    ? "html" : "cmd");
  return { name, dispose: () => unregCtx.forEach((u) => u()) };
}

  return init(ME, ME.DATA || {});
}).catch(function (e) {
  console.log("workbench failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
