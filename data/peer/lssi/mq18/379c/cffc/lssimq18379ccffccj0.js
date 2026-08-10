var me = this;
var ME = $('#'+me.UUID)[0];

// The 3D constellation is the SCENE FACET on peer.peer, run IN THIS PAGE
// by the stock-mountable bench 'player' control (the app.scenegraph
// idiom, one generation later — no iframe, one document, one debugger).
// This control keeps everything else: the peer data feed, the force
// layout, the dialogs, and the headsup panel. The bridge is the player's
// direct api: setState in (peers/connections/positions), onstate out
// (focus — tap toggles — opens/closes headsup).

me.peers = [];
me.layout = {};       // id -> {x, z, vx, vz}

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
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
// peer's live record from $('#peer_'+id)[0].DATA. The divs are hidden
// stubs now — the 3D that used to hang off them lives in the scene facet.
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

// Force layout (assets/forcelayout.js semantics, inlined): loosely mimics
// the physics that binds atoms in a molecule — 1/d² repulsion grows as
// peers approach, so connected peers are drawn together but keep their
// distance. Two guarantees make that hold at any cadence:
//   · SUBSTEPPING: each call integrates 8 small sub-steps, so the stiff
//     short-range repulsion is sampled while the barrier is climbed (one
//     big step tunnels through it, then explodes).
//   · SEPARATION PROJECTION: after integrating, any pair closer than
//     D_MIN is pushed apart to exactly D_MIN and the closing velocity is
//     cancelled — "orbs never merge" is an invariant, not a tuning hope.
//   · A RADIAL FIELD BOUND: nothing drifts away forever, but the wall is a
//     SPHERE whose radius grows with the population (cube root, so density
//     holds steady as peers arrive) rather than a fixed box. A box has
//     corners, and a fixed one turns a busy instance into a crowd pressed
//     against flat walls.
// The field is 3D. y is a real degree of freedom, not a constant: without it
// every orb is trapped in one plane forever. It is pulled toward the midplane
// FLATTEN times harder than x/z, so the constellation reads as a thick slab
// you look into rather than a ball you look at — each orb's label hangs above
// it, and unbounded y stacks those labels on each other.
var REPEL = 4.0, SPRING = 1.2, REST = 2.4, ANCHOR = 0.35, ANCHOR_FREE = 0.06;
var DAMPING = 3.0, MAX_SPEED = 2.0, D_MIN = 1.2, SUBSTEPS = 8;
var FIELD_BASE = 6.0, FLATTEN = 1.8;

function fieldRadius(n){ return FIELD_BASE * Math.cbrt(Math.max(1, n)); }

