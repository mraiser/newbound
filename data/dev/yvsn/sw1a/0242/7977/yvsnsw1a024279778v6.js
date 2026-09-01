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
        <span class="r-auto" hidden
          title="autocommit — the 5-minute sweeper stages and commits this repo when dirty">⟳ auto</span>
        <span class="r-branch"></span>
        <span class="r-ab"></span>
        <span class="r-dirty"></span>
        <span class="r-state"></span>
      </div>
      <div class="gp-path"></div>
      <div class="gp-acts">
        <button type="button" class="r-status" title="full porcelain status in the output pane">status</button>
        <button type="button" class="r-log">log</button>
        <button type="button" class="r-diff">diff</button>
        <button type="button" class="r-commit" title="stages everything (add -A), then commits with your message">commit…</button>
        <button type="button" class="r-fetch">fetch</button>
        <button type="button" class="r-pull" title="fast-forward only — errors rather than merging on divergence">pull</button>
        <button type="button" class="r-push">push</button>
        <button type="button" class="r-edit" title="load this entry into the register form">edit</button>
        <button type="button" class="r-rm"
          title="unregister from repos.json — the working tree on disk is never touched">remove</button>
      </div>`;
    row.querySelector(".r-name").textContent = repo.name;
    row.querySelector(".r-role").textContent = repo.role ?? "";
    row.querySelector(".r-auto").hidden = repo.autocommit !== true;
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
