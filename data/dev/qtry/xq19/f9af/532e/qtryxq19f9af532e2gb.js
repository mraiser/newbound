// shelf — the IDE's home: a gallery of library cards. Each card shows its
// `root` verbatim, and the root filter offers the distinct values (pure
// metadata — the platform has no category concept, so the shelf invents
// none; G-2). Opening a library (#/shelf/<lib>, via the frame) swaps the
// gallery for that library: its control cards, its desc/groups meta
// (set_library_meta / set_groups), and the Manage library panels — assets,
// Rust settings (dev.libsettings), rebuild, archive, delete. Back to the
// gallery is #/shelf, which the frame routes to showAll().


var me = this;
var ME = document.getElementById(me.UUID);

var readyP = (async () => {
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
  const libsOf = async () => {
    const r2 = await jsonP("../app/libs", null);
    return r2.status === "ok" ? (r2.data ?? []) : new Error(r2.msg || "libs failed");
  };
  const setLibraryMeta = (l2, d2, g2) => code("set_library_meta", { lib: l2, desc: d2, groups: g2 });
  const setTags = (l2, c2, m2, t2) => code("set_tags", { lib: l2, ctl: c2, cmd: m2, tags: t2, author: "" });
  const setGroups = (l2, c2, m2, g2) => code("set_groups", { lib: l2, ctl: c2, cmd: m2, groups: g2, author: "" });
  const securityGroups = async () => {
    const r2 = await jsonP("../security/groups", null);
    return r2 && r2.status === "ok" && Array.isArray(r2.data) ? r2.data : [];
  };
  const deleteLibrary = (l2) => code("delete_library", { lib: l2, author: "" });
  const deleteControl = (l2, c2) => code("delete_control", { lib: l2, ctl: c2, author: "" });
  const addControl = (l2, c2) => code("add_control", { lib: l2, ctl: c2 });
  const addLibrary = (l2) => code("add_library", { lib: l2 });
  const listAssets = (l2) => code("list_assets", { lib: l2 });
  const writeAsset = (l2, n2, c2, t2) => code("write_asset", { lib: l2, name: n2, content: c2, tempfile: t2 });
  const renameAsset = (l2, f2, t2) => code("rename_asset", { lib: l2, from: f2, to: t2 });
  const deleteAsset = (l2, n2) => code("delete_asset", { lib: l2, name: n2 });
  const setPlugin = (n2, e2) => code("set_plugin", { name: n2, target_lib: e2.target_lib,
    target_ctl: e2.target_ctl, plugin_lib: e2.plugin_lib, plugin_ctl: e2.plugin_ctl,
    selector: e2.selector, author: "" });
  const removePlugin = (n2) => code("remove_plugin", { name: n2, author: "" });
  const listPlugins = async () => {
    const got = await invoke("dev", "plugins", "list_plugins", {});
    if (got.envelope.status !== "ok") return new Error(got.envelope.msg ?? "list_plugins failed");
    return got.envelope.data ?? {};
  };
  const appCmdUrl = (a2, m2, p2) => "../" + a2 + "/" + m2 + "?" +
    Object.entries(p2).map(([k2, v2]) => k2 + "=" + encodeURIComponent(String(v2))).join("&");
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

  // the legend under a library's control cards — the card's six dots, named
  const FACET_LEGEND = [["html", "HTML", "--f-html"], ["css", "CSS", "--f-css"],
    ["js", "JS", "--f-js"], ["data", "Data", "--f-data"], ["scene", "3D", "--f-3d"],
    ["cmd", "Commands", "--f-cmd"]];

async function init(host, { openLib, openControl, toast }) {
  const scroller = host.querySelector(".nb-shelf");
  const gridEl = host.querySelector(".sh-grid");
  const noMatchEl = host.querySelector(".sh-nomatch");
  const searchEl = host.querySelector(".sh-search");
  const rootSel = host.querySelector(".sh-root");
  const libEl = host.querySelector(".sh-lib");
  const cardsEl = host.querySelector(".sh-cards");
  const cardsEmptyEl = host.querySelector(".sh-cards-empty");
  const legendEl = host.querySelector(".sh-legend");
  const libCards = new Map();
  const toShelf = () => { location.hash = "#/shelf"; };

  // The platform's own default: flowlang's get_crate_info treats an absent
  // OR empty `root` as "cmd", so libraries that never set one show "cmd"
  // rather than a "?" of their own.
  const rootOf = (lib) => (lib.root ?? "").trim() || "cmd";

  // The library gate, as boot-time meta reports it (readers refresh on
  // restart): anonymous = open (no badge), named groups shown, empty =
  // admin-only. The groups intent string prevails when present — it is what
  // set_groups writes, and the enforced readers are derived from it.
  function renderGate(card, lib) {
    const el = card.querySelector(".s-gate");
    if (!el) return;
    const g = (lib.groups ?? (Array.isArray(lib.readers) ? lib.readers.join(",") : "")).trim();
    const open = g.split(",").map((s) => s.trim()).includes("anonymous");
    el.textContent = g ? (open ? "" : g) : "admin";
    el.title = g ? `security groups: ${g}` : "admin only — no groups granted";
  }

  function countText(lib, n) {
    const parts = [];
    if (n !== null) parts.push(`${n} control${n === 1 ? "" : "s"}`);
    if (lib.version) parts.push(`v${lib.version}`);
    return parts.join(" · ");
  }

  const libs = await libsOf();
  if (libs instanceof Error) {
    toast.show(`could not list libraries: ${libs.message}`);
    return {};
  }
  const writable = true;
  const patchApi = true;

  // ── the gallery ───────────────────────────────────────────
  // ordered root first, then name — the order the old root groups had
  const byRootThenName = (a, b) => rootOf(a).localeCompare(rootOf(b)) || a.id.localeCompare(b.id);

  function addLibCard(lib) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sh-libcard";
    card.innerHTML =
      `<span class="s-name"><span class="s-id"></span><i class="sh-i sh-i-next" aria-hidden="true"></i></span>` +
      `<span class="s-meta"><span class="s-count"></span><span class="s-gate"></span><span class="s-root"></span></span>`;
    card.querySelector(".s-id").textContent = lib.id;
    card.querySelector(".s-root").textContent = rootOf(lib);
    card.querySelector(".s-root").title = `root · ${rootOf(lib)}`;
    card.querySelector(".s-count").textContent = countText(lib, null);
    renderGate(card, lib);
    if (lib.desc) card.title = lib.desc;
    card.addEventListener("click", () => openLib(lib.id));
    gridEl.appendChild(card);
    libCards.set(lib.id, card);
    controlsOf(lib.id).then((controls) => {
      if (!(controls instanceof Error)) {
        card.querySelector(".s-count").textContent = countText(lib, controls.length);
      }
    });
  }

  for (const lib of [...libs].sort(byRootThenName)) addLibCard(lib);
  for (const r of [...new Set(libs.map(rootOf))].sort()) {
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    rootSel.appendChild(opt);
  }

  function applyFilter() {
    const q = searchEl.value.trim().toLowerCase();
    const r = rootSel.value;
    let shown = 0;
    for (const lib of libs) {
      const card = libCards.get(lib.id);
      if (!card) continue;
      const match = (!r || rootOf(lib) === r) && lib.id.toLowerCase().includes(q);
      card.hidden = !match;
      if (match) shown++;
    }
    noMatchEl.hidden = !libEl.hidden || shown > 0;
  }

  // filtering is a gallery act: from an open library it returns to the
  // gallery (the frame routes #/shelf to showAll, which re-applies it)
  function onFilter() {
    if (!libEl.hidden) toShelf();
    else applyFilter();
  }
  searchEl.addEventListener("input", onFilter);
  rootSel.addEventListener("change", onFilter);

  // ── one library: the action bar (meta ▸ … delete library) and its panels ─
  // One panel open at a time; a bar item's ▸ turns ▾ while its panel is open.
  let fanLib = null;
  let openPanelName = null;
  const onOpen = {};   // panel name -> fill-in on open, rewired per library

  function showPanel(name) {
    openPanelName = name;
    for (const el of libEl.querySelectorAll("[data-panel]")) el.hidden = el.dataset.panel !== name;
    for (const b of libEl.querySelectorAll("[data-open]")) {
      b.setAttribute("aria-expanded", String(b.dataset.open === name));
    }
    if (name && onOpen[name]) onOpen[name]();
  }

  libEl.addEventListener("click", (ev) => {
    const opener = ev.target.closest("[data-open]");
    if (opener) {
      showPanel(openPanelName === opener.dataset.open ? null : opener.dataset.open);
      return;
    }
    if (ev.target.closest("[data-close]")) showPanel(null);
  });
  host.querySelector(".sh-back").addEventListener("click", toShelf);
  host.querySelector(".sh-close").addEventListener("click", toShelf);

  function renderLibMeta(lib) {
    for (const el of libEl.querySelectorAll(".fh-lib")) el.textContent = lib.id;
    const descEl = host.querySelector(".fh-desc");
    descEl.textContent = lib.desc
      || "no description — discovery reads desc";
    descEl.classList.toggle("empty", !lib.desc);
    const show = (sel, on) => { for (const el of libEl.querySelectorAll(sel)) el.hidden = !on; };
    show('[data-open="meta"]', writable && patchApi);
    show('[data-open="groups"]', writable && patchApi);
    show('[data-open="newctl"]', writable && patchApi);
    show(".fh-del-btn", writable && patchApi);
    show('[data-open="rebuild"]', writable);
    show('[data-open="archive"]', true);
  }

  // ── library delete (delete_library) ───────────────────────
  // rmdir semantics live on the platform side: the command refuses while
  // any control remains, so this button mostly RELAYS that refusal — the
  // deliberate path is delete each control, then the emptied library.
  function wireLibDelete(lib) {
    const del = host.querySelector(".fh-del-btn");
    del.textContent = "delete library";
    del.onclick = async () => {
      if (del.textContent !== "really delete?") {
        del.textContent = "really delete?";
        setTimeout(() => { del.textContent = "delete library"; }, 2500);
        return;
      }
      const r = await deleteLibrary(lib.id);
      if (r.status !== "ok") {
        del.textContent = "delete library";
        toast.show(`delete failed: ${r.msg}`);
        return;
      }
      toast.show(`delete_library → ${lib.id} removed`);
      libCards.get(lib.id)?.remove();
      libCards.delete(lib.id);
      const i = libs.findIndex((l) => l.id === lib.id);
      if (i >= 0) libs.splice(i, 1);
      toShelf();
    };
  }

  function wireLibMeta(lib) {
    // desc + TAGS are editable (the 2026-07-31 groups correction); the
    // security-group string is never edited from a meta form.
    const form = host.querySelector(".fh-meta");
    onOpen.meta = () => {
      form.querySelector(".fm-desc").value = lib.desc ?? "";
      form.querySelector(".fm-tags").value = lib.tags ?? "";
      form.querySelector(".fm-note").textContent = "";
      form.querySelector(".fm-desc").focus();
    };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const note = form.querySelector(".fm-note");
      note.textContent = "";
      const desc = form.querySelector(".fm-desc").value.trim();
      const tagsV = form.querySelector(".fm-tags").value.trim();
      const dArg = desc && desc !== (lib.desc ?? "") ? desc : "";
      const tChanged = tagsV !== (lib.tags ?? "");
      if (lib.desc && !desc) {
        note.textContent = "desc can't be cleared here — set a new value instead";
      }
      if (!dArg && !tChanged) {
        if (!note.textContent) note.textContent = "nothing changed";
        return;
      }
      if (dArg) {
        const r = await setLibraryMeta(lib.id, dArg, "");
        if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
        lib.desc = dArg;
        const card = libCards.get(lib.id);
        if (card) card.title = dArg;
      }
      if (tChanged) {
        const r = await setTags(lib.id, "", "", tagsV);
        if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
        lib.tags = tagsV;
      }
      showPanel(null);
      renderLibMeta(lib);
      toast.show("library meta → saved to meta.json (the instance re-reads it on restart)");
    };
  }

  // ── library groups (set_groups — the deliberate permission act) ────
  // Writes meta.json's groups string AND the enforced readers array derived
  // from it. Its own form, never part of the meta form (the 2026-07-31
  // correction): permission is not edited casually alongside desc/tags.
  function wireLibGroups(lib) {
    const form = host.querySelector(".fh-groups");
    const input = form.querySelector(".fg-input");
    const note = form.querySelector(".fg-note");
    const apply = form.querySelector(".fg-apply");
    onOpen.groups = async () => {
      input.value = lib.groups ?? "";
      note.textContent = "";
      apply.textContent = "Set groups";
      input.focus();
      const known = await securityGroups();
      form.querySelector(".fg-known").textContent =
        known.length ? `known groups: ${known.join(", ")}` : "";
    };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const v = input.value.trim();
      if (v === (lib.groups ?? "").trim()) { note.textContent = "nothing changed"; return; }
      if (!v && apply.textContent !== "really clear? (admin-only)") {
        apply.textContent = "really clear? (admin-only)";
        setTimeout(() => { apply.textContent = "Set groups"; }, 2500);
        return;
      }
      const r = await setGroups(lib.id, "", "", v);
      if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
      lib.groups = v;
      lib.readers = r.readers ?? [];
      const card = libCards.get(lib.id);
      if (card) renderGate(card, lib);
      apply.textContent = "Set groups";
      showPanel(null);
      toast.show(`set_groups → readers [${(r.readers ?? []).join(", ") || "— admin only"}] — the library gate refreshes on restart`);
    };
  }

  // ── assets (G-1, the P1 asset commands) ───────────────────
  function fmtSize(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function wireAssets(lib) {
    const panel = host.querySelector(".fh-assets");
    const rowsEl = panel.querySelector(".fa-rows");
    const form = panel.querySelector(".fa-new");
    const note = form.querySelector(".fa-note");

    async function refresh() {
      const r = await listAssets(lib.id);
      if (r.status !== "ok") {
        rowsEl.textContent = `could not list assets — ${r.msg}`;
        rowsEl.className = "fa-rows fa-empty";
        return;
      }
      rowsEl.className = "fa-rows";
      const assets = r.assets ?? [];
      if (!assets.length) {
        rowsEl.textContent = "no assets yet";
        rowsEl.className = "fa-rows fa-empty";
        return;
      }
      rowsEl.replaceChildren(...assets.map((a) => {
        const row = document.createElement("div");
        row.className = "fa-row";
        row.innerHTML = `<a class="fa-open" target="_blank"></a>
          <span class="fa-size"></span>`;
        const link = row.querySelector(".fa-open");
        link.textContent = a.name;
        link.href = `/app/asset/${lib.id}/${a.name}`;
        link.title = "open in a new tab";
        row.querySelector(".fa-size").textContent = fmtSize(a.size ?? 0);
        if (writable && patchApi) {
          const ren = document.createElement("button");
          ren.type = "button";
          ren.className = "sh-btn fa-act";
          ren.textContent = "Rename";
          ren.addEventListener("click", async () => {
            const to = prompt(`rename ${a.name} to (relative path):`, a.name);
            if (!to || to === a.name) return;
            const rr = await renameAsset(lib.id, a.name, to);
            if (rr.status !== "ok") toast.show(`rename failed: ${rr.msg}`);
            refresh();
          });
          const del = document.createElement("button");
          del.type = "button";
          del.className = "sh-btn fa-act fa-danger";
          del.textContent = "Delete";
          del.addEventListener("click", async () => {
            // two-click confirm, §5.6 spirit without a modal
            if (del.textContent !== "really delete?") {
              del.textContent = "really delete?";
              setTimeout(() => { del.textContent = "Delete"; }, 2500);
              return;
            }
            const rr = await deleteAsset(lib.id, a.name);
            if (rr.status !== "ok") toast.show(`delete failed: ${rr.msg}`);
            refresh();
          });
          row.append(ren, del);
        }
        return row;
      }));
    }

    onOpen.assets = () => {
      form.hidden = !(writable && patchApi);
      note.textContent = "";
      refresh();
    };

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const name = form.querySelector(".fa-name").value.trim();
      const content = form.querySelector(".fa-content").value;
      const tempfile = form.querySelector(".fa-tempfile").value.trim();
      if (!name) {
        note.textContent = "a name is required";
        return;
      }
      const r = await writeAsset(lib.id, name, tempfile ? "" : content, tempfile);
      if (r.status !== "ok") {
        note.textContent = `failed: ${r.msg}`;
        return;
      }
      note.textContent = "";
      form.querySelector(".fa-name").value = "";
      form.querySelector(".fa-content").value = "";
      form.querySelector(".fa-tempfile").value = "";
      toast.show(`write_asset → ${r.replaced ? "replaced" : "created"} · ${name} (${fmtSize(r.size ?? 0)})`);
      refresh();
    };
  }

  // ── Rust settings (dev.libsettings, G-3) ──────────────────
  // meta.json's root + cargo.crate_types + cargo.dependencies. Meaningless
  // until a library contains Rust — but editable, so adding Rust later has
  // a defined home. save_library_config rebuilds all three fields from the
  // form, so the form always round-trips get_library_config.
  function wireSettings(lib) {
    const panel = host.querySelector(".fh-settings");
    onOpen.settings = async () => {
      panel.querySelector(".fs-note").textContent = "";
      const got = await invoke("dev", "libsettings", "get_library_config", { id: lib.id });
      if (got instanceof Error || got.envelope.status !== "ok") {
        panel.querySelector(".fs-note").textContent =
          `could not load settings: ${got instanceof Error ? got.message : got.envelope.msg}`;
        return;
      }
      const cfg = got.envelope.data;
      panel.querySelector(".fs-root").value = cfg.root ?? "";
      panel.querySelector(".fs-ffi").checked = cfg.ffi === true;
      panel.querySelector(".fs-ffi").disabled = !writable;
      panel.querySelector(".fs-types").value = (cfg.library_types ?? []).join(", ");
      panel.querySelector(".fs-deps").value = cfg.library_dependencies ?? "";
      panel.querySelector(".fs-save").hidden = !writable;
    };
    panel.onsubmit = async (ev) => {
      ev.preventDefault();
      const note = panel.querySelector(".fs-note");
      const types = panel.querySelector(".fs-types").value
        .split(",").map((t) => t.trim()).filter(Boolean);
      const saved = await invoke("dev", "libsettings", "save_library_config", {
        data: {
          id: lib.id,
          library_root: panel.querySelector(".fs-root").value.trim(),
          ffi: panel.querySelector(".fs-ffi").checked,
          library_types: types,
          library_dependencies: panel.querySelector(".fs-deps").value,
        },
      });
      if (saved instanceof Error || saved.envelope.status !== "ok") {
        note.textContent =
          `save failed: ${saved instanceof Error ? saved.message : saved.envelope.msg}`;
        return;
      }
      note.textContent = "";
      toast.show("save_library_config → meta.json saved");
    };
  }

  // ── rebuild (dev.dev.rebuild_lib — the old dev UI's build button) ─
  // Regenerates + recompiles the library's commands from the store —
  // store edits leave compiled code behind the records until a rebuild
  // or restart.
  function wireRebuild(lib) {
    const panel = host.querySelector(".fh-rebuild");
    onOpen.rebuild = () => {
      panel.querySelector(".fr-note").textContent = "";
      panel.querySelector(".fr-out").hidden = true;
    };
    panel.onsubmit = async (ev) => {
      ev.preventDefault();
      const go = panel.querySelector(".fr-go");
      const note = panel.querySelector(".fr-note");
      const out = panel.querySelector(".fr-out");
      go.disabled = true;
      note.textContent = "rebuilding — compiles run on the instance, this can take a while…";
      const r = await invoke("dev", "dev", "rebuild_lib", { lib: lib.id });
      go.disabled = false;
      if (r instanceof Error || r.envelope.status !== "ok") {
        note.textContent = `rebuild failed: ${
          r instanceof Error ? r.message : r.envelope.msg}`;
        return;
      }
      // String returns ride the envelope's `msg` (status stays ok even for
      // an ERROR-prefixed text) — relay verbatim, and say which it was.
      const text = r.envelope.msg ?? "";
      const failed = /^ERROR/.test(text);
      note.textContent = failed ? "rebuild reported an error:"
        : `rebuild_lib → done in ${r.ms}ms`;
      out.hidden = !text;
      out.textContent = text;
      if (!failed) toast.show(`rebuild_lib → ${lib.id}`);
    };
  }

  // ── archive (dev.dev.lib_info + lib_archive — THE PEER UPDATE PATH) ─
  // Publishing an app builds a signed, versioned zip of each of its
  // libraries; peers in the update/admin groups install app updates from
  // exactly these. lib_archive's return type is File, so the link streams
  // the zip through app/exec — the browser downloads, no fetch involved.
  function wireArchive(lib) {
    const panel = host.querySelector(".fh-archive");
    onOpen.archive = async () => {
      const rows = panel.querySelector(".fk-rows");
      const note = panel.querySelector(".fk-note");
      rows.replaceChildren();
      note.textContent = "";
      const got = await invoke("dev", "dev", "lib_info", { lib: lib.id });
      if (got instanceof Error || got.envelope.status !== "ok") {
        note.textContent = `no archive info: ${
          got instanceof Error ? got.message : got.envelope.msg}`;
        return;
      }
      const info = got.envelope.data ?? {};
      const version = Number(info.version ?? lib.version ?? 0);
      if (!version) {
        note.textContent = "no archive yet — archives are built when an app naming this library publishes";
        return;
      }
      const meta = document.createElement("div");
      meta.className = "fk-meta";
      meta.textContent = ["version " + version,
        info.authorname ? "by " + info.authorname : "",
        info.authororg ? "(" + info.authororg + ")" : ""].filter(Boolean).join(" · ");
      const dl = document.createElement("a");
      dl.className = "fk-dl";
      dl.textContent = `⇓ ${lib.id}_${version}.zip`;
      dl.href = appCmdUrl("dev", "lib_archive", { lib: lib.id, version });
      dl.download = `${lib.id}_${version}.zip`;
      rows.append(meta, dl);
    };
  }

  // ── creating controls + libraries ─────────────────────────
  // No typed confirm — creating an empty record is additive.
  // add_control/add_library are pre-existing dev.code commands.
  const NAME_RE = /^[a-z][a-z0-9_]*$/;

  function nameComplaint(name, kind) {
    if (!name) return `type a ${kind} name`;
    if (!NAME_RE.test(name)) {
      return "lowercase letters, digits and _ only, starting with a letter";
    }
    return null;
  }

  const newCtlForm = host.querySelector(".sh-newctl");
  const newCtlName = host.querySelector(".sh-newctl-name");
  const newCtlNote = host.querySelector(".sh-newctl-note");
  onOpen.newctl = () => {
    newCtlNote.textContent = "";
    newCtlName.focus();
  };

  newCtlForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = newCtlName.value.trim();
    const complaint = nameComplaint(name, "control");
    if (complaint) {
      newCtlNote.textContent = complaint;
      return;
    }
    const existing = await controlsOf(fanLib);
    if (!(existing instanceof Error) && existing.some((c) => c.name === name)) {
      newCtlNote.textContent = `${fanLib} already has a control named ${name}`;
      return;
    }
    newCtlNote.textContent = "creating…";
    const r = await addControl(fanLib, name);
    if (r.status !== "ok") {
      newCtlNote.textContent = `failed: ${r.msg}`;
      return;
    }
    newCtlNote.textContent = "";
    newCtlName.value = "";
    const controls = await controlsOf(fanLib);
    const made = controls instanceof Error
      ? null : controls.find((c) => c.name === name);
    toast.show(`add_control → ${fanLib} ▸ ${name} — its facets are empty; type and save to create them`);
    if (made) {
      openControl(fanLib, made.id);   // straight into the new control's workbench
    } else {
      await showFan(fanLib);
    }
  });

  const newLibForm = host.querySelector(".sh-newlib");
  const newLibOpen = host.querySelector(".sh-newlib-open");
  const newLibName = host.querySelector(".sh-newlib-name");
  const newLibNote = host.querySelector(".sh-newlib-note");
  newLibOpen.hidden = !(writable && patchApi);
  function setNewLib(open) {
    newLibForm.hidden = !open;
    newLibOpen.setAttribute("aria-expanded", String(open));
    newLibNote.textContent = "";
    if (open) newLibName.focus();
  }
  newLibOpen.addEventListener("click", () => setNewLib(newLibForm.hidden));
  host.querySelector(".sh-newlib-cancel").addEventListener("click", () => setNewLib(false));

  newLibForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = newLibName.value.trim();
    const complaint = nameComplaint(name, "library");
    if (complaint) {
      newLibNote.textContent = complaint;
      return;
    }
    if (libs.some((l) => l.id === name)) {
      newLibNote.textContent = `${name} already exists`;
      return;
    }
    newLibNote.textContent = "creating…";
    const r = await addLibrary(name);
    if (r.status !== "ok") {
      newLibNote.textContent = `failed: ${r.msg}`;
      return;
    }
    newLibName.value = "";
    setNewLib(false);
    toast.show(`add_library → ${name} — reload to see it on the shelf, or add a control now`);
    openLib(name);
  });


  // The per-instance plugins.json edited in place: when TARGET is on a
  // page, PLUGIN mounts at SELECTOR. Instance-level like git import, so
  // it lives on the shelf header; entries apply on the next reload.
  const plugForm = host.querySelector(".sh-plugins");
  const plugOpen = host.querySelector(".sh-plugins-open");
  const plugCount = host.querySelector(".sh-plugins-count");
  const plugList = host.querySelector(".sh-plugins-list");
  const plugNote = host.querySelector(".sh-plugins-note");
  const plugEditor = host.querySelector(".sh-plugins-fields");
  const plugTitle = host.querySelector(".sh-plug-form-title");
  plugOpen.hidden = !(writable && patchApi);
  const plugFields = ["name", "tlib", "tctl", "plib", "pctl", "sel"].map(
    (k) => host.querySelector(".sh-plug-" + k));
  function showPlugEditor(title, vals) {
    plugTitle.textContent = title;
    plugFields.forEach((f, i) => { f.value = vals[i] ?? ""; });
    plugEditor.hidden = false;
    plugNote.textContent = "";
    plugFields[0].focus();
  }
  async function renderPlugins() {
    const entries = await listPlugins();
    plugList.replaceChildren();
    if (entries instanceof Error) {
      plugNote.textContent = `list_plugins failed: ${entries.message}`;
      return;
    }
    const names = Object.keys(entries).sort();
    plugCount.textContent = String(names.length);
    if (!names.length) {
      plugList.textContent = "no registrations on this instance";
      return;
    }
    for (const n of names) {
      const e = entries[n] ?? {};
      const row = document.createElement("div");
      row.className = "sh-plug-row";
      const label = document.createElement("div");
      const nameEl = document.createElement("span");
      nameEl.className = "sh-mono";
      nameEl.textContent = n;
      const what = document.createElement("code");
      what.className = "sh-plug-route";
      what.textContent =
        `${e.plugin_lib}.${e.plugin_ctl} → ${e.target_lib}.${e.target_ctl} at ${e.selector}`;
      label.append(nameEl, what);
      const actions = document.createElement("div");
      actions.className = "sh-plug-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "sh-btn sh-outline";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", `Edit ${n}`);
      edit.addEventListener("click", () => {
        showPlugEditor("Edit registration",
          [n, e.target_lib, e.target_ctl, e.plugin_lib, e.plugin_ctl, e.selector]);
      });
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "sh-btn sh-outline sh-danger";
      rm.textContent = "Remove";
      rm.setAttribute("aria-label", `Remove ${n}`);
      rm.addEventListener("click", async () => {
        // two-click confirm, the fh-del idiom
        if (rm.textContent !== "really remove?") {
          rm.textContent = "really remove?";
          setTimeout(() => { rm.textContent = "Remove"; }, 2500);
          return;
        }
        const r = await removePlugin(n);
        if (r.status !== "ok") {
          plugNote.textContent = `remove failed: ${r.msg}`;
          return;
        }
        toast.show(`remove_plugin → ${n} — applies on the next reload`);
        await renderPlugins();
      });
      actions.append(edit, rm);
      row.append(label, actions);
      plugList.append(row);
    }
  }
  function setPlugins(open) {
    plugForm.hidden = !open;
    plugOpen.setAttribute("aria-expanded", String(open));
    plugNote.textContent = "";
    plugEditor.hidden = true;
    if (open) renderPlugins();
  }
  plugOpen.addEventListener("click", () => setPlugins(plugForm.hidden));
  host.querySelector(".sh-plugins-close").addEventListener("click", () => setPlugins(false));
  host.querySelector(".sh-plug-add").addEventListener("click", () => {
    showPlugEditor("New registration", []);
  });
  host.querySelector(".sh-plug-cancel").addEventListener("click", () => {
    plugEditor.hidden = true;
    plugNote.textContent = "";
  });
  plugForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const [name, target_lib, target_ctl, plugin_lib, plugin_ctl, selector] =
      plugFields.map((f) => f.value.trim());
    if (!name || !target_lib || !target_ctl || !plugin_lib || !plugin_ctl || !selector) {
      plugNote.textContent = "all six fields are required";
      return;
    }
    plugNote.textContent = "writing…";
    const r = await setPlugin(name, { target_lib, target_ctl, plugin_lib, plugin_ctl, selector });
    if (r.status !== "ok") {
      plugNote.textContent = `set_plugin failed: ${r.msg}`;
      return;
    }
    plugNote.textContent = "";
    plugEditor.hidden = true;
    toast.show(`set_plugin → ${name} ${r.created ? "registered" : "replaced"} — applies on the next reload`);
    await renderPlugins();
  });
  // the header count, read once at load (the panel re-reads on open)
  if (writable && patchApi) {
    listPlugins().then((entries) => {
      if (!(entries instanceof Error)) plugCount.textContent = String(Object.keys(entries).length);
    });
  }

  // the legend: built once, shown under any library that has controls
  for (const [, label, hue] of FACET_LEGEND) {
    const item = document.createElement("span");
    const dot = document.createElement("i");
    dot.className = "sh-dot";
    dot.style.setProperty("--dot", `var(${hue})`);
    item.append(dot, document.createTextNode(label));
    legendEl.append(item);
  }

  // ── gallery ⇄ library ─────────────────────────────────────
  function setMode(lib) {
    gridEl.hidden = Boolean(lib);
    libEl.hidden = !lib;
    applyFilter();
  }

  function showAll() {
    fanLib = null;
    showPanel(null);
    cardsEl.replaceChildren();
    setMode(null);
  }

  async function showFan(libId) {
    fanLib = libId;
    setMode(libId);
    host.querySelector(".fh-name").textContent = libId;
    host.querySelector(".fh-count").textContent = "";
    showPanel(null);
    cardsEl.replaceChildren();
    cardsEmptyEl.hidden = true;
    legendEl.hidden = true;
    scroller.scrollTop = 0;

    const lib = libs.find((l) => l.id === libId) ?? { id: libId };
    renderLibMeta(lib);
    wireLibMeta(lib);
    wireLibGroups(lib);
    wireLibDelete(lib);
    wireSettings(lib);
    wireAssets(lib);
    wireRebuild(lib);
    wireArchive(lib);
    newCtlName.value = "";
    newCtlNote.textContent = "";

    const controls = await controlsOf(libId);
    if (fanLib !== libId) return;   // navigated on while the index loaded
    if (controls instanceof Error) {
      toast.show(`could not read ${libId}: ${controls.message}`);
      return;
    }
    host.querySelector(".fh-count").textContent = `/ ${countText({}, controls.length)}`;
    const card = libCards.get(libId);
    if (card) card.querySelector(".s-count").textContent = countText(lib, controls.length);
    cardsEmptyEl.hidden = controls.length > 0;
    legendEl.hidden = controls.length === 0;
    // alphabetical: the controls index is in creation order, which tells a
    // reader nothing once a library has more than a handful
    for (const ctl of [...controls].sort((a, b) => a.name.localeCompare(b.name))) {
      if (fanLib !== libId) return;
      const slot = document.createElement("div");
      slot.className = "sh-slot";
      cardsEl.appendChild(slot);
      const ctlCard = await mount("card", slot, {
        name: ctl.name,
        onOpen: () => openControl(libId, ctl.id),
      });
      readRec(libId, ctl.id).then((record) => {
        ctlCard.setRecord(record instanceof Error ? null : record);
      });
      if (writable && patchApi) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "sh-ctl-del";
        del.textContent = "delete";
        del.setAttribute("aria-label", `delete control ${ctl.name}`);
        del.title = "deletes this control with its commands, timers/events "
          + "AND its journal — the timeline is terminal; the canonical "
          + "repo's git history is what remains. A published app's control "
          + "refuses (unpublish first).";
        del.addEventListener("click", async () => {
          if (del.textContent !== "really delete?") {
            del.textContent = "really delete?";
            setTimeout(() => { del.textContent = "delete"; }, 2500);
            return;
          }
          const r = await deleteControl(libId, ctl.name);
          if (r.status !== "ok") {
            toast.show(`delete failed: ${r.msg}`);
            return;
          }
          toast.show(`delete_control → ${ctl.name} removed`
            + ` (${r.deleted_commands ?? 0} commands, ${r.deleted_components ?? 0} timers/events)`);
          await showFan(libId);
        });
        slot.appendChild(del);
      }
    }
  }

  return { showFan, showAll };
}

  return init(ME, ME.DATA || {});
})().catch(function (e) {
  console.log("shelf failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
