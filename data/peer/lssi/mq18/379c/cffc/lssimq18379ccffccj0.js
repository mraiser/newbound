var me = this;
var ME = document.getElementById(me.UUID);

// The 3D constellation is the SCENE FACET on peer.peer, run IN THIS PAGE
// by the stock-mountable bench 'player' control (the app.scenegraph
// idiom, one generation later — no iframe, one document, one debugger).
// This control keeps everything else: the peer data feed, the force
// layout, the dialogs, and the headsup panel. The bridge is the player's
// direct api: setState in (peers/connections/positions), onstate out
// (focus — tap toggles — opens/closes headsup).

me.peers = [];

// ── the constellation's physics ─────────────────────────────────────────────
// One shared implementation, plain facet functions. The scene behavior below is
// a THIN layer over them (behaviors run as this control's own `me`, so they see
// these directly — no cage, no copy). The host feed used to own this; now the
// behavior drives it every frame via the runtime and the constellation
// self-animates anywhere the scene runs (the editor's PLAY included).
var REPEL = 4.0, SPRING = 1.2, REST = 2.4, ANCHOR = 0.35, ANCHOR_FREE = 0.06;
var DAMPING = 3.0, MAX_SPEED = 2.0, D_MIN = 1.2, SUBSTEPS = 8;
var FIELD_BASE = 6.0, FLATTEN = 1.8;
me.layout = {};       // id -> {x, y, z, vx, vy, vz} — the sim state

