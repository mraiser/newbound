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

me.uiReady = function(ui){
  me.ui = ui;
  ME.querySelector('.wrap').style.display = 'block';
  ui.initNavbar(ME);
  ui.initPopups(ME);
};

function sceneSet(field, value){
  if (me.player) me.player.setState(field, value);
}

function toneFor(transport){
  if (!transport) return 'wire';
  if (transport.startsWith('tcp#')) return 'good';
  if (transport.startsWith('udp#')) return 'human';
  return 'wire';
}

// Orb colour: HUE BY TRANSPORT — the same convention the headsup panel has
// always used (peer/headsup.js: tcp green, udp blue, connected-by-relay
// yellow, otherwise grey) — with SATURATION FADING as the last contact
// recedes. Colour is data here, not theme, so this uses the scene schema's
// literal-colour escape (§2.3) rather than a token.
var TINT_L = 0.54, FRESH_MS = 30000, STALE_MS = 900000, TINT_MS = 15000;
var lastSeen = {};        // id -> epoch ms we last observed the peer connected

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

// 1 = fresh, 0 = fully stale. An unknown age (never connected, or the 0 the
// peers command reports when nothing is up) reads as fully stale.
function freshness(ageMs){
  if (!isFinite(ageMs) || ageMs < 0) return 0;
  if (ageMs <= FRESH_MS) return 1;
  if (ageMs >= STALE_MS) return 0;
  return 1 - (ageMs - FRESH_MS) / (STALE_MS - FRESH_MS);
}

function contactAge(p, now){
  // last_contact is the CONNECTION's own stamp (peer.peer.peers reads it off
  // whichever transport is up), so the span it measures is the real one: a
  // connected-but-quiet UDP or relay peer fades exactly like a dropped one.
  // Two honest limits ride along. A TCP stream keeps no per-read stamp and
  // reports "now" (listen.rs P2PStream::last_contact) — the platform has
  // nothing better, so a tcp peer stays fully saturated while it is up. And
  // a dropped peer reports 0, so we fall back to the last time THIS PAGE saw
  // it connected — in-memory, so a reload starts it stale.
  if (p.connected) lastSeen[p.id] = now;
  if (p.last_contact) return Math.max(0, now - p.last_contact);
  if (p.connected) return 0;
  if (lastSeen[p.id]) return now - lastSeen[p.id];
  return Infinity;
}

function tintFor(p, now){
  var h = 210, s0 = 0;                       // grey: disconnected
  if (p.tcp) { h = 132; s0 = 0.46; }         // green
  else if (p.udp) { h = 212; s0 = 0.48; }    // blue
  else if (p.relay || p.connected) { h = 48; s0 = 0.60; }   // yellow
  var f = freshness(contactAge(p, now));
  // never fade to flat grey — a dim hue still reads as "this was a tcp peer"
  return hslHex(h, s0 * (0.16 + 0.84 * f), TINT_L - (1 - f) * 0.12);
}

function peerList(){
  var out = [];
  for (var i in me.peers) out.push(me.peers[i]);
  return out;
}

// The legacy data-bus contract, kept: headsup (and anything else) reads a
// peer's live record from document.getElementById('peer_'+id).DATA. The divs
// are hidden stubs now — the 3D that used to hang off them lives in the
// scene facet.
function upsertPeerDiv(p){
  var d = document.getElementById('peer_' + p.id);
  if (!d) {
    d = document.createElement('div');
    d.id = 'peer_' + p.id;
    d.style.display = 'none';
    ME.appendChild(d);
  }
  d.DATA = p;
}

function pushScene(){
  // No self-orb: your own position carries no information (the corner
  // panel says who you are). Connected peers still drift toward center —
  // the legacy pull — they just don't get a line to an invisible you.
  // DATA ONLY: the phys scene-behavior owns the integration and writes
  // positions back into `peers` state itself; this just refreshes the peer /
  // connection records (tints, transport, display names) and carries the
  // behavior's current positions along so a data push never resets the sim.
  var items = [];
  var list = peerList();
  var pos = simPositions();
  for (var i in list) {
    var p = list[i];
    var l = pos[p.id] || {};
    items.push({id: p.id, displayname: p.displayname || p.name || p.id,
                connected: Boolean(p.connected), tint: tintFor(p, Date.now()),
                x: l.x || 0, y: l.y || 0, z: l.z || 0});
  }
  var connections = [];
  var have = {};
  for (var i in list) {
    var p = list[i];
    // p.peers maps peer-id -> transport ("tcp#..."/"udp#..."/relay)
    for (var rid in (p.peers || {})) {
      var key = p.id < rid ? p.id + '|' + rid : rid + '|' + p.id;
      if (have[key]) continue;
      have[key] = true;
      connections.push({id: key, a: p.id, b: rid, tone: toneFor(p.peers[rid])});
    }
  }
  sceneSet('peers', items);
  sceneSet('connections', connections);
  return me.lastEnergy || 0;
}

