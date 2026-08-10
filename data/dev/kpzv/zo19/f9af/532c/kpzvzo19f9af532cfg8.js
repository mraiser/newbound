// jump — global search over libraries and controls. ⌘K focuses, arrows move,
// Enter opens, Escape closes. Controls appear once their library's index is
// loaded (connect prefetches all of them).
//
// DATA: {openLib, openControl}.

var me = this;
var ME = document.getElementById(me.UUID);

var MAX_RESULTS = 12;

var input = ME.querySelector(".j-input");
var pop = ME.querySelector(".j-pop");
var results = [];
var selected = 0;

async function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) return close();
  const { store } = await requireModule("store", "jump");
  await store.ensureConnected();
  const index = await store.searchIndex();
  results = index
    .filter((row) => row.name.toLowerCase().includes(q))
    .sort((a, b) =>
      a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q)
      || a.name.localeCompare(b.name))
    .slice(0, MAX_RESULTS);
  selected = 0;
  render();
}

function render() {
  pop.hidden = false;
  input.setAttribute("aria-expanded", "true");
  if (results.length === 0) {
    pop.innerHTML = `<div class="j-none">nothing on the shelf matches</div>`;
    return;
  }
  pop.replaceChildren(...results.map((row, i) => {
    const btn = document.createElement("button");
    btn.className = "j-row" + (i === selected ? " sel" : "");
    btn.setAttribute("role", "option");
    btn.innerHTML =
      `<span class="j-kind"></span><span class="j-name"></span><span class="j-path"></span>`;
    const kind = btn.querySelector(".j-kind");
    kind.textContent = row.kind;
    kind.classList.add(`k-${row.kind}`);
    btn.querySelector(".j-name").textContent = row.name;
    btn.querySelector(".j-path").textContent = row.kind === "ctl" ? row.lib : "";
    btn.addEventListener("mousedown", (e) => { e.preventDefault(); open(row); });
    return btn;
  }));
}

function open(row) {
  close();
  input.value = "";
  if (row.kind === "lib") ME.DATA.openLib(row.lib);
  else ME.DATA.openControl(row.lib, row.id);
}

function close() {
  pop.hidden = true;
  input.setAttribute("aria-expanded", "false");
  results = [];
}

input.addEventListener("input", () => search(input.value));
input.addEventListener("blur", () => setTimeout(close, 150));
input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { close(); input.blur(); }
  else if (event.key === "ArrowDown") { selected = Math.min(selected + 1, results.length - 1); render(); }
  else if (event.key === "ArrowUp") { selected = Math.max(selected - 1, 0); render(); }
  else if (event.key === "Enter" && results[selected]) open(results[selected]);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault();
    input.focus();
  }
});
