// session — the notebook drawer: every cell is a command call, outputs stay
// put. Read-listed commands run directly; anything else needs a writable
// connection AND a typed confirmation (DESIGN §5.6's inline pattern).
// Non-modal (DESIGN §5.7): the screen behind stays interactive.
//
// The notebook is ALSO the chat surface (owner's direction, 2026-07-25 —
// replacing the agentchat drawer): a plain-language ask becomes a user
// cell, the agent answers through the ask-provider module (which owns the
// system prompt, context fences, the tool loop, and its own backend
// wiring), and every tool call the agent makes lands HERE as a cell —
// read-listed ones run directly, mutating ones stop at the same typed
// confirm the user's own cells do. The notebook's recent cells are the
// agent's conversational memory.

import { store } from "../../assets/store.js";
import { chatctx } from "../../assets/chatctx.js";

// The notebook seam (great-refactoring.md, R-1): the console is dev's own;
// the ask row PLUGS IN through the ASK-PROVIDER SOCKET — an optional
// module named `ask`. The session names no providing library: any add-on
// that registers a plugin whose cluster installs an `ask` module control
// fills the socket (the agent add-on does). Availability is known from
// the boot's module graph, so a platform without a provider skips the
// import — no probe fetch, no console noise.
// agent === null ⇒ the ask machinery never wires and its strips are
// removed at init; the notebook is still a full REPL.
const agent = await (async () => {
  const P = globalThis.__benchPlatform ?? null;
  if (P && !P.moduleUrls["assets/ask.js"]) return null;
  try {
    return await import("../../assets/ask.js");
  } catch (e) {
    console.warn("no ask provider — the notebook stays a REPL", e);
    return null;
  }
})();

