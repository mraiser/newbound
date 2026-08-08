// nb.mjs — the only module in this workspace that knows the Newbound wire
// protocol. Everything else calls through a client object. Protocol facts and
// their verification status live in ../CONTRACT.md; keep the two in sync.

/** True when an envelope reports success (CONTRACT §1.3). */
export function ok(envelope) {
  return envelope && envelope.status === "ok";
}

/** Payload of a successful envelope: `data` normally, `msg` for String returns. */
export function payload(envelope) {
  return "data" in envelope ? envelope.data : envelope.msg;
}

/** Live client: HTTP GET command calls per CONTRACT §1.2. */
export class NewboundClient {
  constructor({ baseUrl, sessionid }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.sessionid = sessionid;
  }

  /** Call `{app}/{command}` with named params. Returns the response envelope.
      Network/HTTP failures return an err envelope rather than throwing, so
      callers handle exactly one shape. */
  async call(app, command, params = {}) {
    // Two wire facts (CONTRACT §1.1–1.2): the session travels as the
    // `session_id` query param (underscore; the server never reads a
    // `sessionid` param, and cross-origin fetch can't set the cookie), and
    // values must be PERCENT-encoded — the server does not decode `+` as a
    // space, so URLSearchParams-style form encoding corrupts payloads.
    // An EMPTY session_id param would override the cookie server-side, so it
    // is omitted when unset — same-origin platform mode rides the cookie.
    const pairs = [
      ...(this.sessionid ? [["session_id", this.sessionid]] : []),
      ...Object.entries(params),
    ];
    const query = pairs
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(
        typeof value === "object" ? JSON.stringify(value) : String(value))}`)
      .join("&");
    try {
      const res = await fetch(`${this.baseUrl}/${app}/${command}?${query}`);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return { status: "err", msg: `Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}` };
      }
    } catch (e) {
      return { status: "err", msg: `Network error: ${e.message}` };
    }
  }

  libs() {
    return this.call("app", "libs");
  }

  read(lib, id) {
    return this.call("app", "read", { lib, id });
  }

  /** Invoke an arbitrary command by ctldb + command id (CONTRACT §2.3). */
  exec(lib, id, args = {}) {
    return this.call("app", "exec", { lib, id, args });
  }

  currentUser() {
    return this.call("security", "current_user");
  }
}

/** Mock client: serves recorded fixtures. Keys are `${app}/${command}` plus
    the params that distinguish calls (CONTRACT fixtures format). */
export class MockClient {
  constructor(fixtures) {
    this.byKey = new Map();
    for (const fx of fixtures) {
      this.byKey.set(fixtureKey(fx.meta.call, fx.meta.params), fx);
    }
  }

  static async load(baseHref = "fixtures/") {
    const manifest = await (await fetch(baseHref + "manifest.json")).json();
    const fixtures = await Promise.all(
      manifest.fixtures.map(async (name) => (await fetch(baseHref + name)).json()),
    );
    return new MockClient(fixtures);
  }

  async call(app, command, params = {}) {
    const fx = this.byKey.get(fixtureKey(`${app}/${command}`, params));
    if (!fx) {
      return { status: "err", msg: `No fixture for ${app}/${command} ${JSON.stringify(params)}` };
    }
    return structuredClone(fx.response);
  }

  libs() {
    return this.call("app", "libs");
  }

  read(lib, id) {
    return this.call("app", "read", { lib, id });
  }

  exec(lib, id, args = {}) {
    return this.call("app", "exec", { lib, id, args });
  }

  currentUser() {
    return this.call("security", "current_user");
  }
}

function fixtureKey(call, params = {}) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${typeof params[k] === "object" ? JSON.stringify(params[k]) : params[k]}`)
    .join("&");
  return `${call}?${sorted}`;
}
