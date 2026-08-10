// editor — the nb_codemirror wrapper's Newbound face (DESIGN §7.2). The only
// file in the workspace allowed to import the vendored CodeMirror bundle.
// Kept deliberately small: mount, get/set source, line highlights, dirty
// notification, read-only toggle. Nothing else.


var me = this;
var ME = document.getElementById(me.UUID);

var readyP = (async () => {
  // the vendored CodeMirror bundle off its real asset URL — page-relative
  // so a tunneled mount (/peer/remote/UUID/local/…) resolves in the tunnel
  const {
    Compartment, Decoration, EditorState, EditorView, HighlightStyle,
    RangeSetBuilder, StateEffect, StateField, css, defaultKeymap, history,
    historyKeymap, highlightSelectionMatches, html, indentWithTab, javascript,
    json, keymap, lineNumbers, searchKeymap, syntaxHighlighting, tags,
  } = await import("../app/asset/dev/vendor/nb_codemirror/cm6.js");

const LANGUAGES = {
  html: () => html(),
  css: () => css(),
  js: () => javascript(),
  json: () => json(),
};

// facet-hue syntax tinting (DESIGN §4.2.4)
const nbHighlight = HighlightStyle.define([
  { tag: tags.tagName, color: "var(--f-html)" },
  { tag: tags.propertyName, color: "var(--text)" },
  { tag: tags.attributeName, color: "var(--f-js)" },
  { tag: [tags.className, tags.labelName], color: "var(--f-css)" },
  { tag: tags.string, color: "#9ec98f" },
  { tag: [tags.keyword, tags.modifier], color: "var(--f-data)" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--f-css)" },
  { tag: tags.comment, color: "var(--text-faint)", fontStyle: "italic" },
  { tag: tags.number, color: "var(--f-3d)" },
]);

const setHighlights = StateEffect.define();
const highlightField = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setHighlights)) {
        const builder = new RangeSetBuilder();
        for (const lineNo of effect.value) {
          if (lineNo >= 1 && lineNo <= tr.state.doc.lines) {
            const line = tr.state.doc.line(lineNo);
            builder.add(line.from, line.from, Decoration.line({ class: "cm-nb-hl" }));
          }
        }
        value = builder.finish();
      }
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// Both flags are needed: readOnly gates commands, editable gates the DOM.
function readOnlyExt(value) {
  return [EditorState.readOnly.of(value), EditorView.editable.of(!value)];
}

function init(host, { language = "html", readOnly = true, onChange, onSave } = {}) {
  const readOnlyConf = new Compartment();
  let suppressChange = false;

  const view = new EditorView({
    parent: host.querySelector(".nb-editor"),
    state: makeState(""),
  });

  function makeState(source) {
    return EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([
          { key: "Mod-s", preventDefault: true, run: () => (onSave?.(), true) },
          ...defaultKeymap,
          ...historyKeymap,
          // CM renders only the viewport into the DOM, so the browser's
          // find-in-page cannot see off-screen text — Mod-F here opens the
          // editor's OWN search panel (whole-document, regex, replace).
          ...searchKeymap,
          indentWithTab,
        ]),
        (LANGUAGES[language] ?? LANGUAGES.html)(),
        syntaxHighlighting(nbHighlight),
        highlightSelectionMatches(),
        highlightField,
        readOnlyConf.of(readOnlyExt(readOnly)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !suppressChange) onChange?.();
        }),
        EditorView.lineWrapping,
      ],
    });
  }

  return {
    setSource(source) {
      suppressChange = true;
      view.setState(makeState(source ?? ""));
      suppressChange = false;
    },
    getValue() {
      return view.state.doc.toString();
    },
    highlight(lineNumbersList) {
      view.dispatch({ effects: setHighlights.of(lineNumbersList ?? []) });
      const first = lineNumbersList?.[0];
      if (first && first <= view.state.doc.lines) {
        view.dispatch({
          effects: EditorView.scrollIntoView(view.state.doc.line(first).from, { y: "center" }),
        });
      }
    },
    setReadOnly(value) {
      view.dispatch({ effects: readOnlyConf.reconfigure(readOnlyExt(value)) });
    },
  };
}

  return init(ME, ME.DATA || {});
})().catch(function (e) {
  console.log("editor failed to start: " + (e && e.message ? e.message : e));
  return null;
});
readyP.then(function (api) { if (api) Object.assign(me, api); });
me.waitReady = function (cb) { readyP.then(function () { cb(me); }); };