// The panel is a HEADS-UP DISPLAY: it floats OVER a full-bleed canvas and
// never reflows the world it hovers on. Narrowing the viewer to make room
// was tried and rejected for exactly that reason — a HUD that pushes the
// scene aside is a sidebar. The cost is real and stated (DEVIATIONS 22):
// the panel is position:fixed over the right edge and mostly opaque, so an
// orb underneath it cannot be tapped until you drag the view to bring that
// orb clear. Tap-to-close and switching peers work on any orb you can see.

function animateWidth(el, target, ms, cb){
  try {
    var anim = el.animate([{ width: target + 'px' }], { duration: ms, easing: 'ease' });
    anim.onfinish = function(){ el.style.width = target + 'px'; if (cb) cb(); }
  } catch (x) {
    el.style.width = target + 'px';
    if (cb) cb();
  }
}

// focus flows back from the scene (tap toggles): open/close the headsup panel
function onSceneFocus(value){
  var el = document.getElementById('headsupdisplay');
  if (!value) {
    stopHudWatch();
    animateWidth(el, 0, 300, function(){ el.style.display = 'none'; });
    return;
  }
  var p = null;
  var list = peerList();
  for (var i in list) if (list[i].id == value) p = list[i];
  if (!p) return;
  el.style.width = '0px';
  el.style.display = 'block';
  animateWidth(el, 680, 300);
  installControl(el, 'peer', 'headsup', function(api){}, p);
  watchHud();
}

// headsup closes itself from its own close icon without telling anyone —
// while focus is set, watch the panel's visibility and clear focus when it
// vanishes by ANY path (icon, popup machinery, whatever), so the scene's
// selection halo always tracks the HUD. The width is only a verdict when the
// panel is at rest: mid-open it is legitimately narrow, and a watcher that
// read it then would close the panel it was hired to follow.
var hudWatch = null;
function watchHud(){
  if (hudWatch) return;
  hudWatch = setInterval(function(){
    var el = document.getElementById('headsupdisplay');
    if (el.getAnimations && el.getAnimations().length > 0) return;
    if (getComputedStyle(el).display == 'none' || el.offsetWidth < 40) {
      stopHudWatch();
      sceneSet('focus', '');
    }
  }, 150);
}
function stopHudWatch(){
  if (hudWatch) { clearInterval(hudWatch); hudWatch = null; }
}

me.ready = function(){
  installControl(ME.querySelector('.viewer'), 'app', 'sceneplayer', function(api){
    me.player = api;
    api.waitReady(startFeed);
  }, {lib: 'peer', ctl: 'peer', onState: function(prefix, field, value){
    if (field == 'focus') onSceneFocus(value);
  }});

  subscribe_event("peer", "UPDATE", function(data){
    var found = false;
    for (var i in me.peers) {
      if (me.peers[i].id == data.id) { me.peers[i] = data; found = true; }
    }
    if (!found) me.peers.push(data);
    upsertPeerDiv(data);
    wakeFeed();
  });

  send_peers(function(result){
    me.peers = [];
    for (var i in result.data) {
      me.peers.push(result.data[i]);
      upsertPeerDiv(result.data[i]);
    }
    send_info(null, null, null, function(result){
      me.info = result.data;
      ME.querySelector('.localpeername').textContent = result.data.name;
      ME.querySelector('.localpeerid').textContent = result.data.uuid;
      ME.querySelector('.localpeerport').textContent = "P2P Port: "+result.data.p2p_port;
      ME.querySelector('.localhttpport').textContent = "HTTP Port: "+result.data.http_port;

      json('../app/libs', null, function(result) {
        document.body.locallibraries = result.data;
      });

      json('../security/groups', null, function(result){
        if (result.status != 'ok') alert(result.msg);
        else {
          me.groups = result.data;
          result.data.sort();
          var newhtml = '';
          for (var i in result.data) {
            newhtml += '<option>'+result.data[i]+'</option>';
          }
          var sel = ME.querySelector('.groupselect');
          sel.innerHTML = newhtml;
          sel.value = 'anonymous';
        }
      });

      startFeed();
    });
  });
};

