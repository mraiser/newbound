var me = this;
var ME = document.getElementById(me.UUID);

// A peer_model IS a 3D object (the scenegraph model, on scenehost). Its shape
// is the scene facet (sphere orb + text label — data). Its behaviors are HERE,
// per-instance, on this control's own js facet — the host (scenehost) calls
// them as this control's own `me`, with full closure over this facet (no cage).
//   me.rig    — this instance's transform {pos, rot, scale}; the host syncs it
//   me.scene  — the scenehost api; me.scene.children = my sibling orbs
//   me.data   — the peer record the front-end passed to addControl
// The constellation's physics is the OLD peer.render: each orb computes the
// force ON ITSELF from its siblings and applies it to its own rig.

// Orb colour: hue by transport, saturation fading as the last contact recedes —
// the headsup panel's convention, computed per-orb here.
function hslHex(h, s, l){
  var c = (1 - Math.abs(2*l - 1)) * s, hp = h / 60;
  var x = c * (1 - Math.abs(hp % 2 - 1)), m = l - c/2;
  var r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; } else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; } else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; } else { r = c; b = x; }
  function hx(v){ var n = Math.round((v + m) * 255);
    return (n < 16 ? '0' : '') + Math.max(0, Math.min(255, n)).toString(16); }
  return '#' + hx(r) + hx(g) + hx(b);
}
function freshness(ageMs){
  if (!isFinite(ageMs) || ageMs < 0) return 0;
  if (ageMs <= 30000) return 1;
  if (ageMs >= 900000) return 0;
  return 1 - (ageMs - 30000) / (900000 - 30000);
}
function tint(){
  var p = me.data || {}, now = Date.now();
  var h = 210, s0 = 0;                                   // grey: disconnected
  if (p.tcp) { h = 132; s0 = 0.46; }                     // green
  else if (p.udp) { h = 212; s0 = 0.48; }                // blue
  else if (p.relay || p.connected) { h = 48; s0 = 0.60; } // yellow
  var age = p.last_contact ? Math.max(0, now - p.last_contact) : Infinity;
  var f = freshness(age);
  return hslHex(h, s0 * (0.16 + 0.84 * f), 0.54 - (1 - f) * 0.12);
}

// ── animate: once, at setup. Seed the rig (deterministic ring by id so a fresh
// constellation doesn't stack) and stamp the label. me.lines = connection
// link-spec ids this orb owns.
me.animate = function (ctx) {
  if (!me.data) me.data = {};
  var id = (me.data && me.data.id) || ctx.key;
  me.peerId = id;
  me.vx = 0; me.vy = 0; me.vz = 0;
  me.lines = {};
  // deterministic ring seed from the id's first bytes
  var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  var a = (h % 360) * Math.PI / 180;
  ctx.rig.pos.x = Math.cos(a) * 2.6;
  ctx.rig.pos.z = Math.sin(a) * 2.6;
  // a slight, deterministic Y deviation from the same id hash — each peer has
  // its own rest height (me.restY) so the constellation escapes the plane
  me.restY = 0.5 + ((((h >>> 8) % 1000) / 1000) - 0.5) * 0.9;   // 0.05 .. 0.95
  ctx.rig.pos.y = me.restY;
  ctx.setRig("tag", "text", me.data.displayname || me.data.name || id);
  ctx.setRig("orb", "material", { color: tint() });
};

