// git — the workflow panel over dev.git's registry (runtime/dev/repos.json).
// One state line per repo from dev.git.repo_state (fetches, then compares the
// branch to its upstream AND to origin/master), and five verbs: start branch
// (start_branch), update from master (update_from_master), merge → master
// (merge_to_master), abandon (abandon_branch), and "more" for the atomic git
// surface. Commit/push are the sweeper's job (autocommit_sweep, 5-minute
// timer) and live under more for repos that keep autocommit off. Nothing here
// touches git except through dev.git's no-shell argv engine.

var me = this;
var ME = document.getElementById(me.UUID);

var readyP = (async () => {
  const invokeP = (l2, c2, m2, a2) => new Promise((res2) => invokeCommand(l2, c2, m2, a2, res2));
  const git = (m2, a2) => invokeP("dev", "git", m2, a2);
  // dev.git commands return FLAT ({status,...} IS the envelope); tolerate a
  // `data` ride anyway so a return-type change can't blank the UI
  const unwrap = (env2) => (env2 && env2.data && typeof env2.data === "object") ? env2.data : (env2 ?? {});
  async function runGit(cmd, params) {
    const env = await git(cmd, params);
    const d = unwrap(env);
    return {
      ok: env.status === "ok" && (d.status ?? "ok") === "ok",
      out: String(d.out ?? "").replace(/\s+$/, ""),
      err: String(d.err ?? "").replace(/\s+$/, ""),
      msg: env.msg ?? d.msg ?? "",
      d,
    };
  }

async function init(host, props) {
  const note = host.querySelector(".gp-note");
  const toast = (props && props.toast) || {
    show(t) {
      note.textContent = t;
      setTimeout(() => { if (note.textContent === t) note.textContent = ""; }, 6000);
    },
  };
  const rowsEl = host.querySelector(".gp-rows");
  const outWrap = host.querySelector(".gp-outwrap");
  host.querySelector(".gp-out-close").onclick = () => { outWrap.hidden = true; };

  function showOut(title, text, failed) {
    host.querySelector(".gp-out-title").textContent = title;
    const pre = host.querySelector(".gp-out");
    pre.textContent = text;
    pre.classList.toggle("failed", !!failed);
    outWrap.hidden = false;
  }
  // a compound command's result as the output pane's text: msg then steps
  function compoundText(r) {
    const d = r.d || {};
    const lines = [d.msg || r.msg || ""];
    if (Array.isArray(d.steps) && d.steps.length) lines.push("— steps —", ...d.steps);
    return lines.filter(Boolean).join("\n") || (r.ok ? "(no output)" : "failed");
  }

  // ── registry form (set_repo; each row's edit refills it) ──
  const addForm = host.querySelector(".gp-add");
  const aName = addForm.querySelector(".gp-a-name");
  const aPath = addForm.querySelector(".gp-a-path");
  const aOrigin = addForm.querySelector(".gp-a-origin");
  const aRole = addForm.querySelector(".gp-a-role");
  const aAuto = addForm.querySelector(".gp-a-auto");
  const aNote = addForm.querySelector(".gp-a-note");

  function openAdd(repo) {
    addForm.hidden = false;
    aName.value = repo ? repo.name : "";
    aPath.value = repo ? (repo.path ?? "") : "";
    aOrigin.value = repo ? (repo.origin ?? "") : "";
    aRole.value = repo ? (repo.role ?? "library") : "library";
    aAuto.checked = repo ? repo.autocommit === true : true;
    aNote.textContent = "";
    aName.focus();
  }
  host.querySelector(".gp-add-open").onclick = () => {
    if (addForm.hidden) openAdd(null);
    else addForm.hidden = true;
  };
  addForm.onsubmit = async (ev) => {
    ev.preventDefault();
    const name = aName.value.trim();
    const path = aPath.value.trim();
    if (!name || !path) { aNote.textContent = "name and path are required"; return; }
    aNote.textContent = "validating (rev-parse) + writing…";
    const env = await git("set_repo", {
      name, path, origin: aOrigin.value.trim(), role: aRole.value,
      autocommit: aAuto.checked, author: "",
    });
    if (env.status !== "ok") { aNote.textContent = `set_repo failed: ${env.msg}`; return; }
    aNote.textContent = "";
    addForm.hidden = true;
    toast.show(`set_repo → ${name}`);
    refresh(false);
  };

  // ── the state line (dev.git.repo_state) ───────────────────
  function chip(text, cls) {
    const s = document.createElement("span");
    s.className = "r-chip " + (cls || "");
    s.textContent = text;
    return s;
  }
  function paintState(row, s) {
    const stateEl = row.querySelector(".r-state");
    const chips = [];
    if (s.detached) chips.push(chip("detached HEAD", "bad"));
    else chips.push(chip(s.branch, "branch"));
    if (s.op) chips.push(chip(`mid-${s.op}`, "bad"));
    if (s.conflicts > 0) chips.push(chip(`${s.conflicts} conflicted`, "bad"));
    chips.push(s.dirty > 0 ? chip(`${s.dirty} uncommitted`, "warn") : chip("clean", "good"));
    if (!s.detached) {
      if (!s.has_origin) chips.push(chip("no origin", "dim"));
      else if (!s.published) chips.push(chip("unpublished", "warn"));
      else {
        if (s.ahead > 0) chips.push(chip(`${s.ahead} to push`, "warn"));
        if (s.behind > 0) chips.push(chip(`${s.behind} behind ${s.upstream}`, "warn"));
        if (!s.ahead && !s.behind) chips.push(chip("pushed", "good"));
      }
      if (s.on_default) chips.push(chip(`on ${s.default} — work belongs on a branch`, "warn"));
      else if (s.base) {
        chips.push(s.ahead_base > 0 ? chip(`${s.ahead_base} not in ${s.default}`, "warn") : chip("nothing to merge", "dim"));
        chips.push(s.behind_base > 0 ? chip(`${s.default} moved +${s.behind_base}`, "warn") : chip(`${s.default} unchanged`, "dim"));
      }
    }
    if (s.has_origin && s.fetch_err) chips.push(chip("fetch failed — as of last fetch", "bad"));
    stateEl.replaceChildren(...chips);
    stateEl.title = s.fetch_err ? `fetch: ${s.fetch_err}` : (s.summary || "");

    // verbs follow the state
    const q = (c) => row.querySelector(c);
    const usable = !s.detached && !s.op;
    q(".r-start").disabled = !!s.op;
    q(".r-start").title = s.op ? `finish the ${s.op} first`
      : "start a new working branch from origin/master and publish it (dev.git.start_branch)";
    q(".r-update").disabled = !(usable && s.needs_update && !s.on_default);
    q(".r-update").title = s.on_default ? "you are on the default branch" : s.needs_update
      ? `merge ${s.base} into ${s.branch} and push (dev.git.update_from_master)`
      : `${s.default || "master"} has nothing new for this branch`;
    q(".r-merge").disabled = !(usable && s.can_merge);
    q(".r-merge").title = s.can_merge ? `merge ${s.branch} into ${s.default} and push it (dev.git.merge_to_master)`
      : s.on_default ? "you are on the default branch"
      : s.dirty > 0 ? "uncommitted changes — let the sweep commit them first"
      : "nothing to merge";
    q(".r-abandon").disabled = !usable || s.on_default;
    q(".r-abandon").title = s.on_default ? "you are on the default branch"
      : "drop this branch and start the next one from master (dev.git.abandon_branch)";
  }
  async function refreshState(repo, row, fetch) {
    const stateEl = row.querySelector(".r-state");
    const errEl = row.querySelector(".r-err");
    stateEl.replaceChildren(chip(fetch ? "fetching…" : "reading…", "dim"));
    errEl.textContent = "";
    const r = await runGit("repo_state", { repo: repo.name, fetch: !!fetch });
    if (!r.ok) {
      stateEl.replaceChildren(chip("state failed", "bad"));
      errEl.textContent = r.msg || r.err;
      row.state = null;
      return;
    }
    row.state = r.d;
    paintState(row, r.d);
  }

  // ── one repo row ──────────────────────────────────────────
  function renderRow(repo) {
    const row = document.createElement("div");
    row.className = "gp-row";
    row.innerHTML = `
      <div class="gp-line">
        <span class="r-name"></span>
        <span class="r-role"></span>
        <button type="button" class="r-auto"
          title="autocommit — the 5-minute sweeper stages, commits and pushes this repo's branch when dirty (never on master/main); click to toggle">⟳ auto</button>
        <span class="r-state"></span>
        <span class="r-err"></span>
      </div>
      <div class="gp-path"></div>
      <div class="gp-acts">
        <button type="button" class="r-verb r-start">start branch…</button>
        <button type="button" class="r-verb r-update">update from master</button>
        <button type="button" class="r-verb r-merge">merge → master</button>
        <button type="button" class="r-verb r-abandon">abandon…</button>
        <button type="button" class="r-more">more ▾</button>
        <span class="gp-more" hidden>
          <button type="button" class="r-status" title="full porcelain status in the output pane">status</button>
          <button type="button" class="r-store" title="store-aware status — data/ paths named as controls, facets, commands">store</button>
          <button type="button" class="r-log">log</button>
          <button type="button" class="r-diff">diff</button>
          <button type="button" class="r-commit" title="stages everything (add -A), then commits with your message — the sweeper does this on autocommit repos">commit…</button>
          <button type="button" class="r-cunit" title="stage one control's full store closure and commit it (dev.git.commit_unit)">commit unit…</button>
          <button type="button" class="r-publish" title="publish the current branch upstream (push -u origin)">publish</button>
          <button type="button" class="r-push" title="push the current branch to its upstream">push</button>
          <button type="button" class="r-fetch" title="fetch --prune">fetch</button>
          <button type="button" class="r-edit" title="load this entry into the register form">edit</button>
          <button type="button" class="r-rm"
            title="unregister from repos.json — the working tree on disk is never touched">remove</button>
        </span>
      </div>`;
    row.querySelector(".r-name").textContent = repo.name;
    row.querySelector(".r-role").textContent = repo.role ?? "";
    row.querySelector(".gp-path").textContent = repo.path ?? "";
    const autoBtn = row.querySelector(".r-auto");
    function paintAuto() {
      autoBtn.textContent = repo.autocommit === true ? "⟳ auto on" : "auto off";
      autoBtn.classList.toggle("on", repo.autocommit === true);
    }
    paintAuto();
    autoBtn.onclick = async () => {
      autoBtn.disabled = true;
      const env = await git("set_autocommit", { name: repo.name, autocommit: repo.autocommit !== true });
      autoBtn.disabled = false;
      const d = unwrap(env);
      if (env.status !== "ok" || d.status === "err") {
        toast.show(`set_autocommit failed: ${env.msg || d.msg || "?"}`);
        return;
      }
      repo.autocommit = d.autocommit === true;
      paintAuto();
      toast.show(`autocommit ${repo.autocommit ? "on" : "off"} → ${repo.name}`);
    };
    const moreEl = row.querySelector(".gp-more");
    const moreBtn = row.querySelector(".r-more");
    moreBtn.onclick = () => {
      moreEl.hidden = !moreEl.hidden;
      moreBtn.textContent = moreEl.hidden ? "more ▾" : "less ▴";
    };

    // current branch as last read by repo_state
    const curBranch = () => {
      const b = row.state && !row.state.detached ? row.state.branch : "";
      if (!b) { toast.show("current branch unknown — refresh first"); return null; }
      return b;
    };
    // run one compound command, show its result, re-read state (already fetched)
    async function compound(btn, cmd, params, title) {
      btn.disabled = true;
      const r = await runGit(cmd, params);
      btn.disabled = false;
      showOut(`${repo.name} · ${title}`, compoundText(r), !r.ok);
      refreshState(repo, row, false);
      return r;
    }

    // ── the five verbs ──
    row.querySelector(".r-start").onclick = async (e) => {
      const s = row.state || {};
      const name = prompt(`new working branch for ${repo.name} — cut from origin/${s.default || "master"} and published:`);
      if (!name || !name.trim()) return;
      const r = await compound(e.target, "start_branch", { repo: repo.name, branch: name.trim() }, `start branch ${name.trim()}`);
      if (r.ok) toast.show(r.d.msg || `on ${name.trim()}`);
    };
    row.querySelector(".r-update").onclick = async (e) => {
      const cur = curBranch();
      if (!cur) return;
      const r = await compound(e.target, "update_from_master", { repo: repo.name, branch: cur }, `update ${cur} from master`);
      if (r.ok) toast.show(r.d.msg || "updated");
    };
    row.querySelector(".r-merge").onclick = async (e) => {
      const cur = curBranch();
      if (!cur) return;
      const s = row.state || {};
      if (!confirm(`Merge ${cur} into ${s.default || "master"} and push it to origin?\n\n${s.ahead_base ?? "?"} commit(s) not yet in ${s.default || "master"}.`)) return;
      const r = await compound(e.target, "merge_to_master", { repo: repo.name, branch: cur }, `merge ${cur} → ${s.default || "master"}`);
      if (r.ok) toast.show(r.d.msg || `merged ${cur}`);
    };
    row.querySelector(".r-abandon").onclick = async (e) => {
      const cur = curBranch();
      if (!cur) return;
      const s = row.state || {};
      const dirty = (s.dirty || 0) > 0 || !!s.op;
      const what = [`Abandon ${cur} in ${repo.name}?`, ""];
      if (dirty) what.push(`${s.dirty || 0} uncommitted change(s)${s.op ? ` and the ${s.op} in progress` : ""} will be THROWN AWAY (reset --hard + clean -fd — new files and store records are deleted).`);
      if (s.ahead_base > 0) what.push(`${s.ahead_base} commit(s) never merged to ${s.default || "master"} stay only on origin/${cur}${s.published ? "" : " — which does not exist: they will be gone"}.`);
      what.push(`The branch label is deleted here; origin's copy is kept as a safety net.`);
      if (!confirm(what.join("\n"))) return;
      const next = prompt(`next working branch (cut from origin/${s.default || "master"}) — empty to just go back to ${s.default || "master"}:`);
      if (next === null) return;
      const r = await compound(e.target, "abandon_branch", {
        repo: repo.name, branch: cur, discard: dirty, delete_remote: false, next_branch: next.trim(),
      }, `abandon ${cur}`);
      if (r.ok) toast.show(r.d.msg || `abandoned ${cur}`);
    };

    // ── more: the atomic git surface ──
    async function act(btn, mode, verb, args) {
      btn.disabled = true;
      const r = await runGit(mode, { repo: repo.name, verb, args });
      btn.disabled = false;
      const text = [r.out, r.err && "— stderr —\n" + r.err].filter(Boolean).join("\n")
        || (r.ok ? "(no output)" : r.msg || "failed");
      showOut(`${repo.name} · git ${verb}${args.length ? " " + args.join(" ") : ""}`, text, !r.ok);
      return r.ok;
    }
    row.querySelector(".r-status").onclick = (e) => act(e.target, "read", "status", []);
    row.querySelector(".r-log").onclick = (e) =>
      act(e.target, "read", "log", ["--oneline", "--decorate", "-n", "20"]);
    row.querySelector(".r-diff").onclick = (e) => act(e.target, "read", "diff", ["--stat"]);
    row.querySelector(".r-fetch").onclick = async (e) => {
      if (await act(e.target, "remote_op", "fetch", ["--prune"])) refreshState(repo, row, false);
    };
    row.querySelector(".r-push").onclick = async (e) => {
      if (await act(e.target, "remote_op", "push", [])) refreshState(repo, row, false);
    };
    row.querySelector(".r-publish").onclick = async (e) => {
      const cur = curBranch();
      if (!cur) return;
      if (await act(e.target, "remote_op", "push", ["-u", "origin", cur])) refreshState(repo, row, false);
    };
    row.querySelector(".r-commit").onclick = async (e) => {
      const msg = prompt(`commit message for ${repo.name} (stages everything first):`);
      if (!msg || !msg.trim()) return;
      const btn = e.target;
      btn.disabled = true;
      const add = await runGit("write", { repo: repo.name, verb: "add", args: ["-A"] });
      if (!add.ok) {
        btn.disabled = false;
        showOut(`${repo.name} · git add -A`, add.err || add.msg || "failed", true);
        return;
      }
      const com = await runGit("write", { repo: repo.name, verb: "commit", args: ["-m", msg.trim()] });
      btn.disabled = false;
      showOut(`${repo.name} · git commit`,
        [com.out, com.err].filter(Boolean).join("\n") || com.msg || "(no output)", !com.ok);
      if (com.ok) { toast.show(`commit → ${repo.name}`); refreshState(repo, row, false); }
    };
    row.querySelector(".r-store").onclick = async (e) => {
      const btn = e.target;
      btn.disabled = true;
      const env = await git("store_status", { repo: repo.name });
      btn.disabled = false;
      const d = unwrap(env);
      if (env.status !== "ok") { showOut(`${repo.name} · store status`, env.msg || "failed", true); return; }
      showOut(`${repo.name} · store status`, d.text || "(clean)", false);
    };
    row.querySelector(".r-cunit").onclick = async (e) => {
      const unit = prompt(`commit unit in ${repo.name} — lib.control (e.g. dev.git):`);
      if (!unit || !unit.includes(".")) return;
      const dot = unit.indexOf(".");
      const msg = prompt(`commit message for ${unit.trim()}:`);
      if (!msg || !msg.trim()) return;
      const btn = e.target;
      btn.disabled = true;
      const env = await git("commit_unit", {
        repo: repo.name, lib: unit.slice(0, dot).trim(), ctl: unit.slice(dot + 1).trim(),
        message: msg.trim(), author: ""
      });
      btn.disabled = false;
      const d = unwrap(env);
      if (env.status !== "ok") { showOut(`${repo.name} · commit unit`, env.msg || "failed", true); return; }
      const lines = [`${d.unit} — staged ${(d.staged || []).length} path(s), committed: ${d.committed}`];
      if (d.out) lines.push(d.out);
      showOut(`${repo.name} · commit unit`, lines.join("\n"), false);
      if (d.committed) { toast.show(`commit → ${d.unit}`); refreshState(repo, row, false); }
    };
    row.querySelector(".r-edit").onclick = () => openAdd(repo);
    const rm = row.querySelector(".r-rm");
    rm.onclick = async () => {
      // two-click confirm, the shelf's fh-del idiom
      if (rm.textContent !== "really remove?") {
        rm.textContent = "really remove?";
        setTimeout(() => { rm.textContent = "remove"; }, 2500);
        return;
      }
      const env = await git("remove_repo", { name: repo.name, author: "" });
      if (env.status !== "ok") {
        rm.textContent = "remove";
        toast.show(`remove failed: ${env.msg}`);
        return;
      }
      toast.show(`remove_repo → ${repo.name} unregistered (the working tree stays on disk)`);
      refresh(false);
    };

    return row;
  }

  // ── the registry (dev.git.repos), then every row's state ──
  async function refresh(fetch) {
    const env = await git("repos", {});
    const d = unwrap(env);
    if (env.status !== "ok") {
      rowsEl.className = "gp-rows gp-empty";
      rowsEl.textContent = `repos failed: ${env.msg}`;
      return;
    }
    const raw = d.repos ?? {};
    const list = Array.isArray(raw)
      ? raw.slice()
      : Object.entries(raw).map(([name, v]) => Object.assign({ name }, v || {}));
    list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    if (!list.length) {
      rowsEl.className = "gp-rows gp-empty";
      rowsEl.textContent = "no repos registered — register one above "
        + "(dev.code.init also registers the checkout and repositories/* clones at boot)";
      return;
    }
    rowsEl.className = "gp-rows";
    const rows = list.map(renderRow);
    rowsEl.replaceChildren(...rows);
    // states in parallel: each row fetches its own origin
    await Promise.all(rows.map((row, i) => refreshState(list[i], row, fetch !== false)));
  }

  host.querySelector(".gp-refresh").onclick = () => refresh(true);
  host.querySelector(".gp-sweep").onclick = async (e) => {
    const btn = e.target;
    btn.disabled = true;
    const env = await git("autocommit_sweep", {});
    btn.disabled = false;
    const d = unwrap(env);
    if (env.status !== "ok") { showOut("sweep", env.msg || "failed", true); return; }
    const lines = [`fetched ${d.fetched ?? 0} · swept ${d.swept ?? 0} · committed ${d.committed ?? 0} · pushed ${d.pushed ?? 0}`];
    const results = Array.isArray(d.results) ? d.results : [];
    for (const r of results) {
      if (!r || r.result === "not_flagged") continue;
      lines.push(`${r.repo}: ${r.branch ? r.branch + " · " : ""}${r.result}${r.paths ? ` (${r.paths} path(s))` : ""}${r.push ? " · " + r.push : ""}${r.err ? " · " + r.err : ""}${r.push_err ? " · " + r.push_err : ""}`);
    }
    showOut("sweep", lines.join("\n"), false);
    refresh(false);
  };

  await refresh(true);
  return { refresh };
}

  return init(ME, ME.DATA || {});
})().catch(function (e) {
  console.log("git panel failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