// FNV-1a. A peer's first position is a deterministic function of its ID, so
// it lands in the same part of the field every session and does not shuffle
// when the peer list changes length — the old seed (index around a circle)
// did both wrong. Salted three ways for three independent streams.
function hash32(s){
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
function unit(s){ return (hash32(s) >>> 8) / 0x1000000; }   // [0,1)

function seedPlacement(id, n){
  var theta = unit('a:' + id) * 2 * Math.PI;        // azimuth
  var c = unit('b:' + id) * 2 - 1;                  // cos(polar): uniform on a sphere
  var r = 0.35 * fieldRadius(n) * (0.55 + 0.45 * unit('c:' + id));
  var s = Math.sqrt(Math.max(0, 1 - c*c));
  return {x: r*s*Math.cos(theta), y: r*c/FLATTEN, z: r*s*Math.sin(theta),
          vx: 0, vy: 0, vz: 0};
}

function stepLayout(items, connections, dt){
  var list = [];
  var byId = {};
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var l = me.layout[it.id];
    if (!l) l = me.layout[it.id] = seedPlacement(it.id, items.length);
    if (l.y === undefined) { l.y = 0; l.vy = 0; }   // a slot from a 2D build
    l.anchored = Boolean(it.connected || it.self);
    byId[it.id] = l;
    list.push(l);
  }
  var R = fieldRadius(list.length);
  var h = dt / SUBSTEPS;
  var damp = Math.exp(-DAMPING * h);
  for (var s = 0; s < SUBSTEPS; s++) {
    for (var i = 0; i < list.length; i++) { list[i].fx = 0; list[i].fy = 0; list[i].fz = 0; }
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        var d2 = Math.max(0.04, dx*dx + dy*dy + dz*dz);
        var d = Math.sqrt(d2), f = REPEL / d2;
        a.fx += (dx/d)*f; a.fy += (dy/d)*f; a.fz += (dz/d)*f;
        b.fx -= (dx/d)*f; b.fy -= (dy/d)*f; b.fz -= (dz/d)*f;
      }
      // weak gravity for free peers too: they reach a force-balance orbit
      // farther out instead of drifting forever (which defeats sleep)
      var g = list[i].anchored ? ANCHOR : ANCHOR_FREE;
      list[i].fx -= list[i].x * g;
      list[i].fy -= list[i].y * g * FLATTEN;
      list[i].fz -= list[i].z * g;
    }
    for (var i = 0; i < connections.length; i++) {
      var c = connections[i];
      var la = byId[c.a], lb = byId[c.b];
      if (!la || !lb || la == lb) continue;
      var dx = lb.x - la.x, dy = lb.y - la.y, dz = lb.z - la.z;
      var d = Math.max(0.2, Math.sqrt(dx*dx + dy*dy + dz*dz));
      var f = SPRING * (d - REST);
      la.fx += (dx/d)*f; la.fy += (dy/d)*f; la.fz += (dz/d)*f;
      lb.fx -= (dx/d)*f; lb.fy -= (dy/d)*f; lb.fz -= (dz/d)*f;
    }
    for (var i = 0; i < list.length; i++) {
      var l = list[i];
      l.vx = (l.vx + l.fx * h) * damp;
      l.vy = (l.vy + l.fy * h) * damp;
      l.vz = (l.vz + l.fz * h) * damp;
      var sp = Math.sqrt(l.vx*l.vx + l.vy*l.vy + l.vz*l.vz);
      if (sp > MAX_SPEED) { l.vx *= MAX_SPEED/sp; l.vy *= MAX_SPEED/sp; l.vz *= MAX_SPEED/sp; }
      var nx = l.x + l.vx * h, ny = l.y + l.vy * h, nz = l.z + l.vz * h;
      // The wall is a SPHERE of radius R, not a box: clamp the distance from
      // centre and kill the OUTWARD component of the velocity (or a
      // wall-pinned peer accumulates speed forever and the sim never
      // settles/sleeps). Only the outward part goes — sliding along the
      // wall is still allowed, so a pinned peer keeps looking for room.
      var rad = Math.sqrt(nx*nx + ny*ny + nz*nz);
      if (rad > R) {
        var ux = nx/rad, uy = ny/rad, uz = nz/rad;
        nx = ux*R; ny = uy*R; nz = uz*R;
        var out = l.vx*ux + l.vy*uy + l.vz*uz;
        if (out > 0) { l.vx -= ux*out; l.vy -= uy*out; l.vz -= uz*out; }
      }
      l.x = nx; l.y = ny; l.z = nz;
    }
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        var d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d >= D_MIN) continue;
        var nx, ny, nz;
        if (d < 1e-9) { nx = 1; ny = 0; nz = 0; d = 1e-9; }
        else { nx = dx/d; ny = dy/d; nz = dz/d; }
        var push = (D_MIN - d) / 2;
        a.x -= nx*push; a.y -= ny*push; a.z -= nz*push;
        b.x += nx*push; b.y += ny*push; b.z += nz*push;
        var closing = (b.vx - a.vx)*nx + (b.vy - a.vy)*ny + (b.vz - a.vz)*nz;
        if (closing < 0) {
          a.vx += nx*closing/2; a.vy += ny*closing/2; a.vz += nz*closing/2;
          b.vx -= nx*closing/2; b.vy -= ny*closing/2; b.vz -= nz*closing/2;
        }
      }
    }
  }
  var e = 0;
  for (var i = 0; i < list.length; i++)
    e += list[i].vx*list[i].vx + list[i].vy*list[i].vy + list[i].vz*list[i].vz;
  return e;
}

function pushScene(){
  // No self-orb: your own position carries no information (the corner
  // panel says who you are). Connected peers still drift toward center —
  // the legacy pull — they just don't get a line to an invisible you.
  var items = [];
  var list = peerList();
  for (var i in list) {
    var p = list[i];
    items.push({id: p.id, displayname: p.displayname || p.name || p.id,
                connected: Boolean(p.connected), tint: tintFor(p, Date.now())});
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
  var e = stepLayout(items, connections, FEED_MS / 1000);
  for (var i in items) {
    var l = me.layout[items[i].id];
    items[i].x = l.x;
    items[i].y = l.y;
    items[i].z = l.z;
  }
  sceneSet('peers', items);
  sceneSet('connections', connections);
  return e;
}

// The panel is a HEADS-UP DISPLAY: it floats OVER a full-bleed canvas and
// never reflows the world it hovers on. Narrowing the viewer to make room
// was tried and rejected for exactly that reason — a HUD that pushes the
// scene aside is a sidebar. The cost is real and stated (DEVIATIONS 22):
// the panel is position:fixed over the right edge and mostly opaque, so an
// orb underneath it cannot be tapped until you drag the view to bring that
// orb clear. Tap-to-close and switching peers work on any orb you can see.

// focus flows back from the scene (tap toggles): open/close the headsup panel
function onSceneFocus(value){
  var el = $('#headsupdisplay');
  if (!value) {
    stopHudWatch();
    el.animate({width: 0}, 300, function(){ el.css('display', 'none'); });
    return;
  }
  var p = null;
  var list = peerList();
  for (var i in list) if (list[i].id == value) p = list[i];
  if (!p) return;
  el.width(0).css('display', 'block').animate({width: 680}, 300);
  installControl(el[0], 'peer', 'headsup', function(api){}, p);
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
    var el = $('#headsupdisplay');
    if (el.is(':animated')) return;
    if (el.css('display') == 'none' || el.width() < 40) {
      stopHudWatch();
      sceneSet('focus', '');
    }
  }, 150);
}
function stopHudWatch(){
  if (hudWatch) { clearInterval(hudWatch); hudWatch = null; }
}