// The feed loop: layout + push every FEED_MS (10Hz). The constellation's
// position ease is {ms:100, curve:linear} — matched to THIS interval so
// waypoints chain into continuous motion (change one, change both; an
// ease shorter than the interval reads as spurts, longer causes snaps).
// SETTLE-AND-SLEEP: molecules come to rest — when kinetic energy stays
// under epsilon the loop stops entirely (true stillness, zero traffic);
// any UPDATE event wakes it. Starts once BOTH the player and the local
// info are ready.
var FEED_MS = 100, SETTLE_E = 0.0004, SETTLE_TICKS = 6;
var settled = 0;
// the phys behavior keeps its kinetic energy on its ctx.data; the feed's
// settle-and-sleep reads it from the live runtime (falls back to 0 → run)
function simEnergy(){
  try {
    var rt = me.player && me.player.runtime;
    var root = rt && rt.instances.get("");
    return (root && root.behaviorData && root.behaviorData.energy) || 0;
  } catch (x) { return 0; }
}
// positions are owned by the behavior's sim and surface in the scene's `peers`
// state; the host reads them back from the live runtime (id → {x,y,z})
function simPositions(){
  var out = {};
  try {
    var rt = me.player && me.player.runtime;
    var root = rt && rt.instances.get("");
    var peers = root && root.state.peers;
    if (Array.isArray(peers)) for (var i = 0; i < peers.length; i++) {
      out[peers[i].id] = { x: peers[i].x || 0, y: peers[i].y || 0, z: peers[i].z || 0 };
    }
  } catch (x) {}
  return out;
}
function feedTick(){
  pushScene();
  var e = simEnergy();
  settled = e < SETTLE_E ? settled + 1 : 0;
  if (settled >= SETTLE_TICKS) {
    clearInterval(me.feed);
    me.feed = null;
  }
}
function startFeed(){
  if (me.feed || !me.player || !me.info) return;
  settled = 0;
  feedTick();
  if (!me.feed) me.feed = setInterval(feedTick, FEED_MS);
}
// The feed sleeps once the layout settles, but staleness keeps advancing —
// so a slow tick re-pushes ONLY when a tint actually changed. No physics, no
// wake: just the colours.
var tintTimer = setInterval(function(){
  if (!me.player || me.feed) return;          // the live feed already covers it
  var now = Date.now(), items = [], moved = false;
  var list = peerList();
  var pos = simPositions();
  // A peer with no sim slot has never been placed — it arrived while the feed
  // was asleep (normally an UPDATE event wakes it; nothing guarantees one).
  // Wake the feed so it gets placed, rather than skipping it forever.
  for (var i in list) {
    if (!pos[list[i].id]) { wakeFeed(); return; }
  }
  for (var i in list) {
    var p = list[i], l = pos[p.id];
    if (!l) continue;
    var tint = tintFor(p, now);
    if (me.lastTint && me.lastTint[p.id] !== tint) moved = true;
    items.push({id: p.id, displayname: p.displayname || p.name || p.id,
                connected: Boolean(p.connected), tint: tint,
                x: l.x, y: l.y, z: l.z});
  }
  if (!me.lastTint) { me.lastTint = {}; moved = items.length > 0; }
  for (var i in items) me.lastTint[items[i].id] = items[i].tint;
  if (moved && items.length) sceneSet('peers', items);
}, TINT_MS);

function wakeFeed(){
  settled = 0;
  startFeed();
}

ME.querySelector('.updateallpeersbutton').addEventListener('click', function(){
  // local crate versions first: the rows' crate-diff chips compare against them
  json('../dev/crate_versions', null, function(r){ me.localcrates = r; buildUpdateDialog(); });
});

