// workbench — the bench screen. M4: when the agent write API (CONTRACT §6)
// is present, every save is a patch through patch_control_facet — minimal
// exact-match snippet (whole-facet replace as the fallback shape), base-hash
// concurrency, and the shared per-control journal rendered as the timeline
// with inverse-patch revert. Absent ui facets are creatable (empty
// old_snippet). Where the agent library isn't built (or in mock mode) the M2
// dev.save_control adapter and localStorage history remain as the fallback,
// and the strip's caption says which door is in use.

import { mountControl } from "../../assets/loader.js";
import { store } from "../../assets/store.js";
import { FACETS } from "../../assets/facets.js";
import { chatctx } from "../../assets/chatctx.js";

const UI_FACETS = new Set(["html", "css", "js"]);
const CMD_LANGS = ["rust", "js", "java", "python", "py", "flow"];
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

export async function init(host, { lib, ctlId, toast }) {
  const index = await store.controls(lib);
  const entry = (index instanceof Error ? [] : index).find((c) => c.id === ctlId);
  const record = await store.control(lib, ctlId);
  if (record instanceof Error) {
    host.querySelector(".wb-absent").hidden = false;
    host.querySelector(".wb-absent").textContent =
      `could not read this control: ${record.message}`;
    return { name: entry?.name ?? "unavailable" };
  }
  const name = record.name ?? entry?.name ?? "unnamed";
  const writable = store.writable();
  // journalMode: the CONTRACT §6 agent API answers here (journal readable
  // even on a read-only live connection). patchMode: saves go through it.
  const journalMode = await store.patchApi();
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
    if (facet === "data") return JSON.stringify(record.data, null, 1);
    if (facet === "three") {
      return typeof record.three === "string"
        ? record.three : JSON.stringify(record.three, null, 1);
    }
    return record[facet] ?? "";
  }

  // ── chips + actions ───────────────────────────────────────
  for (const facet of FACETS) {
    const chip = document.createElement("button");
    chip.className = "wb-chip";
    chip.setAttribute("role", "tab");
    chip.classList.toggle("absent", !facetPresent(facet));
    chip.innerHTML = `<span class="dot" aria-hidden="true"></span><span></span>`;
    chip.querySelector(".dot").style.background = FACET_HUES[facet];
    chip.lastElementChild.textContent = facet === "cmd" ? "commands" : facet;
    if (facet === "cmd" && facetPresent(facet)) {
      const cnt = document.createElement("span");
      cnt.className = "cnt";
      cnt.textContent = record.cmd.length;
      chip.appendChild(cnt);
    }
    chip.addEventListener("click", () => setFacet(facet));
    chipsEl.appendChild(chip);
    chips.set(facet, chip);
  }

  // Legacy `three` facet: not in the fixed order — a read-only chip appears
  // only where the facet exists (scene-facet-design Part V).
  if (record.three !== undefined) {
    const chip = document.createElement("button");
    chip.className = "wb-chip";
    chip.setAttribute("role", "tab");
    chip.title = "the pre-redesign 3D facet — read-only; the go-forward facet is scene";
    chip.innerHTML = `<span class="dot" aria-hidden="true"></span><span></span>`;
    chip.querySelector(".dot").style.background = FACET_HUES.three;
    chip.lastElementChild.textContent = "three · legacy";
    chip.addEventListener("click", () => setFacet("three"));
    chipsEl.appendChild(chip);
    chips.set("three", chip);
  }

  const actions = document.createElement("div");
  actions.className = "wb-actions";
  if (writable) {
    actions.innerHTML = patchMode
      ? `<input class="wb-label" placeholder="label this patch" title="short label for the journal entry (optional)">
         <button class="wb-save" disabled>save ⌘s</button>`
      : `<button class="wb-save" disabled>save ⌘s</button>`;
    actions.querySelector(".wb-save").addEventListener("click", () => save());
  } else {
    actions.innerHTML = `<span class="wb-rostate">read-only — enable saves in the
      connection dialog (point it at a disposable instance)</span>`;
  }
  chipsEl.appendChild(actions);
  const labelInput = actions.querySelector(".wb-label");

  function refreshDirtyUi() {
    for (const [facet, chip] of chips) {
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
    const saveBtn = actions.querySelector(".wb-save");
    if (saveBtn) saveBtn.disabled = !dirty.has(activeFacet);
  }

  // ── facet switching ───────────────────────────────────────
  async function ensureEditor(facet) {
    if (editors.has(facet)) return editors.get(facet);
    const slot = document.createElement("div");
    editorsEl.appendChild(slot);
    const api = await mountControl("editor", slot, {
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
      const rf = await store.readFacet(lib, name, facet);
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
      chip.setAttribute("aria-selected", f === facet);
    }
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
    } else if (!facetPresent(facet) && !(patchMode && UI_FACETS.has(facet))) {
      absentEl.hidden = false;
      absentEl.textContent = UI_FACETS.has(facet)
        ? `this control has no ${facet} facet — creating one needs the agent write API (CONTRACT §6)`
        : `this control has no ${facet} facet — creating one is not wired up yet`;
    } else if (!facetPresent(facet) && patchMode && UI_FACETS.has(facet)) {
      // Facet absence is a normal state: open an empty editor; saving
      // creates the facet (empty old_snippet = create/replace).
      absentEl.hidden = false;
      absentEl.textContent =
        `this control has no ${facet} facet yet — type and save to create it`;
      const { slot } = await ensureEditor(facet);
      editorsEl.hidden = false;
      slot.hidden = false;
    } else if (facet === "cmd") {
      cmdsEl.hidden = false;
      renderCommands();
    } else if (facet === "three") {
      threeEl.hidden = false;
      await renderThree();
    } else {
      const { slot } = await ensureEditor(facet);
      editorsEl.hidden = false;
      slot.hidden = false;
    }
    refreshDirtyUi();
  }

  // ── saving ────────────────────────────────────────────────
  async function save(overwrite = false) {
    const facet = activeFacet;
    if (!writable || !UI_FACETS.has(facet) || !dirty.has(facet)) return;
    const source = editors.get(facet).api.getValue();
    if (patchMode) return savePatch(facet, source, overwrite);
    return saveAdapter(facet, source, overwrite);
  }

  // The patch path (CONTRACT §6): compute the minimal exact-match snippet
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

  async function savePatch(facet, source, overwrite) {
    const label = labelInput?.value.trim() ?? "";
    let patch;
    let base;
    if (overwrite) {
      // Rebase mine over theirs: re-read for a fresh base, replace whole.
      const rf = await store.readFacet(lib, name, facet);
      if (rf.status !== "ok") {
        toast.show(`re-read failed: ${rf.msg}`);
        return;
      }
      patch = { oldSnippet: "", newSnippet: source };
      base = rf.hash;
    } else {
      patch = computePatch(baselines.get(facet) ?? "", source);
      if (!patch) {
        dirty.delete(facet);
        refreshDirtyUi();
        return;
      }
      base = hashes.get(facet) ?? "";
    }

    const r = await store.patchFacet(lib, name, facet, { ...patch, base, label });
    if (r.status !== "ok") {
      if (r.msg === "stale_base") {
        conflictEl.hidden = false;
        conflictEl.querySelector(".wc-msg").textContent =
          `the ${facet} facet changed on the server since you loaded it`;
        conflictEl.querySelector(".wc-theirs").onclick = async () => {
          pushHistory(facet, source, "conflict-stash");
          const rf = await store.readFacet(lib, name, facet);
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
        conflictEl.querySelector(".wc-mine").onclick = () => {
          conflictEl.hidden = true;
          save(true);
        };
        return;
      }
      toast.show(`patch failed: ${r.msg}`);
      return;
    }

    baselines.set(facet, source);
    hashes.set(facet, r.hash);
    record[facet] = source;
    dirty.delete(facet);
    chips.get(facet)?.classList.remove("absent");
    if (labelInput) labelInput.value = "";
    store.invalidateControl(lib, ctlId);
    refreshDirtyUi();
    renderStrip();
    refreshPreview();
    toast.show(`patch_control_facet → applied · ${r.patch_id} · live`);
  }

  // The M2 adapter path — the fallback when the agent library isn't built.
  async function saveAdapter(facet, source, overwrite) {
    if (!overwrite) {
      const onServer = await store.facetOnServer(lib, ctlId, facet);
      if (onServer instanceof Error) {
        toast.show(`conflict check failed: ${onServer.message}`);
        return;
      }
      if (onServer !== baselines.get(facet)) {
        conflictEl.hidden = false;
        conflictEl.querySelector(".wc-msg").textContent =
          `the ${facet} facet changed on the server since you loaded it`;
        conflictEl.querySelector(".wc-theirs").onclick = () => {
          pushHistory(facet, source, "conflict-stash");
          editors.get(facet).api.setSource(onServer);
          baselines.set(facet, onServer);
          record[facet] = onServer;
          dirty.delete(facet);
          conflictEl.hidden = true;
          refreshDirtyUi();
          renderHistory();
          refreshPreview();
          toast.show("loaded theirs — your version is in local history");
        };
        conflictEl.querySelector(".wc-mine").onclick = () => {
          conflictEl.hidden = true;
          save(true);
        };
        return;
      }
    }

    const result = await store.saveControlFacet(lib, ctlId, facet, source);
    if (result instanceof Error) {
      toast.show(`save failed: ${result.message}`);
      return;
    }
    baselines.set(facet, source);
    record[facet] = source;
    dirty.delete(facet);
    pushHistory(facet, source, "save");
    refreshDirtyUi();
    renderHistory();
    refreshPreview();
    toast.show(`dev.save_control → saved · ${facet}`);
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
       — you and the agent use the same door`;
    const wrap = host.querySelector(".wb-hist-chips");
    const r = await store.listPatches(lib, name, 40);
    const entries = r.status === "ok" ? (r.patches ?? []) : [];
    const chipsOut = entries.map((p) => {
      const chip = document.createElement("span");
      chip.className = "wb-hist-chip wb-patch-chip";
      const when = new Date(p.time).toTimeString().slice(0, 5);
      chip.title = `${p.label || "(no label)"} · ${when}`;
      chip.innerHTML = `<span class="hdot"></span><span class="ptxt"></span>`;
      chip.querySelector(".hdot").style.background = FACET_HUES[p.facet];
      chip.querySelector(".ptxt").textContent =
        `${p.patch_id} · ${p.author || "?"} · ${p.facet}${p.label ? ` · ${p.label}` : ""}`;
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
    const r = await store.writeControlScene(lib, name, body, {
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
    const r = await store.patchFacet(lib, name, p.facet, {
      oldSnippet: p.new, newSnippet: p.old, base: "",
      label: `revert ${p.patch_id}`,
    });
    if (r.status !== "ok") {
      toast.show(/not found|ambiguous/i.test(r.msg ?? "")
        ? `cannot revert ${p.patch_id} cleanly — the ${p.facet} facet has changed since`
        : `revert failed: ${r.msg}`);
      return;
    }
    const rf = await store.readFacet(lib, name, p.facet);
    if (rf.status === "ok") {
      record[p.facet] = rf.source;
      baselines.set(p.facet, rf.source);
      hashes.set(p.facet, rf.hash);
      editors.get(p.facet)?.api.setSource(rf.source);
      dirty.delete(p.facet);
    }
    store.invalidateControl(lib, ctlId);
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

  function renderMeta() {
    const view = metaEl.querySelector(".wm-view");
    view.textContent = record.desc
      || "no description — agents discover this control through desc";
    view.classList.toggle("empty", !record.desc);
    metaEl.querySelector(".wm-tags-view").textContent =
      record.tags ? `tags: ${record.tags}` : "";
    const g = metaEl.querySelector(".wm-groups-view");
    g.textContent = record.groups
      ? `security groups: ${record.groups}` : "security: admin only";
    metaEl.querySelector(".wm-edit").hidden = !patchMode;
    metaEl.querySelector(".wm-groups-btn").hidden = !patchMode;
    // publish rides dev commands, not the agent lib — live mode is enough
    metaEl.querySelector(".wm-publish").hidden = store.mode() !== "live";
  }

  metaEl.querySelector(".wm-edit").addEventListener("click", () => {
    const form = metaEl.querySelector(".wm-form");
    form.hidden = !form.hidden;
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
      const r = await store.setControlMeta(lib, name, dArg, "");
      if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
      record.desc = dArg;
    }
    if (tChanged) {
      const r = await store.setTags(lib, name, "", tags);
      if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
      record.tags = tags;
    }
    store.invalidateControl(lib, ctlId);
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
  metaEl.querySelector(".wm-groups-btn").addEventListener("click", async () => {
    const form = metaEl.querySelector(".wm-groups-form");
    form.hidden = !form.hidden;
    if (!form.hidden) {
      const input = form.querySelector(".wm-groups-in");
      input.value = record.groups ?? "";
      form.querySelector(".wm-groups-note").textContent = "";
      form.querySelector(".wm-groups-apply").textContent = "set groups";
      input.focus();
      const known = await store.securityGroups();
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
    const r = await store.setGroups(lib, name, "", v);
    if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
    if (v) record.groups = v; else delete record.groups;
    store.invalidateControl(lib, ctlId);
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
    const mi = await store.metaIdentity();
    const data = mi?.status === "ok" && mi.exists ? mi : null;
    edit.hidden = !writable || !data;
    if (data) {
      view.classList.remove("warn");
      view.textContent = `publishing as ${data.displayname ?? "?"}` +
        (data.organization ? ` · ${data.organization}` : "");
      form.hidden = true;
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
    const r = await store.setMetaIdentity(displayname, organization);
    if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
    note.textContent = "";
    toast.show(`set_meta_identity → ${r.created ? "created" : "updated"}`);
    await renderIdentity();
  });

  host.querySelector(".wm-publish").addEventListener("click", async () => {
    publishEl.hidden = !publishEl.hidden;
    if (publishEl.hidden) return;
    const cap = publishEl.querySelector(".wp-cap");
    cap.textContent = "loading publish context…";
    const got = await store.invoke("dev", "editcontrol", "get_publish_context",
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
    const r = await store.invoke("dev", "editcontrol", "publishapp", { data });
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
    store.invalidateControl(lib, ctlId);
  });

  // ── timers/events (G-7, the P2 setters — CONTRACT §6) ─────
  // The control record's timer/event arrays link component records by
  // {id, name}; details live in the components. Sets are replace-only by
  // name and register LIVE (the dev editor's timeron/eventon — no restart),
  // so a short-interval timer fires for real: editing stays behind
  // patchMode, i.e. saves ON against a disposable instance.
  const wiringEl = host.querySelector(".wb-wiring");

  function cmdNameById(id) {
    return record.cmd?.find((c) => c.id === id)?.name;
  }

  async function refreshWiringArrays() {
    // A replaced component keeps its record id — drop the cached copies or
    // the detail line re-renders stale.
    for (const e of [...(record.timer ?? []), ...(record.event ?? [])]) {
      store.invalidateControl(lib, e.id);
    }
    store.invalidateControl(lib, ctlId);
    const fresh = await store.control(lib, ctlId);
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
    store.control(lib, entry.id).then((comp) => {
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
          ? await store.removeTimer(lib, name, entry.name)
          : await store.removeEventHandler(lib, name, entry.name);
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
    cap.innerHTML = patchMode
      ? `The control's wiring: timers and event handlers run this control's
         commands without a browser. Sets are <span class="hi">replace-only</span>
         by name and register <span class="hi">live immediately</span> — a
         short-interval timer fires for real on this instance. Changes are
         journaled in the strip (facets <code>timer</code>/<code>event</code>).`
      : `The control's wiring: timers and event handlers run this control's
         commands without a browser. Editing needs the agent write API on a
         live connection with saves ON (CONTRACT §6).`;
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

  host.querySelector(".wm-wiring").addEventListener("click", () => {
    wiringEl.hidden = !wiringEl.hidden;
    if (!wiringEl.hidden) renderWiring();
  });
  wiringEl.querySelector(".ww-timer-add").addEventListener("click", () => openWiringForm("timer"));
  wiringEl.querySelector(".ww-event-add").addEventListener("click", () => openWiringForm("event"));

  wiringEl.querySelector(".ww-timer-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const note = form.querySelector(".ww-note");
    const r = await store.setTimer(lib, name, {
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
    const r = await store.setEventHandler(lib, name, {
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
        ? await store.removeTimer(lib, name, p.cmd)
        : await store.removeEventHandler(lib, name, p.cmd);
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
        ? await store.setTimer(lib, name, {
            name: p.cmd, cmd: cmdName, start: old.start, startunit: old.startunit,
            interval: old.interval, intervalunit: old.intervalunit, repeat: old.repeat,
          })
        : await store.setEventHandler(lib, name, {
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
    // desc/tags/groups live on the command's implementation record (CONTRACT §6).
    const cmdRec = await store.control(lib, cmdEntry.id);
    if (cmdRec instanceof Error) return null;
    const lang = cmdRec.type ?? commandLang(cmdEntry);
    const implId = cmdRec[lang];
    if (!implId) return null;
    const impl = await store.control(lib, implId);
    if (impl instanceof Error) return null;
    return { desc: impl.desc ?? "", tags: impl.tags ?? "", groups: impl.groups ?? "", implId };
  }

  // ── command code pane (DESIGN §4.2.4: text-language commands open a
  // code pane in place of the table) ────────────────────────
  // read_command / patch_command_body ride the agent API; the snippet is
  // computed like facet saves. patch_command_body recompiles on success
  // and has no base hash — exact-match is the only concurrency guard, so
  // a server-side change surfaces as "snippet not found" with a re-read.
  const codeEl = host.querySelector(".wb-cmd-code");
  let codeApi = null;
  let codeState = null;   // {cmdName, ext, baseline, dirty}

  function closeCommandPane() {
    codeEl.hidden = true;
    codeState = null;
    host.querySelector(".wb-cmds .wb-note").hidden = false;
    host.querySelector(".wb-cmd-rows").hidden = false;
  }
  host.querySelector(".wcc-back").addEventListener("click", closeCommandPane);

  async function openCommandPane(cmdEntry, lang) {
    host.querySelector(".wb-cmds .wb-note").hidden = true;
    host.querySelector(".wb-cmd-rows").hidden = true;
    codeEl.hidden = false;
    const errEl = codeEl.querySelector(".wcc-err");
    errEl.hidden = true;
    codeEl.querySelector(".wcc-name").textContent = cmdEntry.name;
    const typeEl = codeEl.querySelector(".wcc-type");
    typeEl.textContent = lang;
    typeEl.className = `wcc-type wb-cmd-type t-${lang}`;
    codeEl.querySelector(".wcc-sig").textContent = "…";

    const r = await store.readCommand(lib, name, cmdEntry.name);
    if (r.status !== "ok") {
      codeEl.querySelector(".wcc-sig").textContent = "";
      errEl.hidden = false;
      errEl.textContent = `could not read this command's body: ${r.msg}` +
        (journalMode ? "" : " — command bodies need the agent API (live connection)");
      return;
    }
    const ext = (r.type ?? lang) === "rust" ? "rs" : (r.type ?? lang);
    const source = typeof r[ext] === "string" ? r[ext] : "";
    const sig = `(${(r.params ?? []).map((p) => `${p.name}: ${p.type}`).join(", ")}) → ${r.returntype ?? "?"}`;
    codeEl.querySelector(".wcc-sig").textContent = sig;

    if (!codeApi) {
      codeApi = await mountControl("editor", codeEl.querySelector(".wcc-editor"), {
        language: "js",   // closest tinting for rust/python; not semantic
        readOnly: !patchMode,
        onChange: () => updateCodeDirty(),
        onSave: () => saveCommandBody(),
      });
    }
    codeApi.setSource(source);
    const impEl = codeEl.querySelector(".wcc-imports");
    codeEl.querySelector(".wcc-imports-row").hidden = false;
    impEl.value = r.import ?? "";
    impEl.readOnly = !patchMode;
    codeState = { cmdName: cmdEntry.name, ext, lang: r.type ?? lang,
                  params: r.params ?? [], returntype: r.returntype ?? "",
                  baseline: source, importsBaseline: r.import ?? "", dirty: false };
    const saveBtn = codeEl.querySelector(".wcc-save");
    saveBtn.hidden = !patchMode;
    saveBtn.disabled = true;
  }
  host.querySelector(".wcc-save").addEventListener("click", () => saveCommandBody());
  host.querySelector(".wcc-imports").addEventListener("input", () => updateCodeDirty());

  function updateCodeDirty() {
    if (!codeState) return;
    const impEl = codeEl.querySelector(".wcc-imports");
    codeState.dirty = codeApi.getValue() !== codeState.baseline
      || impEl.value !== (codeState.importsBaseline ?? "");
    codeEl.querySelector(".wcc-save").disabled = !codeState.dirty;
  }

  async function saveCommandBody() {
    if (!codeState?.dirty || !patchMode) return;
    const errEl = codeEl.querySelector(".wcc-err");
    const impEl = codeEl.querySelector(".wcc-imports");
    const source = codeApi.getValue();
    const notes = [];
    errEl.hidden = true;

    // imports first (set_command_imports recompiles): a body edit that
    // needs a new `use` compiles on the second call, not on ordering luck
    if (impEl.value !== (codeState.importsBaseline ?? "")) {
      const r = await store.setCommandImports(lib, name, codeState.cmdName, impEl.value);
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
      const r = await store.patchCommandBody(lib, name, codeState.cmdName,
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
    if (!/^[a-z][a-z0-9_]*$/.test(cmdName)) {
      wcNote.textContent = "lowercase letters, digits and _ only, starting with a letter";
      return;
    }
    if ((record.cmd ?? []).some((c) => c.name === cmdName)) {
      wcNote.textContent = `${name} already has a command named ${cmdName}`;
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
      r = await store.writeFlowBody(lib, name, cmdName, starterFlowBody(parsed.params),
        { label: `create ${cmdName}` });
    } else {
      const ret = wcRet.value;
      const body = wcLang.value === "python"
        ? "return None"
        : RUST_STARTER[ret] ?? "DataObject::new()";
      r = await store.upsertCommand(lib, name, cmdName,
        { lang: wcLang.value, returnType: ret, params: parsed.params, codeBody: body });
    }
    if (r.status !== "ok" && r.kind !== "compile_error") {
      wcNote.textContent = `failed: ${r.msg}`;
      return;
    }
    wcNote.textContent = "";
    wcName.value = "";
    wcParams.value = "";
    store.invalidateControl(lib, ctlId);
    const fresh = await store.control(lib, ctlId);
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

  // ── right-pane extras ─────────────────────────────────────
  function renderCommands() {
    newCmdForm.hidden = !patchMode;
    const rows = host.querySelector(".wb-cmd-rows");
    if (rows.childElementCount > 0) return;
    for (const cmdEntry of record.cmd) {
      const row = document.createElement("div");
      row.className = "wb-cmd-row";
      row.innerHTML = `<span class="cname"></span><span class="wb-cmd-type"></span>`;
      row.querySelector(".cname").textContent = cmdEntry.name;
      const type = row.querySelector(".wb-cmd-type");
      const setLang = (l) => {
        type.textContent = l;
        type.className = `wb-cmd-type t-${l}`;
      };
      const addFlowOpen = () => {
        if (row.querySelector(".wb-cmd-flow")) return;
        const open = document.createElement("button");
        open.className = "wb-cmd-open wb-cmd-flow";
        open.textContent = "open flow ▸";
        open.addEventListener("click", () => {
          location.hash = `#/flow/${lib}/${ctlId}/${cmdEntry.id}`;
        });
        row.insertBefore(open, type.nextSibling);
      };
      // The entry's language keys are legacy artifacts (java ids linger on
      // rust commands); show them only until the command record's `type` —
      // the authoritative field — loads.
      const addCodeOpen = (lang) => {
        if (row.querySelector(".wb-cmd-codeopen")) return;
        const open = document.createElement("button");
        open.className = "wb-cmd-open wb-cmd-codeopen";
        open.textContent = "open ▸";
        open.addEventListener("click", () => openCommandPane(cmdEntry, lang));
        row.insertBefore(open, type.nextSibling);
      };
      const guess = commandLang(cmdEntry);
      setLang(guess);
      if (guess === "flow") addFlowOpen(); else addCodeOpen(guess);
      store.control(lib, cmdEntry.id).then((cmdRec) => {
        if (cmdRec instanceof Error || !cmdRec.type) return;
        if (cmdRec.type !== guess) setLang(cmdRec.type);
        if (cmdRec.type === "flow") {
          row.querySelector(".wb-cmd-codeopen")?.remove();
          addFlowOpen();
        } else {
          row.querySelector(".wb-cmd-flow")?.remove();
          addCodeOpen(cmdRec.type);
        }
      });
      const metaBtn = document.createElement("button");
      metaBtn.className = "wb-cmd-open";
      metaBtn.textContent = "meta ▸";
      metaBtn.title = "the command's desc and tags";
      row.appendChild(metaBtn);
      if (patchMode) {
        const del = document.createElement("button");
        del.className = "wb-cmd-open wb-cmd-del";
        del.textContent = "delete";
        del.title = "removes the command and its implementation record — "
          + "journaled on this control's timeline; revert re-authors from the entry";
        del.addEventListener("click", async () => {
          // the asset browser's two-click confirm, same 2.5s window
          if (del.textContent !== "really delete?") {
            del.textContent = "really delete?";
            setTimeout(() => { del.textContent = "delete"; }, 2500);
            return;
          }
          const r = await store.deleteCommand(lib, name, cmdEntry.name);
          if (r.status !== "ok") {
            toast.show(`delete failed: ${r.msg}`);
            return;
          }
          store.invalidateControl(lib, ctlId);
          const fresh = await store.control(lib, ctlId);
          if (!(fresh instanceof Error)) record.cmd = fresh.cmd ?? [];
          host.querySelector(".wb-cmd-rows").replaceChildren();
          renderCommands();
          chips.get("cmd")?.classList.toggle("absent", (record.cmd ?? []).length === 0);
          toast.show(`delete_command → ${cmdEntry.name} removed (journaled ${r.patch_id})`);
        });
        row.appendChild(del);
      }
      const detail = document.createElement("div");
      detail.className = "wb-cmd-meta";
      detail.hidden = true;
      rows.appendChild(row);
      rows.appendChild(detail);
      metaBtn.addEventListener("click", async () => {
        detail.hidden = !detail.hidden;
        if (detail.hidden || detail.childElementCount > 0) return;
        const meta = await commandMeta(cmdEntry);
        if (!meta) {
          detail.textContent = "could not read this command's records";
          return;
        }
        if (!patchMode) {
          detail.innerHTML = `<span class="cm-desc"></span><span class="cm-tags"></span><span class="cm-groups"></span>`;
          detail.querySelector(".cm-desc").textContent =
            meta.desc || "no description — agents discover commands through desc";
          detail.querySelector(".cm-desc").classList.toggle("empty", !meta.desc);
          detail.querySelector(".cm-tags").textContent =
            meta.tags ? `tags: ${meta.tags}` : "";
          detail.querySelector(".cm-groups").textContent =
            meta.groups ? `security groups: ${meta.groups}` : "security: admin only";
          return;
        }
        detail.innerHTML = `
          <input class="cm-desc-in" placeholder="describe this command — agents read this">
          <input class="cm-tags-in" placeholder="tags (comma-delimited — categorization, never security)">
          <button class="cm-apply">set</button>
          <button class="cm-gen" title="Draft a description from the command's code (agent.plugin.describe_command)">generate ▸</button>
          <input class="cm-groups-in"
            placeholder="security groups (comma-delimited) — empty = admin only"
            title="who can execute this command — check_security reads the readers derived from this">
          <button class="cm-groups-apply"
            title="the deliberate set_groups act — writes the groups string and derives the enforced readers on this command's meta + impl records">set groups</button>
          <span class="cm-note"></span>`;
        detail.querySelector(".cm-desc-in").value = meta.desc;
        detail.querySelector(".cm-tags-in").value = meta.tags;
        detail.querySelector(".cm-groups-in").value = meta.groups ?? "";
        const groupsApply = detail.querySelector(".cm-groups-apply");
        groupsApply.addEventListener("click", async () => {
          const note = detail.querySelector(".cm-note");
          const gv = detail.querySelector(".cm-groups-in").value.trim();
          if (gv === (meta.groups ?? "").trim()) { note.textContent = "groups: nothing changed"; return; }
          if (!gv && groupsApply.textContent !== "really clear? (admin-only)") {
            groupsApply.textContent = "really clear? (admin-only)";
            setTimeout(() => { groupsApply.textContent = "set groups"; }, 2500);
            return;
          }
          const r = await store.setGroups(lib, name, cmdEntry.name, gv);
          if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
          meta.groups = gv;
          groupsApply.textContent = "set groups";
          store.invalidateControl(lib, cmdEntry.id);
          store.invalidateControl(lib, meta.implId);
          note.textContent = "";
          toast.show(`set_groups → readers [${(r.readers ?? []).join(", ") || "— admin only"}] on ${cmdEntry.name}`);
        });
        detail.querySelector(".cm-gen").addEventListener("click", async () => {
          const note = detail.querySelector(".cm-note");
          const gen = detail.querySelector(".cm-gen");
          gen.disabled = true;
          note.textContent = "generating…";
          const rc = await store.readCommand(lib, name, cmdEntry.name);
          if (rc.status !== "ok") {
            note.textContent = `could not read the command: ${rc.msg}`;
            gen.disabled = false;
            return;
          }
          const lang2 = rc.type ?? "rust";
          const ext2 = lang2 === "rust" ? "rs" : lang2;
          const r = await store.describeCommand({
            command_name: cmdEntry.name,
            lang: lang2,
            returntype: rc.returntype ?? "",
            groups: meta.groups ?? "",
            params: rc.params ?? [],
            imports: rc.import ?? "",
            code: typeof rc[ext2] === "string" ? rc[ext2] : "",
            current_description: detail.querySelector(".cm-desc-in").value.trim(),
          });
          gen.disabled = false;
          if (r.status !== "ok") {
            note.textContent = `generate failed: ${r.msg}`;
            return;
          }
          detail.querySelector(".cm-desc-in").value = (r.msg ?? "").trim();
          note.textContent = "drafted — review, then set";
        });
        detail.querySelector(".cm-apply").addEventListener("click", async () => {
          const note = detail.querySelector(".cm-note");
          const desc = detail.querySelector(".cm-desc-in").value.trim();
          const tags = detail.querySelector(".cm-tags-in").value.trim();
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
            const r = await store.setCommandMeta(lib, name, cmdEntry.name, dArg, "");
            if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
            meta.desc = dArg;
          }
          if (tChanged) {
            const r = await store.setTags(lib, name, cmdEntry.name, tags);
            if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
            meta.tags = tags;
          }
          store.invalidateControl(lib, cmdEntry.id);
          store.invalidateControl(lib, meta.implId);
          note.textContent = "";
          toast.show(tChanged && !dArg ? "set_tags → saved" : "set_command_meta → saved");
        });
      });
    }
    const note = host.querySelector(".wb-cmds .wb-note");
    if (!note.querySelector("a")) {
      const link = document.createElement("a");
      link.href = "#/flow/sample";
      link.textContent = " View a sample flow ▸";
      link.style.color = "var(--accent)";
      note.appendChild(link);
    }
  }

  async function renderThree() {
    const slot = host.querySelector(".wb-three-slot");
    if (slot.childElementCount > 0) return;
    const viewer = document.createElement("div");
    viewer.style.height = "100%";
    slot.appendChild(viewer);
    const api = await mountControl("editor", viewer, { language: "json", readOnly: true });
    api.setSource(facetSource("three"));
  }

  async function renderScene() {
    const slot = host.querySelector(".wb-scene-slot");
    if (slot.childElementCount > 0) return;
    const inner = document.createElement("div");
    inner.style.height = "100%";
    slot.appendChild(inner);
    await mountControl("sceneeditor", inner, {
      lib, name, record, toast,
      onSaved: (scene) => {
        record.scene = scene;
        chips.get("scene")?.classList.remove("absent");
        if (journalMode) renderStrip(); else renderHistory();
      },
    });
  }

  // ── preview: static (shadow root, html+css) or LIVE (R-2 gap bar) ─
  // Live = the platform's own /dev/preview.html in an iframe — a real
  // stock mount, js on, the old dev UI's preview capability. Saves reload
  // it (every save path ends in refreshPreview). Bench-dialect (ES module)
  // controls don't run under the stock mount — static covers those.
  const previewSlot = host.querySelector(".wb-left");
  const PREVIEW_MODE_KEY = "bench.preview.mode";

  // ── the preview pane's geometry: hidden / width / fullscreen ────────
  // Width and hidden PERSIST (they are a working preference). Fullscreen
  // does not: reloading into a pane that covers the editor, with no memory
  // of having asked for it, is a puzzle rather than a convenience.
  const PV_W_KEY = "bench.preview.w", PV_OFF_KEY = "bench.preview.off";
  const PV_DEFAULT = 400, PV_MIN = 220;
  const wbRoot = host.classList.contains("nb-workbench")
    ? host : host.querySelector(".nb-workbench");
  const pvToggle = host.querySelector(".wm-preview");
  const resizer = host.querySelector(".wb-resize");
  let pvOff = localStorage.getItem(PV_OFF_KEY) === "1";
  let pvFull = false;
  let pvW = Math.max(PV_MIN, Number(localStorage.getItem(PV_W_KEY)) || PV_DEFAULT);

  const pvMax = () => Math.max(PV_MIN, (wbRoot.clientWidth || 1200) - 320);
  function applyPv() {
    pvW = Math.min(Math.max(pvW, PV_MIN), pvMax());
    wbRoot.style.setProperty("--pv-w", pvW + "px");
    wbRoot.classList.toggle("pv-off", pvOff && !pvFull);
    wbRoot.classList.toggle("pv-full", pvFull);
    if (pvToggle) {
      pvToggle.setAttribute("aria-pressed", String(!pvOff));
      pvToggle.classList.toggle("on", !pvOff);
    }
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
      const step = e.shiftKey ? 48 : 16;
      if (e.key === "ArrowLeft") pvW -= step;
      else if (e.key === "ArrowRight") pvW += step;
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
    const mk = (m, label, title) => {
      const b = document.createElement("button");
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
    bar.append(
      mk("static", "static", "html+css in a shadow root — safe everywhere, with source picking"),
      mk("live", "live ▸", "a real stock mount (js runs) via the platform's /dev/preview.html — needs a live connection"),
    );
    const full = document.createElement("button");
    full.className = "wb-pv-full";
    full.addEventListener("click", () => setPvFull(!pvFull));
    bar.appendChild(full);
    previewSlot.appendChild(bar);
    const inner = document.createElement("div");
    inner.className = "wb-pv-body";
    previewSlot.appendChild(inner);

    if (previewMode === "live") {
      if (store.mode() !== "live") {
        const p = document.createElement("p");
        p.className = "wb-note";
        p.textContent = "live preview runs the control on the platform " +
          "(/dev/preview.html) — connect to an instance first; mock mode " +
          "has no platform to run it.";
        inner.appendChild(p);
        return;
      }
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

    await mountControl("preview", inner, {
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
    chatctx.register("workbench", () => ({
      label: `${lib} ▸ ${name} facets`,
      fields: {
        lib,
        ctl: name,
        html: editors.get("html")?.api.getValue() ?? record.html ?? null,
        css: editors.get("css")?.api.getValue() ?? record.css ?? null,
        js: editors.get("js")?.api.getValue() ?? record.js ?? null,
      },
    })),
    chatctx.register("command", () => codeState ? {
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
