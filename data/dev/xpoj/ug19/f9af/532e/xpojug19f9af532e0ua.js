// session — the notebook drawer: every cell is a command call, outputs stay
// put. Read-listed commands run directly; anything else needs a writable
// connection AND a typed confirmation (DESIGN §5.6's inline pattern).
// Non-modal (DESIGN §5.7): the screen behind stays interactive.
//
// The notebook becomes a chat surface only when a plugin makes it one
// (owner's direction 2026-07-25, as amended 2026-08-10): the notebook
// itself knows NOTHING about any such plugin. It renders cells — command
// cells, chat cells, dividers — runs the confirm ceremonies, and exposes
// one plugin slot (.ss-plugins) carrying a small notebook API; the plugin
// registry (dev.plugins) decides what, if anything, grafts on. Whatever
// mounts there drives the notebook through that API and nothing else.

import { store } from "../../assets/store.js";
import { chatctx } from "../../assets/chatctx.js";

const TRANSCRIPT_KEY = "bench.session";
const TRANSCRIPT_LIMIT = 40;

// Command names that are safe to run without confirmation. Deliberately a
// prefix list, not a guess from behavior — anything not matching is treated
// as mutating.
const READ_PREFIXES = [
  "list", "read", "get", "search", "describe", "lib_info", "check",
  "current", "info", "peers", "libs", "apps", "assets", "asset", "lookup",
];

function isReadListed(cmdName) {
  return READ_PREFIXES.some((p) => cmdName === p || cmdName.startsWith(p + "_"));
}