me.ready = function(){
  var el = $(ME).find('.viewer');
  installControl(el[0], 'app', 'sceneplayer', function(api){
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
      $(ME).find('.localpeername').text(result.data.name);
      $(ME).find('.localpeerid').text(result.data.uuid);
      $(ME).find('.localpeerport').text("P2P Port: "+result.data.p2p_port);
      $(ME).find('.localhttpport').text("HTTP Port: "+result.data.http_port);

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
          $(ME).find('.groupselect').html(newhtml).val('anonymous');
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
function feedTick(){
  var e = pushScene();
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
  // A peer with no layout slot has never been through pushScene — it arrived
  // while the feed was asleep (normally an UPDATE event wakes it; nothing
  // guarantees one). Wake the feed so it gets placed, rather than skipping it
  // forever.
  for (var i in list) {
    if (!me.layout[list[i].id]) { wakeFeed(); return; }
  }
  for (var i in list) {
    var p = list[i], l = me.layout[p.id];
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

$(ME).find('.updateallpeersbutton').click(function(){
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
  newhtml += '</tbody></table>';;

  var el = $(ME).find('.peerupdatelist');
  el.html(newhtml).find('.toggleallupdates').click(function(){
    var b = $(this).prop("checked");
    el.find('.libupdate').prop('checked', b);
  });;
});

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
      var el = $(ME).find('.r_'+uuid);
      if (newhtml == '') el.remove();
      else {
        el.find('.rowstatus').html(newhtml);
        el.find('.removeupdate').click(function(){
          $(this).closest('.chip').remove();
        });
      }
    }
  });
}

$(ME).find('#updateallpeersnow').click(function(){
  var myuuid = $('.localpeerid').text();
  $(ME).find('.libupdate').each(function(i, el){
    if ($(el).prop('checked')) {
      var row = $(el.closest('.uprow'));
      var peer = row.data('peer');
      var libs = [];
      row.find('.clickupdate').each(function(j, chip){
        libs.push($(chip).data('lib'));
      });

      if (libs.length > 0) {

        var recompile = false;

        function fetchNext() {
          if (libs.length > 0) {
            var lib = libs.pop();
            console.log(peer+"/"+lib);
            var x = $(row.find('.removeupdate')[0]);
            var chip = x.parent();
            chip.css('color', 'rgba(0,0,0,0.5)');
            x.remove();

            var d = 'uuid='+myuuid+'&lib='+lib;
            json('../peer/remote/'+peer+'/dev/install_lib', d, function(result){
              if (result.status == "ok") {
                recompile = recompile || result.data;
                chip.remove();
                fetchNext();
              }
              else {
                chip.css('color', 'rgba(255,0,0,0.5)');
                chip.append('<br>Error: '+result.msg);
              }
            });
          }
          else {
            if (recompile) {
              row.find('.rowstatus').html("<i>Recompiling Rust...</i>");
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

$(ME).find('.addpeerbutton').click(function(){
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
    $(ME).find('.discovered').html(newhtml).find('.clickme').click(function(){
      var sip = $(this).data('sip');
      var rds = me.discovery[sip];
      $(ME).find('.autab2').click();
      $(ME).find('.addusername').val(rds.name);
      $(ME).find('.adduseruuid').val(rds.uuid);
      $(ME).find('.adduseripaddr').val(rds.address);
      $(ME).find('.adduserport').val(rds.p2pport);
    });
  });
});

$(ME).find('#addconnection').click(function(){
  var el_uuid = $(ME).find('.adduseruuid');
  el_uuid.parent().css('border', 'none');
  var uuid = el_uuid.val();
  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  if (!regexExp.test(uuid)) {
    el_uuid.parent().css('border', 'thin red solid');
    document.body.api.ui.snackbar({"message":"A valid device ID is required"});
  }
  else if (uuid == me.info.uuid) {
    el_uuid.parent().css('border', 'thin red solid');
    document.body.api.ui.snackbar({"message":"You cannot connect to yourself"});
  }
  else {
    $(ME).find('.close-add-user').click();
    var rando = guid();
    var display = $(ME).find('.addusername').val();
    var keepalive = $(ME).find('#useraddkeepalive').prop('checked');
    var group = JSON.stringify([$(ME).find('.addusergroup').val()]);
    var address = $(ME).find('.adduseripaddr').val();
    var port = $(ME).find('.adduserport').val();
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
