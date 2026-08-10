// chatctx.js — the chat drawer's context registry. Surfaces publish a
// PROVIDER ("what am I looking at"), the drawer snapshots them at send
// time — the bench's answer to the legacy plugin's DOM scraping: no
// selectors, no .cm reach-ins, just the surfaces saying so themselves.
//
// A provider is () => ({ label, fields }) — label is what the drawer's
// include-checkbox says; fields merge into the query context when checked
// (use the legacy control_query key names: lib/ctl/html/css/js/cmdname/…
// so the backend sees the shape it already knows). Return null when the
// surface currently has nothing to offer. Register returns an unregister
// function; surfaces unregister on dispose.

const providers = new Map();

export const chatctx = {
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
      others (an add-on's memory module keys pushed entries on the open
      surface). A direct call, so no snapshot recursion. */
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
