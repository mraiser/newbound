// session — the notebook drawer: every cell is a command call, outputs stay
// put. Read-listed commands run directly; anything else asks for a typed
// confirmation first. Non-modal: the screen behind stays interactive.
//
// The notebook knows exactly two cell shapes of its own — command cells
// and dividers. A plugin may write cells with a custom `kind` and register
// a renderer for it through the slot api (addRenderer); a custom kind with
// no renderer shows as plain text so nothing is ever silently hidden. The
// notebook carries no knowledge of any particular plugin, cell vocabulary,
// or what a custom cell means.
//
// DATA: {toast, onClose}.

var me = this;
var ME = document.getElementById(me.UUID);

var toast = ME.DATA.toast;

var TRANSCRIPT_KEY = "bench.session";
var TRANSCRIPT_LIMIT = 40;

// Command names that are safe to run without confirmation. Deliberately a
// prefix list, not a guess from behavior — anything not matching is treated
// as mutating.
var READ_PREFIXES = [
  "list", "read", "get", "search", "describe", "lib_info", "check",
  "current", "info", "peers", "libs", "apps", "assets", "asset", "lookup",
];

function isReadListed(cmdName) {
  return READ_PREFIXES.some((p) => cmdName === p || cmdName.startsWith(p + "_"));
}

var root = ME.querySelector(".nb-session");
var cellsEl = ME.querySelector(".ss-cells");
var callInput = ME.querySelector(".ss-call");
var argsInput = ME.querySelector(".ss-args");
var runBtn = ME.querySelector(".ss-run");
var confirmEl = ME.querySelector(".ss-confirm");

ME.querySelector(".ss-close").addEventListener("click", () => close());

// ── sizing: draggable top edge + full-screen toggle ───────
var HEIGHT_KEY = "bench.session.height";
var minH = 180;
var clampH = (h) => Math.min(Math.max(h, minH), window.innerHeight - 40);
var savedH = Number(localStorage.getItem(HEIGHT_KEY));
if (savedH) root.style.height = clampH(savedH) + "px";

var maxBtn = ME.querySelector(".ss-max");
var preMaxHeight = null;
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

var grip = ME.querySelector(".ss-grip");
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

ME.querySelector(".ss-newctx").addEventListener("click", () => {
  const last = readTranscript().at(-1);
  if (last?.kind === "divider") return;   // already fresh
  renderCell(pushTranscript({ kind: "divider" }));
  toast.show("context divider added — conversation context resets here");
});

var wipeBtn = ME.querySelector(".ss-wipe");
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
  ME.DATA.onClose?.();
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

// Renderers for custom cell kinds, registered through the slot api by
// whatever plugin writes those kinds. kind -> (entry) => Element.
var renderers = {};

function renderCell(entry) {
  if (entry.kind === "divider") {
    const div = document.createElement("div");
    div.className = "ss-divider";
    div.textContent = "─── new context ───";
    cellsEl.appendChild(div);
    div.scrollIntoView({ block: "nearest" });
    return div;
  }
  if (entry.kind) {
    const render = renderers[entry.kind];
    if (render) {
      const el = render(entry);
      cellsEl.appendChild(el);
      el.scrollIntoView({ block: "nearest" });
      return el;
    }
    const cell = document.createElement("div");
    cell.className = "ss-cell";
    const out = document.createElement("div");
    out.className = "ss-cell-out" + (entry.error ? " err" : "");
    out.textContent = entry.text ?? JSON.stringify(entry);
    cell.appendChild(out);
    cellsEl.appendChild(cell);
    cell.scrollIntoView({ block: "nearest" });
    return cell;
  }
  // a command cell. `auto` marks cells a plugin ran rather than the user
  // (the stored flag was once named `agent` — accept old transcripts).
  const auto = entry.auto ?? entry.agent;
  const cell = document.createElement("div");
  cell.className = "ss-cell" + (auto ? " ss-auto" : "");
  const input = document.createElement("div");
  input.className = "ss-cell-in";
  input.innerHTML =
    `<span class="ss-gutter"></span><span class="call"></span>` +
    `<span class="args"></span><span class="ms"></span>` +
    `<button class="rerun">run again ▸</button>`;
  input.querySelector(".ss-gutter").textContent =
    auto ? `[${entry.n}·✳]` : `[${entry.n}]`;
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
    const confirmed = await askConfirm(target.cmd);
    if (!confirmed) return;
  }

  const t0 = performance.now();
  const envelope = await new Promise((res) =>
    invokeCommand(target.lib, target.ctl, target.cmd, args, res));
  const result = { envelope, ms: Math.round(performance.now() - t0) };
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
// The notebook knows NOTHING about what grafts onto it (doctrine:
// plugins graft onto things that don't know anything about them). One
// slot div; the plugin registry (dev.plugins) decides what, if
// anything, mounts there — and whatever does finds the notebook the
// STOCK way: walk up the DOM to the first ancestor carrying `.api` —
// which is now this control's own element, no extra wiring. No
// plugin ⇒ the REPL above is the whole notebook.
me.open = function () {
  root.classList.add("open");
  callInput.focus();
};
me.close = close;
me.isOpen = function () {
  return root.classList.contains("open");
};
/** Persist one cell and render it; returns the stored entry. The
    notebook's own shapes: command cells {call, args, output, ms,
    error, auto} and {kind:"divider"}. Any other `kind` is a plugin's
    own; pair it with addRenderer. */
me.pushCell = function (entry) {
  const stored = pushTranscript(entry);
  renderCell(stored);
  return stored;
};
/** The transcript, oldest first (bounded by the notebook's limit). */
me.cells = readTranscript;
/** Register a renderer for a custom cell kind — (entry) => Element —
    and re-render the transcript so earlier cells of that kind pick
    it up. */
me.addRenderer = function (kind, fn) {
  renderers[kind] = fn;
  cellsEl.replaceChildren();
  for (const entry of readTranscript()) renderCell(entry);
};
/** The typed-command-name confirm ceremony (DESIGN §5.6). */
me.confirmTyped = askConfirm;
/** The one-press re-confirm for an already-typed-confirmed command. */
me.confirmLite = askConfirmLite;
/** An inline busy line beneath the cells — returns {update, remove}. */
me.busy = function (text) {
  const b = document.createElement("div");
  b.className = "ss-busy";
  b.textContent = text;
  cellsEl.appendChild(b);
  return {
    update(t) { b.textContent = t; },
    remove() { b.remove(); },
  };
};
me.toast = toast;