export function init(host, { toast, onClose }) {
  const root = host.querySelector(".nb-session");
  const cellsEl = host.querySelector(".ss-cells");
  const callInput = host.querySelector(".ss-call");
  const argsInput = host.querySelector(".ss-args");
  const runBtn = host.querySelector(".ss-run");
  const confirmEl = host.querySelector(".ss-confirm");

  host.querySelector(".ss-close").addEventListener("click", () => close());

  // ── sizing: draggable top edge + full-screen toggle ───────
  const HEIGHT_KEY = "bench.session.height";
  const minH = 180;
  const clampH = (h) => Math.min(Math.max(h, minH), window.innerHeight - 40);
  const savedH = Number(localStorage.getItem(HEIGHT_KEY));
  if (savedH) root.style.height = clampH(savedH) + "px";

  const maxBtn = host.querySelector(".ss-max");
  let preMaxHeight = null;
  function setMax(on) {
    root.classList.toggle("max", on);
    maxBtn.setAttribute("aria-pressed", String(on));
    maxBtn.textContent = on ? "◲ shrink" : "◱ full";
    if (on) {
      preMaxHeight = root.style.height || "300px";
      root.style.height = "100dvh";
    } else {
      root.style.height = preMaxHeight ?? "300px";
    }
  }
  maxBtn.addEventListener("click", () => setMax(!root.classList.contains("max")));

  const grip = host.querySelector(".ss-grip");
  grip.addEventListener("pointerdown", (down) => {
    down.preventDefault();
    grip.setPointerCapture(down.pointerId);
    if (root.classList.contains("max")) setMax(false);   // dragging exits full
    const move = (ev) => {
      root.style.height = clampH(window.innerHeight - ev.clientY) + "px";
    };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      localStorage.setItem(HEIGHT_KEY, String(parseInt(root.style.height, 10) || 300));
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
  });

  host.querySelector(".ss-newctx").addEventListener("click", () => {
    const last = readTranscript().at(-1);
    if (last?.kind === "divider") return;   // already fresh
    renderCell(pushTranscript({ kind: "divider" }));
    toast.show("context divider added — conversation context resets here");
  });

  const wipeBtn = host.querySelector(".ss-wipe");
  wipeBtn.addEventListener("click", () => {
    if (wipeBtn.textContent !== "sure?") {
      wipeBtn.textContent = "sure?";
      setTimeout(() => { wipeBtn.textContent = "wipe"; }, 2500);
      return;
    }
    wipeBtn.textContent = "wipe";
    localStorage.removeItem(TRANSCRIPT_KEY);
    cellsEl.replaceChildren();
    toast.show("notebook wiped");
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  function close() {
    root.classList.remove("open");
    onClose?.();
  }

  // ── transcript ────────────────────────────────────────────
  function readTranscript() {
    try {
      return JSON.parse(localStorage.getItem(TRANSCRIPT_KEY)) ?? [];
    } catch {
      return [];
    }
  }

  function pushTranscript(entry) {
    const entries = readTranscript();
    entries.push({ ...entry, n: (entries.at(-1)?.n ?? 0) + 1 });
    localStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(entries.slice(-TRANSCRIPT_LIMIT)));
    return entries.at(-1);
  }

  function renderCell(entry) {
    if (entry.kind === "divider") {
      const div = document.createElement("div");
      div.className = "ss-divider";
      div.textContent = "─── new context ───";
      cellsEl.appendChild(div);
      div.scrollIntoView({ block: "nearest" });
      return div;
    }
    if (entry.kind === "chat-user" || entry.kind === "chat-agent") {
      return renderChatCell(entry);
    }
    const cell = document.createElement("div");
    cell.className = "ss-cell" + (entry.agent ? " ss-agent" : "");
    const input = document.createElement("div");
    input.className = "ss-cell-in";
    input.innerHTML =
      `<span class="ss-gutter"></span><span class="call"></span>` +
      `<span class="args"></span><span class="ms"></span>` +
      `<button class="rerun">run again ▸</button>`;
    input.querySelector(".ss-gutter").textContent =
      entry.agent ? `[${entry.n}·✳]` : `[${entry.n}]`;
    input.querySelector(".call").textContent = entry.call;
    input.querySelector(".args").textContent = entry.args !== "{}" ? entry.args : "";
    input.querySelector(".ms").textContent = entry.ms != null ? `${entry.ms}ms` : "";
    input.querySelector(".rerun").addEventListener("click", () => {
      callInput.value = entry.call;
      argsInput.value = entry.args;
      run();
    });
    const out = document.createElement("div");
    out.className = "ss-cell-out" + (entry.error ? " err" : "");
    out.textContent = entry.output;
    cell.append(input, out);
    cellsEl.appendChild(cell);
    cell.scrollIntoView({ block: "nearest" });
    return cell;
  }

  // ── chat cells ────────────────────────────────────────────
  function renderChatCell(entry) {
    const cell = document.createElement("div");
    cell.className = "ss-cell ss-chat";
    const input = document.createElement("div");
    input.className = "ss-cell-in";
    const who = entry.kind === "chat-user" ? "you ▸" : "agent ▸";
    input.innerHTML = `<span class="ss-gutter"></span><span class="who"></span>`;
    input.querySelector(".ss-gutter").textContent = `[${entry.n}·✳]`;
    input.querySelector(".who").textContent = who;
    const out = document.createElement("div");
    out.className = "ss-cell-out" + (entry.error ? " err" : "");
    if (entry.kind === "chat-agent" && !entry.error) {
      renderReply(out, entry.text);
    } else {
      out.textContent = entry.text;
    }
    cell.append(input, out);
    cellsEl.appendChild(cell);
    cell.scrollIntoView({ block: "nearest" });
    return cell;
  }

  // Reply grammar (the notebook's rich-cell display format): <think> folds
  // behind a chip, ``` fences become code cards; an html/css/js fence offers
  // apply-as-patch — a journaled whole-facet replace (label "chat").
  function renderReply(host, raw) {
    const lines = (raw ?? "").split("\n");
    let think = null;
    let code = null;
    let lang = null;
    let textBuf = [];
    const flushText = () => {
      const t = textBuf.join("\n").trim();
      if (t) host.appendChild(document.createTextNode(t + "\n"));
      textBuf = [];
    };
    for (const line of lines) {
      if (line.startsWith("<think>")) {
        flushText();
        think = [line.slice(7)];
      } else if (line.startsWith("</think>")) {
        const body = (think ?? []).join("\n").trim();
        think = null;
        if (body) {
          const btn = document.createElement("button");
          btn.className = "ss-think-btn";
          btn.textContent = "show thinking ▸";
          const div = document.createElement("div");
          div.className = "ss-think";
          div.hidden = true;
          div.textContent = body;
          btn.addEventListener("click", () => {
            div.hidden = !div.hidden;
            btn.textContent = div.hidden ? "show thinking ▸" : "hide thinking ▾";
          });
          host.append(btn, div);
        }
      } else if (think) {
        think.push(line);
      } else if (line.startsWith("```")) {
        if (code === null) {
          flushText();
          lang = line.slice(3).trim().toLowerCase();
          code = [];
        } else {
          host.appendChild(codeCard(code.join("\n"), lang));
          code = null;
        }
      } else if (code) {
        code.push(line);
      } else {
        textBuf.push(line);
      }
    }
    if (code) host.appendChild(codeCard(code.join("\n"), lang));
    flushText();
  }

  function codeCard(source, lang) {
    const card = document.createElement("div");
    card.className = "ss-code";
    const head = document.createElement("div");
    head.className = "ss-code-head";
    const tag = document.createElement("span");
    tag.className = "langtag";
    tag.textContent = lang || "code";
    head.appendChild(tag);
    const pre = document.createElement("pre");
    pre.hidden = true;
    pre.textContent = source;
    const view = document.createElement("button");
    view.textContent = "view ▸";
    view.addEventListener("click", () => {
      pre.hidden = !pre.hidden;
      view.textContent = pre.hidden ? "view ▸" : "hide ▾";
    });
    head.appendChild(view);
    const wb = chatctx.snapshot().find((p) => p.key === "workbench");
    if (["html", "css", "js"].includes(lang) && store.writable() && wb) {
      const apply = document.createElement("button");
      apply.className = "ss-apply";
      apply.textContent = "apply as patch ▸";
      apply.addEventListener("click", async () => {
        if (apply.textContent === "apply as patch ▸") {
          apply.textContent = `replace whole ${lang} facet of ${wb.fields.ctl}?`;
          setTimeout(() => {
            if (!apply.disabled) apply.textContent = "apply as patch ▸";
          }, 3000);
          return;
        }
        const rf = await store.readFacet(wb.fields.lib, wb.fields.ctl, lang);
        if (rf.status !== "ok") {
          toast.show(`apply failed: ${rf.msg}`);
          return;
        }
        const r = await store.patchFacet(wb.fields.lib, wb.fields.ctl, lang, {
          oldSnippet: "", newSnippet: source.replace(/\r/g, ""),
          base: rf.hash, label: "chat",
        });
        if (r.status !== "ok") {
          toast.show(`apply failed: ${r.msg}`);
          return;
        }
        apply.textContent = `applied · ${r.patch_id}`;
        apply.disabled = true;
        toast.show(`chat → patch_control_facet · ${r.patch_id} — reload the control to see it`);
      });
      head.appendChild(apply);
    }
    card.append(head, pre);
    return card;
  }

  for (const entry of readTranscript()) renderCell(entry);

  // ── running ───────────────────────────────────────────────
  function parseCall(text) {
    const parts = text.trim().split(".");
    if (parts.length !== 3 || parts.some((p) => !p)) return null;
    return { lib: parts[0], ctl: parts[1], cmd: parts[2] };
  }

  async function run() {
    confirmEl.hidden = true;
    const callText = callInput.value.trim();
    const target = parseCall(callText);
    if (!target) {
      toast.show("call format is lib.control.command");
      return;
    }
    let args;
    try {
      args = argsInput.value.trim() ? JSON.parse(argsInput.value) : {};
    } catch {
      toast.show("args must be valid json");
      return;
    }

    if (!isReadListed(target.cmd)) {
      if (!store.writable()) {
        toast.show(`"${target.cmd}" isn't read-listed — needs a writable connection`);
        return;
      }
      const confirmed = await askConfirm(target.cmd);
      if (!confirmed) return;
    }

    const result = await store.invoke(target.lib, target.ctl, target.cmd, args);
    const entryBase = { call: callText, args: JSON.stringify(args) };
    let entry;
    if (result instanceof Error) {
      entry = pushTranscript({ ...entryBase, error: true, output: result.message });
    } else {
      const env = result.envelope;
      // FLAT returns carry fields top-level (no data/msg) — show the envelope
      const payload = env.status === "ok" ? (env.data ?? env.msg ?? env) : env.msg;
      entry = pushTranscript({
        ...entryBase,
        ms: result.ms,
        error: env.status !== "ok",
        output: typeof payload === "string" ? payload : JSON.stringify(payload, null, 1),
      });
    }
    renderCell(entry);
    callInput.value = "";
    argsInput.value = "";
  }

  /** Inline type-the-name confirm (DESIGN §5.6) — resolves true on exact
      match. msg overrides the default caption (a plugin supplies its own). */
  function askConfirm(cmdName, msg) {
    return new Promise((resolve) => {
      confirmEl.hidden = false;
      confirmEl.querySelector(".ss-confirm-msg").textContent = msg ??
        `"${cmdName}" may change data on the connected instance — type the command name to run it:`;
      const input = confirmEl.querySelector(".ss-confirm-input");
      input.value = "";
      input.focus();
      const done = (value) => {
        confirmEl.hidden = true;
        input.onkeydown = null;
        resolve(value);
      };
      input.onkeydown = (event) => {
        if (event.key === "Enter" && input.value === cmdName) done(true);
        else if (event.key === "Escape") done(false);
      };
      confirmEl.querySelector(".ss-confirm-cancel").onclick = () => done(false);
    });
  }

  /** One-press confirm for a command ALREADY typed-confirmed in the same
      exchange — the ceremony proves intent once, then stays out of the way.
      msg overrides the default caption. */
  function askConfirmLite(cmdName, msg) {
    return new Promise((resolve) => {
      confirmEl.hidden = false;
      confirmEl.querySelector(".ss-confirm-msg").textContent = msg ??
        `run "${cmdName}" again:`;
      const input = confirmEl.querySelector(".ss-confirm-input");
      input.value = "run ▸ or Esc";
      input.readOnly = true;
      input.focus();
      const done = (value) => {
        confirmEl.hidden = true;
        input.readOnly = false;
        input.value = "";
        input.onkeydown = null;
        resolve(value);
      };
      input.onkeydown = (event) => {
        if (event.key === "Enter") done(true);
        else if (event.key === "Escape") done(false);
      };
      confirmEl.querySelector(".ss-confirm-cancel").onclick = () => done(false);
    });
  }

  runBtn.addEventListener("click", run);
  argsInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") run();
  });

  // ── the plugin slot ───────────────────────────────────────
  // The notebook knows NOTHING about what grafts onto it (kb doctrine:
  // plugins graft onto things that don't know anything about them). One
  // slot div; the plugin registry (dev.plugins) decides what, if
  // anything, mounts there — and whatever does finds the notebook the
  // STOCK way: walk up the DOM to the first ancestor carrying `.api`,
  // the same convention installControl gives every stock control. No
  // plugin ⇒ the REPL above is the whole notebook.
  const api = {
    open() {
      root.classList.add("open");
      callInput.focus();
    },
    close,
    isOpen() {
      return root.classList.contains("open");
    },
    /** Persist one cell and render it; returns the stored entry. Shapes:
        command cells {call, args, output, ms, error, agent}, chat cells
        {kind:"chat-user"|"chat-agent", text, error}, {kind:"divider"}. */
    pushCell(entry) {
      const stored = pushTranscript(entry);
      renderCell(stored);
      return stored;
    },
    /** The transcript, oldest first (bounded by the notebook's limit). */
    cells: readTranscript,
    /** The typed-command-name confirm ceremony (DESIGN §5.6). */
    confirmTyped: askConfirm,
    /** The one-press re-confirm for an already-typed-confirmed command. */
    confirmLite: askConfirmLite,
    /** An inline busy line beneath the cells — returns {update, remove}. */
    busy(text) {
      const b = document.createElement("div");
      b.className = "ss-busy";
      b.textContent = text;
      cellsEl.appendChild(b);
      return {
        update(t) { b.textContent = t; },
        remove() { b.remove(); },
      };
    },
    toast,
  };
  root.api = api;
  return api;
}