function buildUpdateDialog(){
  var newhtml = '<table cellpadding="10px" class="updateablepeerstable"><thead><tr><th><label class="plaincheckbox"><input type="checkbox" class="toggleallupdates"><span></span></label></th><th style="text-align:left;">Peer</th><th style="text-align:left;">Available Updates</th></tr></thead><tbody>';
  for (var i in me.peers) {
    var p = me.peers[i];
    if (p.connected) {
      var uuid = p.id;
      newhtml += '<tr class="uprow r_'+uuid+'" data-peer="'+uuid+'">'
        + '<td><label class="plaincheckbox"><input type="checkbox" class="libupdate"><span></span></label></td>'
        + '<td>'+p.name+'<br><div style="font-size:x-small;">'+uuid+'</div></td>'
        + '<td class="rowstatus"><i>pending...</i></td>'
        + '</tr>';
      checkForUpdates(p);
    }
  }
  newhtml += '</tbody></table>';

  var el = ME.querySelector('.peerupdatelist');
  el.innerHTML = newhtml;
  el.querySelector('.toggleallupdates').addEventListener('click', function(){
    var b = this.checked;
    el.querySelectorAll('.libupdate').forEach(function(box){ box.checked = b; });
  });
}

function checkForUpdates(peer) {
  var uuid = peer.id;
  json('../peer/remote/'+uuid+'/app/libs', null, function(result){
    if (result.data && document.body.locallibraries) {
      var newhtml = '';
      for (var i in result.data) {
        var theirlib = result.data[i];
        var mylib = getByProperty(document.body.locallibraries, 'id', theirlib.id);
        if (mylib) {
          var author = mylib.author;
          var authorkey = mylib.authorkey;
          if (true) { //(author && authorkey && theirlib.author == author && theirlib.authorkey == authorkey) {
            if (mylib.version > theirlib.version) {
              newhtml += '<span class="chip ispos" id="U_'+mylib.id+'"><span class="clickupdate" data-lib="'+mylib.id+'" data-version="'+mylib.version+'">'
                + mylib.id
                + ' v'
                + theirlib.version
                + ' ➤ '
                + mylib.version
                + '</span><img src="../app/asset/app/close-white.png" class="roundbutton-small removeupdate mdl-chip__action chipbutton"></span> ';
            }
          }
        }
      }
      // crate pins ride the same row: a peer lagging the local flowlang/ndata
      // versions gets a distinct chip (clickcrates, NOT clickupdate - the lib
      // installer must never treat it as a library)
      json('../peer/remote/'+uuid+'/dev/crate_versions', null, function(cr){
        var lc = me.localcrates;
        if (cr && cr.status == 'ok' && lc && lc.status == 'ok' && (cr.flowlang != lc.flowlang || cr.ndata != lc.ndata)) {
          newhtml += '<span class="chip clickcrates" data-flowlang="'+lc.flowlang+'" data-ndata="'+lc.ndata+'">crates: flowlang '
            + cr.flowlang + ' ➤ ' + lc.flowlang + ' / ndata ' + cr.ndata + ' ➤ ' + lc.ndata
            + '<img src="../app/asset/app/close-white.png" class="roundbutton-small removeupdate mdl-chip__action chipbutton"></span> ';
        }
        var el = ME.querySelector('.r_'+uuid);
        if (!el) return;
        if (newhtml == '') el.remove();
        else {
          el.querySelector('.rowstatus').innerHTML = newhtml;
          el.querySelectorAll('.removeupdate').forEach(function(x){
            x.addEventListener('click', function(){
              this.closest('.chip').remove();
            });
          });
        }
      });
    }
  });
}

