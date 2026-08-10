// viewctx.js — the "what is the user looking at" registry. Surfaces
// publish a PROVIDER; consumers snapshot them on demand — the bench's
// answer to DOM scraping: no selectors, no reach-ins, just the surfaces
// saying so themselves.
//
// A provider is () => ({ label, fields }) — label is what a consumer's
// include-checkbox says; fields merge into the consumer's context when
// included (keys are the surface's own vocabulary: lib/ctl/html/css/js/
// cmdname/…). Return null when the surface currently has nothing to
// offer. Register returns an unregister function; surfaces unregister
// on dispose.
//
// LIBRARY control — headless: defines window.NB_VIEWCTX once (idempotent across
// installs). Consumers list this control as a hidden data-control child
// div and use the global from their ready.

var me = this;
var ME = document.getElementById(me.UUID);

me.ready = function () {
  if (window.NB_VIEWCTX) return;
  window.NB_VIEWCTX = (function () {

const providers = new Map();

const viewctx = {
  register(key, fn) {
    providers.set(key, fn);
    return () => {
      if (providers.get(key) === fn) providers.delete(key);
    };
  },

  unregister(key) {
    providers.delete(key);
  },

  /** One provider's live value by key — for providers that compose on
      others. A direct call, so no snapshot recursion. */
  peek(key) {
    const fn = providers.get(key);
    if (!fn) return null;
    try {
      const v = fn();
      return v && v.label && v.fields ? v : null;
    } catch {
      return null;
    }
  },

  /** [{key, label, fields}] — live values, broken providers skipped. */
  snapshot() {
    const out = [];
    for (const [key, fn] of providers) {
      try {
        const v = fn();
        if (v && v.label && v.fields) out.push({ key, label: v.label, fields: v.fields });
      } catch { /* a surface mid-teardown — skip */ }
    }
    return out;
  },
};

    return { viewctx };
  })();
};
