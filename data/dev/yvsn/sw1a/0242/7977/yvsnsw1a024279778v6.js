// git — the repo control panel over dev.git's registry (runtime/dev/repos.json):
// per-repo status at a glance (porcelain=v2 parsed client-side), local commit,
// fetch/pull/push, the autocommit sweeper on demand, and registry management
// via set_repo/remove_repo. Nothing here touches git except through dev.git's
// no-shell argv engine, so the mode allowlists hold.

var me = this;
var ME = document.getElementById(me.UUID);

var readyP = (async () => {
  const invokeP = (l2, c2, m2, a2) => new Promise((res2) => invokeCommand(l2, c2, m2, a2, res2));
  const git = (m2, a2) => invokeP("dev", "git", m2, a2);
  // dev.git commands return FLAT ({status,out,err,...} IS the envelope);
  // tolerate a `data` ride anyway so a return-type change can't blank the UI
  const unwrap = (env2) => (env2 && env2.data && typeof env2.data === "object") ? env2.data : (env2 ?? {});
  async function runGit(cmd, params) {
    const env = await git(cmd, params);
    const d = unwrap(env);
    return {
      ok: env.status === "ok" && (d.status ?? "ok") === "ok",
      out: String(d.out ?? "").replace(/\s+$/, ""),
      err: String(d.err ?? "").replace(/\s+$/, ""),
      msg: env.msg ?? d.msg ?? "",
    };
  }

  // `git status --porcelain=v2 --branch` → {branch, upstream, ahead, behind,
  // changes, untracked}: # branch.* headers, then one line per entry
  // (1/2/u = tracked change, ? = untracked)
  function parseStatus(out) {
    const s = { branch: "?", upstream: "", ahead: 0, behind: 0, changes: 0, untracked: 0 };
    for (const line of out.split("\n")) {
      if (line.startsWith("# branch.head ")) s.branch = line.slice(14);
      else if (line.startsWith("# branch.upstream ")) s.upstream = line.slice(18);
      else if (line.startsWith("# branch.ab ")) {
        const m = line.match(/\+(\d+) -(\d+)/);
        if (m) { s.ahead = +m[1]; s.behind = +m[2]; }
      } else if (line.startsWith("? ")) s.untracked++;
      else if (/^[12u] /.test(line)) s.changes++;
    }
    return s;
  }

async function init(host, props) {
  const note = host.querySelector(".gp-note");
  const toast = (props && props.toast) || {
    show(t) {
      note.textContent = t;
      setTimeout(() => { if (note.textContent === t) note.textContent = ""; }, 5000);
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
    refresh();
  };

  // ── per-repo status line ──────────────────────────────────
  async function refreshStatus(repo, row) {
    const branchEl = row.querySelector(".r-branch");
    const dirtyEl = row.querySelector(".r-dirty");
    const abEl = row.querySelector(".r-ab");
    const stateEl = row.querySelector(".r-state");
    branchEl.textContent = "…";
    dirtyEl.textContent = "";
    abEl.textContent = "";
    stateEl.textContent = "";
    const r = await runGit("read", {
      repo: repo.name, verb: "status", args: ["--porcelain=v2", "--branch"],
    });
    if (!r.ok) {
      branchEl.textContent = "";
      dirtyEl.textContent = "status failed";
      dirtyEl.className = "r-dirty bad";
      stateEl.textContent = r.err || r.msg;
      return;
    }
    const s = parseStatus(r.out);
    row.dataset.branch = s.branch;
    branchEl.textContent = s.branch;
    const dirty = s.changes + s.untracked;
    dirtyEl.textContent = dirty
      ? `${s.changes} changed · ${s.untracked} untracked` : "clean";
    dirtyEl.className = "r-dirty " + (dirty ? "warn" : "good");
    abEl.textContent = (s.ahead ? `↑${s.ahead} ` : "") + (s.behind ? `↓${s.behind}` : "");
    abEl.title = s.upstream ? `vs ${s.upstream}` : "";
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
          title="autocommit — the 5-minute sweeper stages and commits this repo when dirty; click to toggle">⟳ auto</button>
        <span class="r-branch"></span>
        <span class="r-ab"></span>
        <span class="r-dirty"></span>
        <span class="r-state"></span>
      </div>
      <div class="gp-path"></div>
      <div class="gp-acts">
        <button type="button" class="r-status" title="full porcelain status in the output pane">status</button>
        <button type="button" class="r-store" title="store-aware status — data/ paths named as controls, facets, commands">store</button>
        <button type="button" class="r-cunit" title="stage one control's full store closure (record, facets, commands, impls, journal, index, generated src) and commit it">commit unit…</button>
        <button type="button" class="r-log">log</button>
        <button type="button" class="r-diff">diff</button>
        <button type="button" class="r-commit" title="stages everything (add -A), then commits with your message">commit…</button>
        <button type="button" class="r-fetch">fetch</button>
        <button type="button" class="r-pull" title="fast-forward only — errors rather than merging on divergence">pull</button>
        <button type="button" class="r-push">push</button>
        <button type="button" class="r-branch-new" title="create and switch to a new branch (checkout -b), then publish it upstream (push -u origin) so pull works from the start">branch…</button>
        <button type="button" class="r-publish" title="publish the current branch upstream (push -u origin)">publish</button>
        <button type="button" class="r-merge" title="merge the current branch into master/main and push it upstream (dev.git.merge_to_master)">merge→master</button>
        <button type="button" class="r-abandon" title="abandon the current branch — back to master/main, delete the label; the working tree is kept (dev.git.abandon_branch)">abandon</button>
        <button type="button" class="r-edit" title="load this entry into the register form">edit</button>
        <button type="button" class="r-rm"
          title="unregister from repos.json — the working tree on disk is never touched">remove</button>
      </div>`;
    row.querySelector(".r-name").textContent = repo.name;
    row.querySelector(".r-role").textContent = repo.role ?? "";
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
    row.querySelector(".gp-path").textContent = repo.path ?? "";

    // run one git verb, show its output verbatim, report ok
    async function act(btn, mode, verb, args) {
      btn.disabled = true;
      const r = await runGit(mode, { repo: repo.name, verb, args });
      btn.disabled = false;
      const text = [r.out, r.err && "— stderr —\n" + r.err].filter(Boolean).join("\n")
        || (r.ok ? "(no output)" : r.msg || "failed");
      showOut(`${repo.name} · git ${verb}${args.length ? " " + args.join(" ") : ""}`, text, !r.ok);
      return r.ok;
    }
    row.querySelector(".r-status").onclick = (e) =>
      act(e.target, "read", "status", []);
    row.querySelector(".r-log").onclick = (e) =>
      act(e.target, "read", "log", ["--oneline", "--decorate", "-n", "20"]);
    row.querySelector(".r-diff").onclick = (e) =>
      act(e.target, "read", "diff", ["--stat"]);
    row.querySelector(".r-fetch").onclick = async (e) => {
      if (await act(e.target, "remote_op", "fetch", [])) refreshStatus(repo, row);
    };
    row.querySelector(".r-pull").onclick = async (e) => {
      if (await act(e.target, "remote_op", "pull", [])) refreshStatus(repo, row);
    };
    row.querySelector(".r-push").onclick = async (e) => {
      if (await act(e.target, "remote_op", "push", [])) refreshStatus(repo, row);
    };
    // current branch as last painted by refreshStatus; "?" = status never parsed
    const curBranch = () => {
      const b = row.dataset.branch || "";
      if (!b || b === "?") { toast.show("current branch unknown — refresh first"); return null; }
      return b;
    };
    row.querySelector(".r-branch-new").onclick = async (e) => {
      const name = prompt(`new branch for ${repo.name} (checkout -b, then push -u origin):`);
      if (!name || !name.trim()) return;
      const b = name.trim();
      const btn = e.target;
      btn.disabled = true;
      const co = await runGit("write", { repo: repo.name, verb: "checkout", args: ["-b", b] });
      if (!co.ok) {
        btn.disabled = false;
        showOut(`${repo.name} · git checkout -b ${b}`,
          [co.out, co.err].filter(Boolean).join("\n") || co.msg || "failed", true);
        return;
      }
      // publish immediately so the branch tracks origin from birth — a bare
      // pull on an untracked branch is refused by git (the owner's 2026-09-05
      // failure), so tracking is set by mechanism, not by remembering to.
      const pu = await runGit("remote_op", { repo: repo.name, verb: "push", args: ["-u", "origin", b] });
      btn.disabled = false;
      const lines = [`— checkout -b ${b} —`, co.out, co.err,
        `— push -u origin ${b} —`, pu.out, pu.err, !pu.ok && !pu.out && !pu.err ? pu.msg : ""];
      showOut(`${repo.name} · new branch ${b}`, lines.filter(Boolean).join("\n"), !pu.ok);
      toast.show(pu.ok
        ? `branch ${b} created and published (tracking origin/${b})`
        : `branch ${b} created locally — publish failed; use publish once origin is reachable`);
      refreshStatus(repo, row);
    };
    row.querySelector(".r-publish").onclick = async (e) => {
      const cur = curBranch();
      if (!cur) return;
      if (await act(e.target, "remote_op", "push", ["-u", "origin", cur])) refreshStatus(repo, row);
    };
    row.querySelector(".r-merge").onclick = async (e) => {
      const cur = curBranch();
      if (!cur) return;
      const btn = e.target;
      btn.disabled = true;
      const env = await git("merge_to_master", { repo: repo.name, branch: cur });
      btn.disabled = false;
      const d = unwrap(env);
      const failed = env.status !== "ok" || d.status === "err";
      const lines = [d.msg || env.msg || ""].concat(Array.isArray(d.steps) ? d.steps : []);
      showOut(`${repo.name} · merge ${cur} → default`,
        lines.filter(Boolean).join("\n") || "(no output)", failed);
      if (!failed) toast.show(`merged ${cur} → ${repo.name}'s default and pushed`);
      refreshStatus(repo, row);
    };
    const ab = row.querySelector(".r-abandon");
    ab.onclick = async () => {
      const cur = curBranch();
      if (!cur) return;
      // two-click confirm, the remove button's idiom — this deletes the branch label
      if (ab.textContent !== "really abandon?") {
        ab.textContent = "really abandon?";
        setTimeout(() => { ab.textContent = "abandon"; }, 2500);
        return;
      }
      ab.textContent = "abandon";
      ab.disabled = true;
      const env = await git("abandon_branch", { repo: repo.name, branch: cur, discard: false });
      ab.disabled = false;
      const d = unwrap(env);
      const failed = env.status !== "ok" || d.status === "err";
      showOut(`${repo.name} · abandon ${cur}`, d.msg || env.msg || "(no output)", failed);
      if (!failed) toast.show(`abandoned ${cur} → back on ${d.now_on || "default"}`);
      refreshStatus(repo, row);
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
      if (com.ok) { toast.show(`commit → ${repo.name}`); refreshStatus(repo, row); }
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
      if (d.committed) { toast.show(`commit → ${d.unit}`); refreshStatus(repo, row); }
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
      refresh();
    };

    refreshStatus(repo, row);
    return row;
  }

  // ── the registry (dev.git.repos) ──────────────────────────
  async function refresh() {
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
    rowsEl.replaceChildren(...list.map(renderRow));
  }

  host.querySelector(".gp-refresh").onclick = () => refresh();
  host.querySelector(".gp-sweep").onclick = async (e) => {
    const btn = e.target;
    btn.disabled = true;
    const env = await git("autocommit_sweep", {});
    btn.disabled = false;
    const d = unwrap(env);
    if (env.status !== "ok") { showOut("autocommit sweep", env.msg || "failed", true); return; }
    const lines = [`swept ${d.swept ?? 0} · committed ${d.committed ?? 0}`];
    const results = d.results;
    if (results && typeof results === "object" && Object.keys(results).length) {
      lines.push(JSON.stringify(results, null, 2));
    }
    showOut("autocommit sweep", lines.join("\n"), false);
    refresh();
  };

  await refresh();
  return { refresh };
}

  return init(ME, ME.DATA || {});
})().catch(function (e) {
  console.log("git panel failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