// ── render: every frame. The force ON ME from my siblings, applied to my rig —
// plus connection springs for my links, and my tint/label upkeep.
me.render = function (ctx, dt) {
  if (!dt || dt <= 0) dt = 0.016;
  if (!me.data) me.data = {};
  var fx = 0, fy = 0, fz = 0;
  var siblings = ctx.host.children;
  var count = 0;
  var connected = false;
  for (var k = 0; k < siblings.length; k++) {
    var s = siblings[k];
    if (s === ctx.me || !s.rig) continue;
    var dx = ctx.rig.pos.x - s.rig.pos.x, dy = ctx.rig.pos.y - s.rig.pos.y, dz = ctx.rig.pos.z - s.rig.pos.z;
    var d2 = Math.max(0.04, dx*dx + dy*dy + dz*dz), d = Math.sqrt(d2);
    var f = 1.2 / d2;                                   // 1/d² repulsion
    fx += (dx/d)*f; fy += (dy/d)*f; fz += (dz/d)*f; count++;
    // a connection to this sibling? a weak spring toward it, and own the link
    var rid = s.me && s.me.peerId;
    if (rid && me.data.peers && me.data.peers[rid]) {
      connected = true;
      var op = me.data.peers[rid];
      var sf = 0.05 * d;                                 // spring pull
      fx -= (dx/d)*sf; fy -= (dy/d)*sf; fz -= (dz/d)*sf;
      me._wantLink(ctx, s, op);
    }
  }
  // pull to centre — only CONNECTED peers feel it. A radial spring: magnitude
  // grows with distance from the centre (stronger far away) and fades to zero
  // as the peer reaches it. The centre is the connected cluster's own — the
  // origin laterally, the local mean rest height vertically — and the pull is
  // the same on every axis (isotropic).
  if (connected) {
    var cy = 0, cn = 0;
    for (var m = 0; m < siblings.length; m++) {
      var sm = siblings[m];
      if (sm === ctx.me || !sm.rig) continue;
      var smid = sm.me && sm.me.peerId;
      if (smid && me.data.peers && me.data.peers[smid]) { cy += (typeof sm.me.restY === "number" ? sm.me.restY : 0.5); cn++; }
    }
    cy = cn ? cy / cn : (typeof me.restY === "number" ? me.restY : 0.5);
    var gx = ctx.rig.pos.x, gy = ctx.rig.pos.y - cy, gz = ctx.rig.pos.z;
    var gd = Math.sqrt(gx*gx + gy*gy + gz*gz);
    if (gd > 1e-4) {
      // isotropic Hooke pull toward the cluster centre: F = −k·(offset), k = 0.55
      fx -= gx * 0.55; fy -= gy * 0.55; fz -= gz * 0.55;
    }
  }
  me.vx = (me.vx + fx * dt) * 0.86;
  me.vy = (me.vy + fy * dt) * 0.86;
  me.vz = (me.vz + fz * dt) * 0.86;
  ctx.rig.pos.x += me.vx * dt;
  ctx.rig.pos.y += me.vy * dt;
  ctx.rig.pos.z += me.vz * dt;

  // tint by transport + staleness; spin the orb lazily
  if ((me._tintTick = (me._tintTick || 0) + dt) > 0.5) {
    me._tintTick = 0;
    ctx.setRig("orb", "material", { color: tint() });
    var name = me.data.displayname || me.data.name || me.peerId;
    if (me._shownName !== name) { me._shownName = name; ctx.setRig("tag", "text", name); }
  }
  ctx.rig.rot.y += dt * 0.4;
};

// own a connection link to a sibling (idempotent; the host owns link specs)
me._wantLink = function (ctx, sibling, transport) {
  var rid = sibling.me.peerId;
  if (me.lines[rid]) return;
  me.lines[rid] = true;
  var key = me.peerId < rid ? me.peerId + "|" + rid : rid + "|" + me.peerId;
  var tone = transport && transport.startsWith("tcp#") ? "good"
    : transport && transport.startsWith("udp#") ? "human" : "wire";
  ctx.host.addLink(key, ctx.key, sibling.key, tone);
};

// ── click: bring up MY heads-up panel (the front-end's channel, or default).
me.click = function (ctx) {
  var cb = ctx.host.hostData && ctx.host.hostData.onFocus;
  if (typeof cb === "function") cb(me.peerId, me.data, ctx);
};

me.ready = function () {};