ME.querySelector('#updateallpeersnow').addEventListener('click', function(){
  var myuuid = document.querySelector('.localpeerid').textContent;
  ME.querySelectorAll('.libupdate').forEach(function(el){
    if (el.checked) {
      var row = el.closest('.uprow');
      var peer = row.dataset.peer;
      var libs = [];
      row.querySelectorAll('.clickupdate').forEach(function(chip){
        libs.push(chip.dataset.lib);
      });

      if (libs.length > 0 || row.querySelector('.clickcrates')) {

        var recompile = false;

        function fetchNext() {
          if (libs.length > 0) {
            var lib = libs.pop();
            console.log(peer+"/"+lib);
            var x = row.querySelector('.removeupdate');
            var chip = x.parentElement;
            chip.style.color = 'rgba(0,0,0,0.5)';
            x.remove();

            var d = 'uuid='+myuuid+'&lib='+lib;
            json('../peer/remote/'+peer+'/dev/install_lib', d, function(result){
              if (result.status == "ok") {
                recompile = recompile || result.data;
                chip.remove();
                fetchNext();
              }
              else {
                chip.style.color = 'rgba(255,0,0,0.5)';
                chip.insertAdjacentHTML('beforeend', '<br>Error: '+result.msg);
              }
            });
          }
          else {
            var cratechip = row.querySelector('.clickcrates');
            if (cratechip) {
              // the crate runner's own rebuild+recompile covers everything a
              // compile_rust would have done, so it replaces that step
              var fl = cratechip.dataset.flowlang;
              var nd = cratechip.dataset.ndata;
              row.querySelector('.rowstatus').innerHTML = "<i>Updating platform crates to flowlang "+fl+" / ndata "+nd+"...</i>";
              json('../peer/remote/'+peer+'/dev/update_crates', 'flowlang='+encodeURIComponent(fl)+'&ndata='+encodeURIComponent(nd), function(result){
                if (result.status == 'ok') row.querySelector('.rowstatus').innerHTML = "<i>crate update launched — open the peer's panel for progress and the restart verdict</i>";
                else row.querySelector('.rowstatus').innerHTML = '<font color="red">Error: '+result.msg+'</font>';
              });
            }
            else if (recompile) {
              row.querySelector('.rowstatus').innerHTML = "<i>Recompiling Rust...</i>";
              json('../peer/remote/'+peer+'/dev/compile_rust', null, function(result){
                row.remove();
              });
            }
            else row.remove();
          }
        }
        fetchNext();
      }
    }
  });
});

ME.querySelector('.addpeerbutton').addEventListener('click', function(){
  json('../peer/discovery', null, function(result){
    me.discovery = result.data;
    var newhtml = '';
    var now = new Date().getTime();
    for (sip in result.data) {
      var rds = result.data[sip];
      if (now - rds.time < 30000 && !getByProperty(me.peers, "id", rds.uuid)) {
        newhtml += '<tr class="clickme" data-sip="'+sip+'"><td>'+sip+'</td><td>'+rds.name+'</td><td><span class="smalltext">'+rds.uuid+'</span></td></tr>';
      }
    }
    if (newhtml == '') newhtml = '<div class="padme"><i>No new devices found on LAN</i></div>';
    else newhtml = '<table class="lantable" border="0" cellpadding="0" cellspacing="20">' + newhtml + '</table>';
    var disc = ME.querySelector('.discovered');
    disc.innerHTML = newhtml;
    disc.querySelectorAll('.clickme').forEach(function(rowEl){
      rowEl.addEventListener('click', function(){
        var sip = this.dataset.sip;
        var rds = me.discovery[sip];
        ME.querySelector('.autab2').click();
        ME.querySelector('.addusername').value = rds.name;
        ME.querySelector('.adduseruuid').value = rds.uuid;
        ME.querySelector('.adduseripaddr').value = rds.address;
        ME.querySelector('.adduserport').value = rds.p2pport;
      });
    });
  });
});

ME.querySelector('#addconnection').addEventListener('click', function(){
  var el_uuid = ME.querySelector('.adduseruuid');
  el_uuid.parentElement.style.border = 'none';
  var uuid = el_uuid.value;
  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  if (!regexExp.test(uuid)) {
    el_uuid.parentElement.style.border = 'thin red solid';
    document.body.api.ui.snackbar({"message":"A valid device ID is required"});
  }
  else if (uuid == me.info.uuid) {
    el_uuid.parentElement.style.border = 'thin red solid';
    document.body.api.ui.snackbar({"message":"You cannot connect to yourself"});
  }
  else {
    ME.querySelector('.close-add-user').click();
    var rando = guid();
    var display = ME.querySelector('.addusername').value;
    var keepalive = ME.querySelector('#useraddkeepalive').checked;
    var group = JSON.stringify([ME.querySelector('.addusergroup').value]);
    var address = ME.querySelector('.adduseripaddr').value;
    var port = ME.querySelector('.adduserport').value;
    var params = "id="+encodeURIComponent(uuid)
      + "&displayname="+encodeURIComponent(display)
      + "&password="+encodeURIComponent(rando)
      + "&groups="+encodeURIComponent(group)
      + "&keepalive="+keepalive
      + "&address="+encodeURIComponent(address)
      + "&port="+encodeURIComponent(port);
    json('../security/setuser', params, function(result){
      var params = "ipaddr="+encodeURIComponent(address)
        + "&port="+encodeURIComponent(port);
      json('../peer/udp_connect', params, function(result){

      });
    });
  }
});