const TRANSCRIPT_KEY = "bench.session";
const TRANSCRIPT_LIMIT = 40;
const PINS_KEY = "bench.chat.pins";   // {add:[], remove:[]} vs DEFAULT_TOOLS
const HISTORY_CELLS = 12;   // notebook cells folded into the agent's context

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
    toast.show("context divider added — the agent's memory starts here");
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
      div.textContent = "─── new context — the agent's memory starts here ───";
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

  const stripThink = (t) => t.replace(/<think>[\s\S]*?<\/think>\n?/g, "").trim();

  // Reply grammar (shared with the legacy popup): <think> folds behind a
  // chip, ``` fences become code cards; an html/css/js fence offers
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

  /** Inline type-the-name confirm (DESIGN §5.6) — resolves true on exact match. */
  function askConfirm(cmdName) {
    return new Promise((resolve) => {
      confirmEl.hidden = false;
      confirmEl.querySelector(".ss-confirm-msg").textContent =
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

  runBtn.addEventListener("click", run);
  argsInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") run();
  });

  // ── the agent (ask ▸): chat_llm driven from the notebook ──
  // The seam: no agent lib ⇒ the ask strips leave the DOM here and none of
  // the machinery below is wired — the REPL above is the whole notebook.
  if (!agent) {
    host.querySelector(".ss-chatrow").remove();
    host.querySelector(".ss-ctx").remove();
    host.querySelector(".ss-toolpick").remove();
  }
  const askInput = host.querySelector(".ss-ask");
  const sendBtn = host.querySelector(".ss-send");
  const ctxRows = host.querySelector(".ss-ctx-rows");
  const toolPick = host.querySelector(".ss-toolpick");
  const toolList = host.querySelector(".ss-toollist");
  const ctxChecked = new Map();
  let mcpTools = null;

  function renderContextRows() {
    const snap = chatctx.snapshot();
    ctxRows.replaceChildren(...snap.map(({ key, label }) => {
      const l = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = ctxChecked.get(key) ?? true;
      cb.addEventListener("change", () => ctxChecked.set(key, cb.checked));
      l.append(cb, document.createTextNode(label));
      return l;
    }));
    if (snap.length === 0) {
      const none = document.createElement("span");
      none.className = "none";
      none.textContent = "nothing open";
      ctxRows.appendChild(none);
    }
  }

  // Pins are OVERRIDES against DEFAULT_TOOLS: attachment is a context
  // optimization, not permission — every command stays reachable through
  // call_command, gated identically at use time.
  function pins() {
    try {
      const p = JSON.parse(localStorage.getItem(PINS_KEY)) ?? {};
      return { add: p.add ?? [], remove: p.remove ?? [] };
    } catch {
      return { add: [], remove: [] };
    }
  }

  function attachedNames() {
    const { add, remove } = pins();
    const catalogNames = new Set((mcpTools ?? []).map((t) => t.name));
    return [...new Set([...agent.DEFAULT_TOOLS, ...add])]
      .filter((n) => !remove.includes(n) && (mcpTools === null || catalogNames.has(n)));
  }

  const toolsBtn = host.querySelector(".ss-tools");
  function updateToolsBtn() {
    toolsBtn.textContent = `tools ▸ (${attachedNames().length} attached · all discoverable)`;
  }
  if (agent) updateToolsBtn();

  async function ensureCatalog() {
    if (mcpTools !== null) return mcpTools;
    const r = await agent.listTools();
    mcpTools = r.status === "ok" ? (r.tools ?? []) : [];
    updateToolsBtn();   // the count means defaults ∩ catalog once known
    return mcpTools;
  }

  async function renderTools() {
    await ensureCatalog();
    const attached = new Set(attachedNames());
    toolList.replaceChildren(...(mcpTools ?? []).map((tool) => {
      const l = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = attached.has(tool.name);
      cb.addEventListener("change", () => {
        const p = pins();
        const isDefault = agent.DEFAULT_TOOLS.includes(tool.name);
        if (cb.checked) {
          p.remove = p.remove.filter((n) => n !== tool.name);
          if (!isDefault && !p.add.includes(tool.name)) p.add.push(tool.name);
        } else {
          p.add = p.add.filter((n) => n !== tool.name);
          if (isDefault && !p.remove.includes(tool.name)) p.remove.push(tool.name);
        }
        localStorage.setItem(PINS_KEY, JSON.stringify(p));
        updateToolsBtn();
      });
      const nm = document.createElement("span");
      nm.textContent = tool.name;
      const gate = document.createElement("span");
      gate.className = "tgate " + (agent.gateFor(tool.name, tool) === "auto" ? "g-auto" : "g-confirm");
      gate.textContent = agent.gateFor(tool.name, tool) === "auto" ? "auto" : "confirm";
      const desc = document.createElement("span");
      desc.className = "tdesc";
      desc.textContent = tool.description ?? "";
      l.append(cb, nm, gate, desc);
      return l;
    }));
  }

  if (agent) toolsBtn.addEventListener("click", async (e) => {
    toolPick.hidden = !toolPick.hidden;
    e.currentTarget.setAttribute("aria-pressed", String(!toolPick.hidden));
    if (!toolPick.hidden && mcpTools === null) await renderTools();
  });

  /** One-click confirm for a mutating command ALREADY typed-confirmed in
      this ask — the ceremony proves intent once, then stays out of the way
      (a compile-debug loop may patch five times). */
  function askConfirmLite(cmdName) {
    return new Promise((resolve) => {
      confirmEl.hidden = false;
      confirmEl.querySelector(".ss-confirm-msg").textContent =
        `the agent wants to run "${cmdName}" again in this ask:`;
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

  let askConfirmed = new Set();   // commands typed-confirmed in the current ask

  function toolCell(callText, args, extra) {
    renderCell(pushTranscript({ agent: true, call: callText,
      args: JSON.stringify(args), ...extra }));
  }

  /** The agent's tool executor: a visible, gated notebook cell. Handles
      the always-attached meta-tools (find_tools/describe_tool/call_command)
      client-side; everything else is a platform command, gated per call. */
  async function execTool(call) {
    let args = {};
    try {
      args = call.arguments ? JSON.parse(call.arguments) : {};
    } catch { /* leave {} — the cell shows the raw string below */ }

    if (call.name === "find_tools") {
      const catalog = await ensureCatalog();
      const hits = agent.searchCatalog(catalog, args.query ?? "");
      toolCell("✳ find_tools", args, {
        output: hits.length
          ? hits.map((h) => `${h.name} [${h.gate}] — ${h.summary}`).join("\n")
          : "no matches",
      });
      return hits.length
        ? JSON.stringify(hits)
        : "No commands matched. Try different keywords, or list_commands on a likely control.";
    }
    if (call.name === "describe_tool") {
      const catalog = await ensureCatalog();
      const entry = catalog.find((t) => t.name === args.name);
      toolCell("✳ describe_tool", args, {
        output: entry ? `${entry.name} [${agent.gateFor(entry.name, entry)}]` : "unknown tool",
        error: !entry,
      });
      return entry
        ? JSON.stringify({ ...entry, gate: agent.gateFor(entry.name, entry) })
        : `Unknown tool "${args.name}" — use find_tools to search the catalog.`;
    }

    let name = call.name;
    if (call.name === "call_command") {
      name = args.name;
      args = (args.args && typeof args.args === "object") ? args.args : {};
      const catalog = await ensureCatalog();
      const entry = catalog.find((t) => t.name === name);
      if (!entry) {
        toolCell("✳ call_command", { name }, { error: true, output: "unknown tool" });
        return `Unknown tool "${name}" — use find_tools to search the catalog.`;
      }
      const complaints = agent.schemaComplaints(entry.inputSchema, args);
      if (complaints) {
        toolCell("✳ call_command", { name, args }, { error: true,
          output: `arguments rejected: ${complaints}` });
        return `ARGUMENTS REJECTED for ${name}: ${complaints}. Fix and call again.`;
      }
    }

    const target = agent.parseToolName(name);
    if (!target) {
      return `ERROR: tool name "${name}" is not lib-ctl-cmd shaped`;
    }
    const callText = `${target.lib}.${target.ctl}.${target.cmd}`;
    const catalog = await ensureCatalog();
    const entry = catalog.find((t) => t.name === name);
    if (agent.gateFor(name, entry) !== "auto") {
      if (!store.writable()) {
        toolCell(callText, args, { error: true,
          output: "blocked: mutating tool on a read-only connection" });
        return "BLOCKED: this connection is read-only; mutating tools are unavailable.";
      }
      const confirmed = askConfirmed.has(target.cmd)
        ? await askConfirmLite(target.cmd)
        : await askConfirm(target.cmd);
      if (!confirmed) {
        toolCell(callText, args, { error: true,
          output: "denied by the user" });
        return "DENIED: the user declined this action. Continue without it.";
      }
      askConfirmed.add(target.cmd);
    }
    const result = await store.invoke(target.lib, target.ctl, target.cmd, args);
    let entryOut;
    let content;
    if (result instanceof Error) {
      entryOut = { error: true, output: result.message };
      content = `ERROR: ${result.message}`;
    } else {
      const env = result.envelope;
      const payload = env.status === "ok" ? (env.data ?? env.msg ?? env) : env.msg;
      const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 1);
      entryOut = { ms: result.ms, error: env.status !== "ok", output: text };
      content = env.status === "ok" ? agent.clamp(text, 4000) : `ERROR: ${env.msg}`;
    }
    toolCell(callText, args, entryOut);
    return content;
  }

  /** Prior notebook cells, compacted for the agent's memory. History
      stops at the newest "new context" divider (the record survives; the
      memory resets), and error turns never feed it — a failed answer
      re-anchoring the next one is how a session poisons itself. */
  function historyMessages() {
    let cells = readTranscript();
    const lastDivider = cells.findLastIndex((e) => e.kind === "divider");
    if (lastDivider >= 0) cells = cells.slice(lastDivider + 1);
    cells = cells.slice(-HISTORY_CELLS);
    const messages = [];
    const activity = [];
    for (const e of cells) {
      if (e.error) {
        continue;
      } else if (e.kind === "chat-user") {
        messages.push({ role: "user", content: e.text });
      } else if (e.kind === "chat-agent") {
        messages.push({ role: "assistant", content: stripThink(e.text ?? "") });
      } else {
        activity.push(`· [${e.n}]${e.agent ? " (you ran)" : ""} ${e.call}(${e.args}) → ` +
          (e.error ? "err: " : "ok: ") + agent.clamp(e.output ?? "", 700));
      }
    }
    return { messages, activity };
  }

  async function ask() {
    const message = askInput.value.trim();
    if (!message) return;
    if (store.mode() !== "live") {
      toast.show("the agent needs a live connection (agent.llm on the instance)");
      return;
    }
    askInput.value = "";
    sendBtn.disabled = true;
    // history BEFORE the new cell lands, or this question shows up twice
    const { messages: turns, activity } = historyMessages();
    renderCell(pushTranscript({ kind: "chat-user", text: message }));
    const busy = document.createElement("div");
    busy.className = "ss-busy";
    busy.textContent = "agent is thinking…";
    cellsEl.appendChild(busy);

    try {
      const included = chatctx.snapshot().filter((p) => ctxChecked.get(p.key) ?? true);
      let ctxMsg = agent.contextBlock(included);
      if (activity.length) {
        // The first live run drew a confident wrong conclusion from a
        // truncated result — the header now says so up front.
        ctxMsg += (ctxMsg ? "\n\n" : "") +
          "Recent notebook activity (outputs truncated — never conclude " +
          "something is absent from a truncated result; rerun the command " +
          "via a tool for the full output):\n" + activity.join("\n");
      }
      const catalog = await ensureCatalog();
      askConfirmed = new Set();   // typed-confirm ceremony resets per ask
      const tools = [...agent.META_TOOL_DEFS, ...agent.toolDefs(catalog, attachedNames())];
      const addendum = (agent.ADDENDUM ?? "").trim();
      const messages = [{ role: "system",
        content: (await agent.corePrompt()) + "\n\n" +
          agent.SYSTEM_PROMPT + agent.TOOLS_PROMPT +
          (addendum ? "\n\nOWNER ADDENDUM\n" + addendum : "") }];
      if (ctxMsg) {
        messages.push({ role: "user",
          content: "[CONTEXT — what the user is looking at]\n\n" + ctxMsg });
      }
      messages.push(...turns, { role: "user", content: message });

      const text = await agent.chatTurn({
        messages,
        tools,
        execTool,
        onRound: () => { busy.textContent = "agent is using tools…"; },
      });
      busy.remove();
      renderCell(pushTranscript({ kind: "chat-agent", text }));
      // the provider's turn intake (the archivist) — fire-and-forget
      agent.logTurn?.({
        venue: "notebook",
        ask: message.slice(0, 4000),
        reply: (text ?? "").slice(0, 4000),
        tools: "",
        author: "notebook",
      })?.catch?.(() => {});
    } catch (e) {
      busy.remove();
      let text = `error: ${e.message || "the request failed (see the instance console)"}`;
      // the provider knows its own configuration story — let it annotate
      const hint = agent.errorHint?.(e.message ?? "") ?? "";
      if (hint) text += "\n\n" + hint;
      renderCell(pushTranscript({ kind: "chat-agent", error: true, text }));
    }
    sendBtn.disabled = false;
    askInput.focus();
  }

  if (agent) {
    sendBtn.addEventListener("click", ask);
    askInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        ask();
      }
    });
  }

  return {
    open() {
      root.classList.add("open");
      if (agent) renderContextRows();
      callInput.focus();
    },
    close,
    isOpen() {
      return root.classList.contains("open");
    },
  };
}
