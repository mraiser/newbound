// shelf — libraries as stacks of cards, grouped by their `root` value
// verbatim (pure metadata — the platform has no category concept, so the
// shelf invents none; G-2). The fan carries the library's desc/groups meta
// (set_library_meta) and the "Rust settings" panel (dev.libsettings).

import { mountControl } from "../../assets/loader.js";
import { store } from "../../assets/store.js";

export async function init(host, { openLib, openControl, toast }) {
  const groupsEl = host.querySelector(".sh-groups");
  const fanEl = host.querySelector(".sh-fan");
  const cardsEl = host.querySelector(".sh-cards");
  const stackEls = new Map();

  // The library gate, as boot-time meta reports it (readers refresh on
  // restart): anonymous = open (no badge), named groups shown, empty =
  // admin-only. The groups intent string prevails when present — it is what
  // set_groups writes, and the enforced readers are derived from it.
  function renderGate(stack, lib) {
    const el = stack.querySelector(".s-gate");
    if (!el) return;
    const g = (lib.groups ?? (Array.isArray(lib.readers) ? lib.readers.join(",") : "")).trim();
    const open = g.split(",").map((s) => s.trim()).includes("anonymous");
    el.textContent = g ? (open ? "" : `⛨ ${g}`) : "⛨ admin";
    el.title = g ? `security groups: ${g}` : "admin only — no groups granted";
  }

  const libs = await store.libs();
  if (libs instanceof Error) {
    toast.show(`could not list libraries: ${libs.message}`);
    return {};
  }
  const writable = store.writable();
  const patchApi = await store.patchApi();

  const groups = new Map();
  for (const lib of [...libs].sort((a, b) => a.id.localeCompare(b.id))) {
    // The platform's own default: flowlang's get_crate_info treats an absent
    // OR empty `root` as "cmd", so libraries that never set one belong in the
    // cmd group rather than a "?" of their own.
    const root = (lib.root ?? "").trim() || "cmd";
    const label = `root · ${root}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(lib);
  }

  for (const [label, members] of [...groups.entries()].sort()) {
    const group = document.createElement("div");
    group.className = "sh-group";
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = label;
    const grid = document.createElement("div");
    grid.className = "sh-stacks";
    group.append(lbl, grid);
    groupsEl.appendChild(group);

    for (const lib of members) {
      const stack = document.createElement("button");
      stack.className = "sh-stack";
      stack.innerHTML =
        `<span class="s-name"></span><span class="s-gate"></span><span class="s-meta">v${lib.version ?? "?"}</span>`;
      stack.querySelector(".s-name").textContent = lib.id;
      renderGate(stack, lib);
      if (lib.desc) stack.title = lib.desc;
      stack.addEventListener("click", () => openLib(lib.id));
      grid.appendChild(stack);
      stackEls.set(lib.id, stack);

      store.controls(lib.id).then((controls) => {
        if (!(controls instanceof Error)) {
          stack.querySelector(".s-meta").textContent =
            `${controls.length} controls · v${lib.version ?? "?"}`;
        }
      });
    }
  }

  // ── library meta (set_library_meta) ───────────────────────
  function renderLibMeta(lib) {
    const descEl = host.querySelector(".fh-desc");
    descEl.textContent = lib.desc
      || "no description — agents discover this library through desc";
    descEl.classList.toggle("empty", !lib.desc);
    host.querySelector(".fh-tools").hidden = false;
    host.querySelector(".fh-meta-btn").hidden = !(writable && patchApi);
    host.querySelector(".fh-groups-btn").hidden = !(writable && patchApi);
    host.querySelector(".fh-del-btn").hidden = !(writable && patchApi);
    host.querySelector(".fh-rebuild-btn").hidden = !writable;
    host.querySelector(".fh-archive-btn").hidden = store.mode() !== "live";
  }

  // ── library delete (delete_library, CONTRACT §6.1) ────────
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
      const r = await store.deleteLibrary(lib.id);
      if (r.status !== "ok") {
        del.textContent = "delete library";
        toast.show(`delete failed: ${r.msg}`);
        return;
      }
      toast.show(`delete_library → ${lib.id} removed`);
      fanEl.hidden = true;
      stackEls.get(lib.id)?.remove();
      stackEls.delete(lib.id);
      const i = libs.findIndex((l) => l.id === lib.id);
      if (i >= 0) libs.splice(i, 1);
    };
  }

  function wireLibMeta(lib) {
    // desc + TAGS are editable (the 2026-07-31 groups correction); the
    // security-group string is never edited from a meta form.
    const form = host.querySelector(".fh-meta");
    host.querySelector(".fh-meta-btn").onclick = () => {
      form.hidden = !form.hidden;
      if (!form.hidden) {
        form.querySelector(".fm-desc").value = lib.desc ?? "";
        form.querySelector(".fm-tags").value = lib.tags ?? "";
        form.querySelector(".fm-note").textContent = "";
        form.querySelector(".fm-desc").focus();
      }
    };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const note = form.querySelector(".fm-note");
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
        const r = await store.setLibraryMeta(lib.id, dArg, "");
        if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
        lib.desc = dArg;
      }
      if (tChanged) {
        const r = await store.setTags(lib.id, "", "", tagsV);
        if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
        lib.tags = tagsV;
      }
      form.hidden = true;
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
    const btn = host.querySelector(".fh-groups-btn");
    const input = form.querySelector(".fg-input");
    const note = form.querySelector(".fg-note");
    const apply = form.querySelector(".fg-apply");
    btn.onclick = async () => {
      form.hidden = !form.hidden;
      if (!form.hidden) {
        input.value = lib.groups ?? "";
        note.textContent = "";
        apply.textContent = "set groups";
        input.focus();
        const known = await store.securityGroups();
        form.querySelector(".fg-known").textContent =
          known.length ? `known groups: ${known.join(", ")}` : "";
      }
    };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const v = input.value.trim();
      if (v === (lib.groups ?? "").trim()) { note.textContent = "nothing changed"; return; }
      if (!v && apply.textContent !== "really clear? (admin-only)") {
        apply.textContent = "really clear? (admin-only)";
        setTimeout(() => { apply.textContent = "set groups"; }, 2500);
        return;
      }
      const r = await store.setGroups(lib.id, "", "", v);
      if (r.status !== "ok") { note.textContent = `failed: ${r.msg}`; return; }
      lib.groups = v;
      lib.readers = r.readers ?? [];
      const stack = stackEls.get(lib.id);
      if (stack) renderGate(stack, lib);
      form.hidden = true;
      apply.textContent = "set groups";
      toast.show(`set_groups → readers [${(r.readers ?? []).join(", ") || "— admin only"}] — the library gate refreshes on restart`);
    };
  }

  // ── assets (G-1, the P1 agent commands) ───────────────────
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
      const r = await store.listAssets(lib.id);
      if (r.status !== "ok") {
        rowsEl.textContent = `assets need the write API on a live connection — ${r.msg}`;
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
          ren.className = "fa-act";
          ren.textContent = "rename ▸";
          ren.addEventListener("click", async () => {
            const to = prompt(`rename ${a.name} to (relative path):`, a.name);
            if (!to || to === a.name) return;
            const rr = await store.renameAsset(lib.id, a.name, to);
            if (rr.status !== "ok") toast.show(`rename failed: ${rr.msg}`);
            refresh();
          });
          const del = document.createElement("button");
          del.className = "fa-act fa-danger";
          del.textContent = "delete";
          del.addEventListener("click", async () => {
            // two-click confirm, §5.6 spirit without a modal
            if (del.textContent !== "really delete?") {
              del.textContent = "really delete?";
              setTimeout(() => { del.textContent = "delete"; }, 2500);
              return;
            }
            const rr = await store.deleteAsset(lib.id, a.name);
            if (rr.status !== "ok") toast.show(`delete failed: ${rr.msg}`);
            refresh();
          });
          row.append(ren, del);
        }
        return row;
      }));
    }

    host.querySelector(".fh-assets-btn").onclick = () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        form.hidden = !(writable && patchApi);
        refresh();
      }
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
      const r = await store.writeAsset(lib.id, name, tempfile ? "" : content, tempfile);
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
    host.querySelector(".fh-settings-btn").onclick = async () => {
      panel.hidden = !panel.hidden;
      if (panel.hidden) return;
      const got = await store.invoke("dev", "libsettings", "get_library_config", { id: lib.id });
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
      panel.querySelector(".fs-note").textContent = "";
    };
    panel.onsubmit = async (ev) => {
      ev.preventDefault();
      const note = panel.querySelector(".fs-note");
      const types = panel.querySelector(".fs-types").value
        .split(",").map((t) => t.trim()).filter(Boolean);
      const saved = await store.invoke("dev", "libsettings", "save_library_config", {
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
  // Regenerates + recompiles the library's commands from the store. The
  // R-2 gap bar: store edits leave compiled code behind the records until
  // a rebuild or restart, and the bench had no way to ask for one.
  function wireRebuild(lib) {
    const panel = host.querySelector(".fh-rebuild");
    host.querySelector(".fh-rebuild-btn").onclick = () => {
      panel.hidden = !panel.hidden;
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
      const r = await store.invoke("dev", "dev", "rebuild_lib", { lib: lib.id });
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
    host.querySelector(".fh-archive-btn").onclick = async () => {
      panel.hidden = !panel.hidden;
      if (panel.hidden) return;
      const rows = panel.querySelector(".fk-rows");
      const note = panel.querySelector(".fk-note");
      rows.replaceChildren();
      note.textContent = "";
      const got = await store.invoke("dev", "dev", "lib_info", { lib: lib.id });
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
      dl.href = store.appCmdUrl("dev", "lib_archive", { lib: lib.id, version });
      dl.download = `${lib.id}_${version}.zip`;
      rows.append(meta, dl);
    };
  }

  // ── creating controls + libraries (DESIGN's ghost card) ───
  // Same posture as every other bench-initiated write: a writable live
  // connection with saves ON (patchApi), no typed confirm — creating an
  // empty record is additive. add_control/add_library are pre-existing
  // dev.code commands (the installer's own bootstrap path).
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
  let fanLib = null;

  newCtlForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = newCtlName.value.trim();
    const complaint = nameComplaint(name, "control");
    if (complaint) {
      newCtlNote.textContent = complaint;
      return;
    }
    const existing = await store.controls(fanLib);
    if (!(existing instanceof Error) && existing.some((c) => c.name === name)) {
      newCtlNote.textContent = `${fanLib} already has a control named ${name}`;
      return;
    }
    newCtlNote.textContent = "creating…";
    const r = await store.addControl(fanLib, name);
    if (r.status !== "ok") {
      newCtlNote.textContent = `failed: ${r.msg}`;
      return;
    }
    newCtlNote.textContent = "";
    newCtlName.value = "";
    const controls = await store.controls(fanLib);
    const made = controls instanceof Error
      ? null : controls.find((c) => c.name === name);
    toast.show(`add_control → ${fanLib} ▸ ${name} — its facets are empty; type and save to create them`);
    if (made) {
      openControl(fanLib, made.id);   // straight into the new control's bench
    } else {
      await showFan(fanLib);
    }
  });

  const newLibForm = host.querySelector(".sh-newlib");
  const newLibFields = host.querySelector(".sh-newlib-fields");
  const newLibName = host.querySelector(".sh-newlib-name");
  const newLibNote = host.querySelector(".sh-newlib-note");
  newLibForm.hidden = !(writable && patchApi);
  host.querySelector(".sh-newlib-open").addEventListener("click", () => {
    newLibFields.hidden = !newLibFields.hidden;
    newLibNote.textContent = "";
    if (!newLibFields.hidden) newLibName.focus();
  });

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
    const r = await store.addLibrary(name);
    if (r.status !== "ok") {
      newLibNote.textContent = `failed: ${r.msg}`;
      return;
    }
    newLibNote.textContent = "";
    newLibName.value = "";
    newLibFields.hidden = true;
    toast.show(`add_library → ${name} — reload to see it on the shelf, or add a control now`);
    await showFan(name);
  });

  // ── import from git (dev.github — the ported panel; R-2) ──
  // A git url becomes a library: the platform clones and builds it. A
  // DEVELOPMENT act — git is development-only; distribution to peers is
  // the archive path on each library's fan.
  const importForm = host.querySelector(".sh-import");
  const importFields = host.querySelector(".sh-import-fields");
  const importList = host.querySelector(".sh-import-list");
  importForm.hidden = !(writable && patchApi);
  host.querySelector(".sh-import-open").addEventListener("click", async () => {
    importFields.hidden = !importFields.hidden;
    host.querySelector(".sh-import-note").textContent = "";
    if (importFields.hidden) { importList.hidden = true; return; }
    host.querySelector(".sh-import-url").focus();
    const got = await store.invoke("dev", "github", "list", {});
    if (!(got instanceof Error) && got.envelope.status === "ok") {
      const data = got.envelope.data ?? {};
      const names = Array.isArray(data) ? data
        : Array.isArray(data.list) ? data.list : Object.keys(data);
      importList.hidden = names.length === 0;
      importList.textContent = names.length
        ? "from git already: " + names.map((x) =>
            typeof x === "string" ? x : x.id ?? x.name ?? JSON.stringify(x)).join(", ")
        : "";
    }
  });
  importForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const url = host.querySelector(".sh-import-url").value.trim();
    const note = host.querySelector(".sh-import-note");
    if (!url) { note.textContent = "paste a git url"; return; }
    note.textContent = "cloning + building on the instance…";
    const r = await store.invoke("dev", "github", "import", { url });
    if (r instanceof Error || r.envelope.status !== "ok") {
      note.textContent = `import failed: ${
        r instanceof Error ? r.message : r.envelope.msg}`;
      return;
    }
    // String return: the result rides `msg`, ok status either way — the
    // ERROR prefix is the honest failure signal to relay verbatim.
    const text = r.envelope.msg ?? "";
    if (/^ERROR/.test(text) || !text) {
      note.textContent = text || "import returned nothing";
      return;
    }
    note.textContent = text + " — reload to see it on the shelf";
    store.invalidateLibs();
    toast.show("github.import → " + (url.split("/").pop() || url));
  });

  // ── plugin registrations (dev.plugins + the CONTRACT §6.7 setters) ──
  // The per-instance plugins.json edited in place: when TARGET is on a
  // page, PLUGIN mounts at SELECTOR. Instance-level like git import, so
  // it lives on the shelf header; entries apply on the next reload.
  const plugForm = host.querySelector(".sh-plugins");
  const plugPanel = host.querySelector(".sh-plugins-panel");
  const plugList = host.querySelector(".sh-plugins-list");
  const plugNote = host.querySelector(".sh-plugins-note");
  plugForm.hidden = !(writable && patchApi);
  const plugFields = ["name", "tlib", "tctl", "plib", "pctl", "sel"].map(
    (k) => host.querySelector(".sh-plug-" + k));
  async function renderPlugins() {
    const entries = await store.listPlugins();
    plugList.replaceChildren();
    if (entries instanceof Error) {
      plugNote.textContent = `list_plugins failed: ${entries.message}`;
      return;
    }
    const names = Object.keys(entries).sort();
    if (!names.length) {
      plugList.textContent = "no registrations on this instance";
      return;
    }
    for (const n of names) {
      const e = entries[n] ?? {};
      const row = document.createElement("div");
      row.className = "sh-plug-row";
      const label = document.createElement("span");
      label.textContent = n;
      const what = document.createElement("code");
      what.textContent =
        `${e.plugin_lib}.${e.plugin_ctl} → ${e.target_lib}.${e.target_ctl} at ${e.selector}`;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "edit";
      edit.addEventListener("click", () => {
        const vals = [n, e.target_lib, e.target_ctl, e.plugin_lib, e.plugin_ctl, e.selector];
        plugFields.forEach((f, i) => { f.value = vals[i] ?? ""; });
        plugFields[0].focus();
      });
      const rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "✕";
      rm.addEventListener("click", async () => {
        // two-click confirm, the fh-del idiom
        if (rm.textContent !== "really remove?") {
          rm.textContent = "really remove?";
          setTimeout(() => { rm.textContent = "✕"; }, 2500);
          return;
        }
        const r = await store.removePlugin(n);
        if (r.status !== "ok") {
          plugNote.textContent = `remove failed: ${r.msg}`;
          return;
        }
        toast.show(`remove_plugin → ${n} — applies on the next reload`);
        await renderPlugins();
      });
      row.append(label, what, edit, rm);
      plugList.append(row);
    }
  }
  host.querySelector(".sh-plugins-open").addEventListener("click", async () => {
    plugPanel.hidden = !plugPanel.hidden;
    plugNote.textContent = "";
    if (!plugPanel.hidden) await renderPlugins();
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
    const r = await store.setPlugin(name, { target_lib, target_ctl, plugin_lib, plugin_ctl, selector });
    if (r.status !== "ok") {
      plugNote.textContent = `set_plugin failed: ${r.msg}`;
      return;
    }
    plugNote.textContent = "";
    toast.show(`set_plugin → ${name} ${r.created ? "registered" : "replaced"} — applies on the next reload`);
    await renderPlugins();
  });

  async function showFan(libId) {
    fanLib = libId;
    for (const [id, el] of stackEls) el.classList.toggle("on", id === libId);
    fanEl.hidden = false;
    host.querySelector(".fh-name").textContent = libId;
    host.querySelector(".fh-meta").hidden = true;
    host.querySelector(".fh-groups").hidden = true;
    host.querySelector(".fh-settings").hidden = true;
    host.querySelector(".fh-assets").hidden = true;
    host.querySelector(".fh-rebuild").hidden = true;
    host.querySelector(".fh-archive").hidden = true;
    cardsEl.replaceChildren();

    const lib = libs.find((l) => l.id === libId) ?? { id: libId };
    renderLibMeta(lib);
    wireLibMeta(lib);
    wireLibGroups(lib);
    wireLibDelete(lib);
    wireSettings(lib);
    wireAssets(lib);
    wireRebuild(lib);
    wireArchive(lib);

    newCtlForm.hidden = !(writable && patchApi);
    newCtlNote.textContent = "";

    const controls = await store.controls(libId);
    if (controls instanceof Error) {
      toast.show(`could not read ${libId}: ${controls.message}`);
      return;
    }
    const stack = stackEls.get(libId);
    if (stack) {
      stack.querySelector(".s-meta").textContent =
        `${controls.length} controls · v${lib.version ?? "?"}`;
    }
    // alphabetical: the controls index is in creation order, which tells a
    // reader nothing once a library has more than a handful
    for (const ctl of [...controls].sort((a, b) => a.name.localeCompare(b.name))) {
      const slot = document.createElement("div");
      slot.className = "sh-slot";
      cardsEl.appendChild(slot);
      const card = await mountControl("card", slot, {
        name: ctl.name,
        onOpen: () => openControl(libId, ctl.id),
      });
      store.control(libId, ctl.id).then((record) => {
        card.setRecord(record instanceof Error ? null : record);
      });
      if (writable && patchApi) {
        const del = document.createElement("button");
        del.className = "sh-ctl-del";
        del.textContent = "delete";
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
          const r = await store.deleteControl(libId, ctl.name);
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
    fanEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return { showFan };
}