function fieldRadius(n){ return FIELD_BASE * Math.cbrt(Math.max(1, n)); }
function hash32(s){ var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
function unit(s){ return (hash32(s) >>> 8) / 0x1000000; }
function seedPlacement(id, n){
  var th = unit('a:' + id) * 2 * Math.PI, c = unit('b:' + id) * 2 - 1;
  var r = 0.35 * fieldRadius(n) * (0.55 + 0.45 * unit('c:' + id));
  var s = Math.sqrt(Math.max(0, 1 - c * c));
  return { x: r * s * Math.cos(th), y: r * c / FLATTEN, z: r * s * Math.sin(th), vx: 0, vy: 0, vz: 0 };
}

// One integration step over me.layout (mutates it). Returns the kinetic energy.
function stepLayout(items, connections, dt){
  var list = [], byId = {};
  for (var i = 0; i < items.length; i++) {
    var it = items[i], l = me.layout[it.id] || (me.layout[it.id] = seedPlacement(it.id, items.length));
    if (l.y === undefined) { l.y = 0; l.vy = 0; }
    l.anchored = Boolean(it.connected || it.self);
    byId[it.id] = l; list.push(l);
  }
  var R = fieldRadius(list.length), h = dt / SUBSTEPS, damp = Math.exp(-DAMPING * h);
  for (var s = 0; s < SUBSTEPS; s++) {
    var i, j;
    for (i = 0; i < list.length; i++) { list[i].fx = 0; list[i].fy = 0; list[i].fz = 0; }
    for (i = 0; i < list.length; i++) {
      for (j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        var d2 = Math.max(0.04, dx*dx + dy*dy + dz*dz), d = Math.sqrt(d2), f = REPEL / d2;
        a.fx += dx/d*f; a.fy += dy/d*f; a.fz += dz/d*f;
        b.fx -= dx/d*f; b.fy -= dy/d*f; b.fz -= dz/d*f;
      }
      var g = list[i].anchored ? ANCHOR : ANCHOR_FREE;
      list[i].fx -= list[i].x * g; list[i].fy -= list[i].y * g * FLATTEN; list[i].fz -= list[i].z * g;
    }
    for (i = 0; i < connections.length; i++) {
      var cn = connections[i], la = byId[cn.a], lb = byId[cn.b];
      if (!la || !lb || la === lb) continue;
      var dx2 = lb.x - la.x, dy2 = lb.y - la.y, dz2 = lb.z - la.z;
      var dd = Math.max(0.2, Math.sqrt(dx2*dx2 + dy2*dy2 + dz2*dz2)), ff = SPRING * (dd - REST);
      la.fx += dx2/dd*ff; la.fy += dy2/dd*ff; la.fz += dz2/dd*ff;
      lb.fx -= dx2/dd*ff; lb.fy -= dy2/dd*ff; lb.fz -= dz2/dd*ff;
    }
    for (i = 0; i < list.length; i++) {
      var L = list[i];
      L.vx = (L.vx + L.fx * h) * damp; L.vy = (L.vy + L.fy * h) * damp; L.vz = (L.vz + L.fz * h) * damp;
      var sp = Math.sqrt(L.vx*L.vx + L.vy*L.vy + L.vz*L.vz);
      if (sp > MAX_SPEED) { L.vx *= MAX_SPEED/sp; L.vy *= MAX_SPEED/sp; L.vz *= MAX_SPEED/sp; }
      var nx = L.x + L.vx * h, ny = L.y + L.vy * h, nz = L.z + L.vz * h;
      var rad = Math.sqrt(nx*nx + ny*ny + nz*nz);
      if (rad > R) {
        var ux = nx/rad, uy = ny/rad, uz = nz/rad; nx = ux*R; ny = uy*R; nz = uz*R;
        var out = L.vx*ux + L.vy*uy + L.vz*uz;
        if (out > 0) { L.vx -= ux*out; L.vy -= uy*out; L.vz -= uz*out; }
      }
      L.x = nx; L.y = ny; L.z = nz;
    }
    for (i = 0; i < list.length; i++) for (j = i + 1; j < list.length; j++) {
      var A = list[i], B = list[j];
      var ddx = B.x - A.x, ddy = B.y - A.y, ddz = B.z - A.z;
      var dist = Math.sqrt(ddx*ddx + ddy*ddy + ddz*ddz);
      if (dist >= D_MIN) continue;
      var nx2, ny2, nz2;
      if (dist < 1e-9) { nx2 = 1; ny2 = 0; nz2 = 0; dist = 1e-9; } else { nx2 = ddx/dist; ny2 = ddy/dist; nz2 = ddz/dist; }
      var push = (D_MIN - dist) / 2;
      A.x -= nx2*push; A.y -= ny2*push; A.z -= nz2*push;
      B.x += nx2*push; B.y += ny2*push; B.z += nz2*push;
      var closing = (B.vx - A.vx)*nx2 + (B.vy - A.vy)*ny2 + (B.vz - A.vz)*nz2;
      if (closing < 0) {
        A.vx += nx2*closing/2; A.vy += ny2*closing/2; A.vz += nz2*closing/2;
        B.vx -= nx2*closing/2; B.vy -= ny2*closing/2; B.vz -= nz2*closing/2;
      }
    }
  }
  var e = 0;
  for (var k = 0; k < list.length; k++) e += list[k].vx*list[k].vx + list[k].vy*list[k].vy + list[k].vz*list[k].vz;
  return e;
}

// The behavior the SCENE references (behaviors.animate/render). A thin layer:
// step the shared sim at the feed cadence and push positions into `peers` state
// (which re-fires the mount bindings that place the orbs). Runs as this
// control's own `me`, so it calls stepLayout directly.
me.sceneBehaviors = {
  phys: {
    animate(ctx) { ctx.data.lastPush = 0; },
    render(ctx, dt) {
      if (!dt || dt <= 0) return;
      var peers = ctx.state.peers, connections = ctx.state.connections;
      if (!Array.isArray(peers) || peers.length === 0) return;
      var now = ctx.t;
      if (now - (ctx.data.lastPush || 0) < 0.09) return;
      var stepDt = Math.min(0.12, now - (ctx.data.lastPush || now));
      ctx.data.lastPush = now;
      var e = stepLayout(peers, Array.isArray(connections) ? connections : [], stepDt);
      var moved = false;
      for (var i = 0; i < peers.length; i++) {
        var l = me.layout[peers[i].id];
        if (!l) continue;
        if (peers[i].x !== l.x || peers[i].y !== l.y || peers[i].z !== l.z) {
          peers[i].x = l.x; peers[i].y = l.y; peers[i].z = l.z; moved = true;
        }
      }
      if (moved) ctx.set("peers", peers);
      ctx.data.energy = e;
    }
  }
};

