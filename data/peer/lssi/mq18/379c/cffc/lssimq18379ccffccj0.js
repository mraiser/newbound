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

// F4: app.scenehost.addControl is async — the key lands in byId/children only
// after its awaits — so overlapping syncPeers calls (waitReady and the
// send_info callback both fire it) would add the same peer twice. me.adding
// marks the in-flight adds, keyed by peer id.
me.adding = {};

// F6 + F15: ONE source of truth for a peer's link state, shared by the orb's
// tint (peer.peer_model) and the panel's dots (peer.headsup) so sphere and
// dots always read as the same colour. Hues are tint()'s, frozen at full
// strength (hsl 132/212/48, s .46/.48/.60, l .54) as one hex per kind.
var STATUS_COLORS = { tcp: '#54c069', udp: '#5186c2', relay: '#d0b443', down: '#9e9e9e' };
document.body.peerstatus = function(p, now){
  p = p || {};
  if (!now) now = Date.now();
  var kind = p.tcp ? 'tcp' : p.udp ? 'udp' : (p.relay || p.connected) ? 'relay' : 'down';
  var age = p.last_contact ? Math.max(0, now - p.last_contact) : Infinity;
  var f = 0;
  if (isFinite(age)) {
    if (age <= 30000) f = 1;
    else if (age < 900000) f = 1 - (age - 30000) / (900000 - 30000);
  }
  var dots = kind == 'down' ? 0 : age <= 30000 ? 3 : age <= 300000 ? 2 : 1;
  return { kind: kind, color: STATUS_COLORS[kind], freshness: f, dots: dots };
};

me.uiReady = function(ui){
  me.ui = ui;
  ME.querySelector('.wrap').style.display = 'block';
  ui.initNavbar(ME);
  ui.initPopups(ME);
};

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

function syncPeerData(){
  // Each orb drives its own physics now. The feed's job is just to keep each
  // orb's data record fresh (display name, transport, last-contact) so its
  // tint and label stay honest — and to add/remove instances as peers arrive
  // and leave (syncPeers).
  var list = peerList();
  for (var i in list) {
    var p = list[i];
    var inst = me.host && me.host.byId && me.host.byId(p.id);
    if (inst) inst.me.data = p;
  }
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
    if (!el || !el.isConnected) { stopHudWatch(); return; }
    if (el.getAnimations && el.getAnimations().length > 0) return;
    if (getComputedStyle(el).display == 'none' || el.offsetWidth < 40) {
      stopHudWatch();
    }
  }, 150);
}
function stopHudWatch(){
  if (hudWatch) { clearInterval(hudWatch); hudWatch = null; }
}

me.ready = function(){
  // The 3D constellation is hosted by app:scenehost. This control is the
  // front-end: it hosts the canvas + the other UI and ADDs a peer_model
  // instance per peer (the host's call). Each orb's own render behavior drives
  // its physics (force on itself from its siblings); each orb's click opens
  // its headsup. No declarative each-mount, no host-side sim.
  installControl(ME.querySelector('.viewer'), 'app', 'scenehost', function(api){
    me.host = api;
    api.waitReady(function(){
      api.hostData = { onFocus: onSceneFocus };
      syncPeers();
      startFeed();
    });
  }, {});

  subscribe_event("peer", "UPDATE", function(data){
    var found = false;
    for (var i in me.peers) {
      if (me.peers[i].id == data.id) { me.peers[i] = data; found = true; }
    }
    if (!found) me.peers.push(data);
    upsertPeerDiv(data);
    syncPeers();
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

      syncPeers();
      startFeed();
    });
  });
};

// Add a peer_model instance per connected peer; remove the ones that left.
// The host's call — each orb then drives itself (physics, tint, label, click).
function syncPeers(){
  if (!me.host) return;
  var want = {};
  var list = peerList();
  for (var i in list) {
    var p = list[i];
    // no self-orb: your own position carries no information
    if (me.info && p.id == me.info.uuid) continue;
    want[p.id] = p;
    // F4: skip a peer whose orb exists OR whose add is still in flight
    if (!me.adding[p.id] && (!me.host.byId || !me.host.byId(p.id))) addPeerOrb(p);
  }
  for (var k = me.host.children.length - 1; k >= 0; k--) {
    var inst = me.host.children[k];
    // F4: an in-flight add is not a leftover — its settle handler decides
    if (!want[inst.key] && !me.adding[inst.key]) me.host.removeControl(inst.key);
  }
}

// F4: one guarded add per peer. The flag clears when the host's promise
// settles (success or failure); a peer that left while its add was in
// flight is removed straight away.
function addPeerOrb(p){
  var id = p.id;
  me.adding[id] = true;
  function settled(added){
    delete me.adding[id];
    if (!added) return;
    var gone = !getByProperty(peerList(), 'id', id) || (me.info && id == me.info.uuid);
    if (gone && me.host.byId && me.host.byId(id)) me.host.removeControl(id);
  }
  try {
    var pr = me.host.addControl('peer', 'peer_model', p, id);
    if (pr && pr.then) pr.then(function(){ settled(true); }, function(){ settled(false); });
    else settled(true);
  } catch (x) {
    settled(false);
  }
}

// The feed loop: layout + push every FEED_MS (10Hz). The constellation's
// position ease is {ms:100, curve:linear} — matched to THIS interval so
// waypoints chain into continuous motion (change one, change both; an
// ease shorter than the interval reads as spurts, longer causes snaps).
// SETTLE-AND-SLEEP: molecules come to rest — when kinetic energy stays
// under epsilon the loop stops entirely (true stillness, zero traffic);
// any UPDATE event wakes it. Starts once BOTH the player and the local
// info are ready.
var FEED_MS = 500;   // slow data-sync cadence — orbs drive their own physics
function feedTick(){
  syncPeers();
  syncPeerData();
  // orbs drive their own physics, so the feed's only settle is "nothing to do"
  // — keep a slow cadence to catch tints advancing as last-contact recedes.
}
function startFeed(){
  if (me.feed || !me.host || !me.info) return;
  feedTick();
  if (!me.feed) me.feed = setInterval(feedTick, FEED_MS);
  startPoll();
}

// F6: me.peers only changed on UPDATE events, so a quiet-but-connected peer's
// last_contact never advanced and its orb faded to grey. Re-read the peer list
// every 10 s — upsertPeerDiv refreshes the hidden data divs (headsup reads
// them) and the feed loop's syncPeerData pushes the records into the orbs.
// Never faster than 10 s; the timer stops itself once the control is gone.
var POLL_MS = 10000;
function startPoll(){
  if (me.poll) return;
  me.poll = setInterval(function(){
    if (!ME.isConnected) { clearInterval(me.poll); me.poll = null; return; }
    send_peers(function(result){
      if (result.status != 'ok' || !result.data) return;
      me.peers = [];
      for (var i in result.data) {
        me.peers.push(result.data[i]);
        upsertPeerDiv(result.data[i]);
      }
    });
  }, POLL_MS);
}

function wakeFeed(){
  startFeed();
}

ME.querySelector('.updateallpeersbutton').addEventListener('click', function(){
  // local crate versions first: the rows' crate-diff chips compare against them
  json('../dev/crate_versions', null, function(r){ me.localcrates = r; buildUpdateDialog(); });
});

function buildUpdateDialog(){
  // F3: peer display names are untrusted — the static table shell is literal
  // HTML, every row is built with DOM calls and textContent.
  var el = ME.querySelector('.peerupdatelist');
  el.innerHTML = '<table cellpadding="10px" class="updateablepeerstable"><thead><tr><th><label class="plaincheckbox"><input type="checkbox" class="toggleallupdates"><span></span></label></th><th style="text-align:left;">Peer</th><th style="text-align:left;">Available Updates</th></tr></thead><tbody></tbody></table>';
  var tbody = el.querySelector('tbody');
  // F10: rows still checking — when the last one resolves and none is left,
  // the dialog says so (checkDone) instead of sitting there as an empty table.
  me.upPending = 0;
  for (var i in me.peers) {
    var p = me.peers[i];
    if (p.connected) {
      var uuid = p.id;
      var tr = document.createElement('tr');
      tr.className = 'uprow r_' + uuid;
      tr.dataset.peer = uuid;
      var td = document.createElement('td');
      td.innerHTML = '<label class="plaincheckbox"><input type="checkbox" class="libupdate"><span></span></label>';
      tr.appendChild(td);
      td = document.createElement('td');
      td.textContent = p.name;
      var sub = document.createElement('div');
      sub.style.fontSize = 'x-small';
      sub.textContent = uuid;
      td.appendChild(sub);
      tr.appendChild(td);
      td = document.createElement('td');
      td.className = 'rowstatus';
      td.innerHTML = '<i>pending...</i>';
      tr.appendChild(td);
      tbody.appendChild(tr);
      me.upPending++;
      checkForUpdates(p);
    }
  }
  if (me.upPending == 0) { me.upPending = 1; checkDone(); }
  el.querySelector('.toggleallupdates').addEventListener('click', function(){
    var b = this.checked;
    el.querySelectorAll('.libupdate').forEach(function(box){ box.checked = b; });
  });
}

// F3 helper: the chips' close button, shared by every chip builder below.
function chipCloseImg(){
  var x = document.createElement('img');
  x.src = '../app/asset/app/icons/ui/dark/close.svg';
  x.className = 'roundbutton-small removeupdate mdl-chip__action chipbutton';
  return x;
}

// F5: the words for a refused or failed peer call — shared with the F10
// update-flow rewrite (session 2), so keep it a tiny helper. 'Unauthorized'
// is Alex's exact word for a refusal.
function peerErrorText(result){
  // the peer proxy suffixes the refused command ('UNAUTHORIZED: libs'), so
  // any UNAUTHORIZED-prefixed msg is the same refusal
  var msg = result && result.msg ? String(result.msg) : '';
  if (msg == 'UNAUTHORIZED' || msg.indexOf('UNAUTHORIZED') == 0) return 'Unauthorized';
  return 'Error: ' + (msg ? msg : 'no reply');
}
// Session 2 (F8/F11): headsup shows the same words — published the way
// peerstatus is, so both controls keep one vocabulary.
document.body.peerErrorText = peerErrorText;

// F12: the old author/authorkey gate was disabled (if (true)) — Marc may have
// done that on purpose, so it stays off. Instead, when BOTH sides carry an
// author and authorkey and they differ, the chip is marked: warning text, a
// title naming who wrote each copy, and it starts DESELECTED (dimmed, left
// out of Update All / Update Selected) until the user clicks it to include
// it. Published for peer.headsup, like peerstatus and peerErrorText.
function applyAuthorWarn(chip, mylib, theirlib){
  var a1 = mylib.author, k1 = mylib.authorkey;
  var a2 = theirlib.author, k2 = theirlib.authorkey;
  if (!(a1 && k1 && a2 && k2)) return;
  if (a1 == a2 && k1 == k2) return;
  chip.classList.add('authwarn');
  chip.dataset.included = '0';
  chip.style.opacity = '0.45';
  // F3: author names are untrusted — a title is a plain attribute, never markup
  chip.title = 'Different author — local copy by ' + a1 + ', peer\'s copy by ' + a2 + '. Click to include this update anyway.';
  var w = document.createElement('span');
  w.className = 'authwarntext';
  w.style.color = '#b26a00';
  // 3b: the chip is a flex row — a flex item's leading space is trimmed (it
  // rendered as '17⚠'), so the gap is a margin instead of a space.
  w.style.marginLeft = '6px';
  w.textContent = '⚠ different author';
  var x = chip.querySelector('.removeupdate');
  if (x) chip.insertBefore(w, x); else chip.appendChild(w);
  chip.addEventListener('click', function(ev){
    if (ev.target.closest && ev.target.closest('.removeupdate, .chipretry')) return;
    var inc = chip.dataset.included == '1';
    chip.dataset.included = inc ? '0' : '1';
    chip.style.opacity = inc ? '0.45' : '1';
  });
}
document.body.peerAuthorWarn = applyAuthorWarn;

// F10: ONE updater behind both update flows — the Update Peers dialog's rows
// and the panel's "can be updated" list. Installs run in the order the chips
// are shown (shift, never pop) and the chip of the library ACTUALLY being
// installed is the one marked. A failure turns its own chip red (textContent),
// grows a Retry link, and never stops the rest. After the libraries, a crates
// item replaces the recompile (the crate runner rebuilds+recompiles itself);
// otherwise one compile_rust runs when any install answered data:true, and
// its failure is an error, not a silent success. One run per peer at a time —
// a second start for a running peer is ignored (run() answers false).
var updaterRuns = {};
document.body.peerupdater = {
  running: function(peerId){ return !!updaterRuns[peerId]; },
  run: function(peerId, items, hooks, skipped){
    if (updaterRuns[peerId]) return false;
    updaterRuns[peerId] = true;
    hooks = hooks || {};
    var lp = document.querySelector('.localpeerid');
    var myuuid = me.info ? me.info.uuid : (lp ? lp.textContent : '');
    var libs = [], cratesItem = null;
    (items || []).forEach(function(it){
      if (it && it.crates) cratesItem = it;
      else if (it && it.lib) libs.push(it);
    });
    var sum = { updated: 0, failed: 0, skipped: skipped > 0 ? skipped : 0, crates: null, recompile: null, recompile_msg: '' };
    var needRecompile = false;

    function call(h, a, b){ try { if (hooks[h]) hooks[h](a, b); } catch (x) { console.error(x); } }
    function chipStart(it){
      var c = it.chipEl;
      if (!c || !c.isConnected) return;
      c.style.color = 'rgba(0,0,0,0.5)';
      var x = c.querySelector('.removeupdate');
      if (x) x.remove();
    }
    function chipDone(it){
      var c = it.chipEl;
      if (!c || !c.isConnected) return;
      c.dataset.done = '1';
      var ok = document.createElement('span');
      ok.style.color = '#2e7d32';
      ok.textContent = ' ✓';
      c.appendChild(ok);
    }
    function chipError(it, text){
      var c = it.chipEl;
      if (!c || !c.isConnected) return;
      // 3b: the chip is a nowrap flex row, so a <br> never broke the line and
      // #b00020 was unreadable on the graphite chip — the error lives on its
      // own wrapped line (.chiperrline, peer.peer css) in a readable red.
      c.classList.add('chiperrored');
      c.style.color = '#ff8a80';
      var line = document.createElement('span');
      line.className = 'chiperrline';
      var sp = document.createElement('span');
      sp.className = 'chiperr';
      sp.textContent = text;   // F3: error text is untrusted — never HTML
      var r = document.createElement('a');
      r.className = 'chipretry';
      r.textContent = 'Retry';
      r.style.cursor = 'pointer';
      r.style.textDecoration = 'underline';
      line.appendChild(sp); line.appendChild(r);
      c.appendChild(line);
      r.addEventListener('click', function(ev){
        ev.stopPropagation();
        // 3b: while this peer's run is still going, run() would refuse — do
        // nothing rather than wipe the error off a chip that can't restart.
        // (Single-threaded: past this guard, run() below always starts.)
        if (document.body.peerupdater.running(peerId)) return;
        line.remove();
        c.classList.remove('chiperrored');
        c.style.color = '';
        var again = it.crates ? { crates: it.crates, chipEl: c } : { lib: it.lib, version: it.version, chipEl: c };
        document.body.peerupdater.run(peerId, [again], hooks, sum.skipped);
      });
    }
    function buildText(s){
      var t = '';
      if (s.failed > 0) t = s.updated + ' updated, ' + s.failed + ' failed';
      else if (s.updated > 0) t = 'All updated';
      if (s.crates == 'launched') t += (t ? ' — ' : '') + "crate update launched — open the peer's panel for progress and the restart verdict";
      else if (s.crates == 'failed') t += (t ? ' — ' : '') + 'crate update failed';
      if (s.recompile == 'ok') t += (t ? ' — ' : '') + 'Rust recompiled';
      else if (s.recompile == 'failed') t += (t ? ' — ' : '') + 'recompile failed: ' + s.recompile_msg;
      if (!t) t = 'Nothing to update';
      // 3b: a deselected different-author chip was left out on purpose — the
      // summary says so instead of claiming 'All updated' past it.
      if (s.skipped > 0) t += ' — ' + s.skipped + ' skipped (different author)';
      return t;
    }
    function finish(){
      sum.text = buildText(sum);
      delete updaterRuns[peerId];
      call('onFinish', sum);
    }
    function nextLib(){
      if (libs.length == 0) { afterLibs(); return; }
      var it = libs.shift();
      call('onStart', it);
      chipStart(it);
      json('../peer/remote/'+peerId+'/dev/install_lib', 'uuid='+encodeURIComponent(myuuid)+'&lib='+encodeURIComponent(it.lib), function(result){
        if (result && result.status == 'ok') {
          sum.updated++;
          if (result.data === true) needRecompile = true;
          chipDone(it);
          call('onDone', it);
        }
        else {
          sum.failed++;
          var text = peerErrorText(result);
          chipError(it, text);
          call('onError', it, text);
        }
        nextLib();
      });
    }
    function afterLibs(){
      if (cratesItem) {
        var it = cratesItem;
        call('onStart', it);
        chipStart(it);
        var p = 'flowlang='+encodeURIComponent(it.crates.flowlang)+'&ndata='+encodeURIComponent(it.crates.ndata);
        json('../peer/remote/'+peerId+'/dev/update_crates', p, function(result){
          if (result && result.status == 'ok') { sum.crates = 'launched'; chipDone(it); call('onDone', it); }
          else { sum.crates = 'failed'; var text = peerErrorText(result); chipError(it, text); call('onError', it, text); }
          finish();
        });
      }
      else if (needRecompile) {
        var it = { recompile: true };
        call('onStart', it);
        json('../peer/remote/'+peerId+'/dev/compile_rust', null, function(result){
          if (result && result.status == 'ok') { sum.recompile = 'ok'; call('onDone', it); }
          else {
            sum.recompile = 'failed';
            sum.recompile_msg = result && result.msg ? String(result.msg) : 'no reply';
            call('onError', it, sum.recompile_msg);
          }
          finish();
        });
      }
      else finish();
    }
    nextLib();
    return true;
  }
};

// F5: end a row in its error state — dim red text, checkbox disabled.
function rowError(uuid, text){
  var el = ME.querySelector('.r_'+uuid);
  if (!el) return;
  var status = el.querySelector('.rowstatus');
  status.innerHTML = '';
  var sp = document.createElement('span');
  sp.className = 'rowerror';
  sp.textContent = text;   // F3: error text is untrusted — never HTML
  status.appendChild(sp);
  var box = el.querySelector('.libupdate');
  if (box) { box.checked = false; box.disabled = true; }
}

// F10: one check resolved. When every row has resolved and none remains
// (every connected peer's chips came back empty), say so — the old code
// removed the rows and left a silent empty table.
function checkDone(){
  me.upPending--;
  if (me.upPending > 0) return;
  var list = ME.querySelector('.peerupdatelist');
  if (list && !list.querySelector('.uprow')) list.innerHTML = '<div class="padme"><i>All connected peers are up to date</i></div>';
}

function checkForUpdates(peer) {
  var uuid = peer.id;
  // F5: the local library list may not have landed yet — fetch it first,
  // then compare. Never drop the row silently.
  if (document.body.locallibraries) compareWithPeer();
  else json('../app/libs', null, function(r){
    if (r.status == 'ok' && r.data) document.body.locallibraries = r.data;
    compareWithPeer();
  });

  function compareWithPeer(){
    json('../peer/remote/'+uuid+'/app/libs', null, function(result){
      // F5: a refusal ({status:err, msg:UNAUTHORIZED}) or any other error
      // resolves the row instead of leaving it on pending... forever.
      if (result.status != 'ok' || !result.data) { rowError(uuid, peerErrorText(result)); checkDone(); return; }
      if (!document.body.locallibraries) { rowError(uuid, 'Error: local library list unavailable'); checkDone(); return; }
      // F3: library ids and versions come from the remote peer — chips are
      // built with DOM calls and textContent, never innerHTML.
      var chips = [];
      for (var i in result.data) {
        var theirlib = result.data[i];
        var mylib = getByProperty(document.body.locallibraries, 'id', theirlib.id);
        if (mylib) {
          // F12: the old author gate (if (true) //...) stays off on purpose —
          // a mismatch marks the chip below (applyAuthorWarn) instead of
          // hiding it.
          {
            if (mylib.version > theirlib.version) {
              var chip = document.createElement('span');
              chip.className = 'chip ispos';
              chip.id = 'U_' + mylib.id;
              var click = document.createElement('span');
              click.className = 'clickupdate';
              click.dataset.lib = mylib.id;
              click.dataset.version = mylib.version;
              click.textContent = mylib.id + ' v' + theirlib.version + ' ➤ ' + mylib.version;
              chip.appendChild(click);
              chip.appendChild(chipCloseImg());
              applyAuthorWarn(chip, mylib, theirlib);
              chips.push(chip);
            }
          }
        }
      }
      // crate pins ride the same row: a peer lagging the local flowlang/ndata
      // versions gets a distinct chip (clickcrates, NOT clickupdate - the lib
      // installer must never treat it as a library). A refused crate_versions
      // just leaves the chip out (F5 keeps that).
      json('../peer/remote/'+uuid+'/dev/crate_versions', null, function(cr){
        var lc = me.localcrates;
        if (cr && cr.status == 'ok' && lc && lc.status == 'ok' && (cr.flowlang != lc.flowlang || cr.ndata != lc.ndata)) {
          var chip = document.createElement('span');
          chip.className = 'chip clickcrates';
          chip.dataset.flowlang = lc.flowlang;
          chip.dataset.ndata = lc.ndata;
          chip.textContent = 'crates: flowlang ' + cr.flowlang + ' ➤ ' + lc.flowlang + ' / ndata ' + cr.ndata + ' ➤ ' + lc.ndata;
          chip.appendChild(chipCloseImg());
          chips.push(chip);
        }
        var el = ME.querySelector('.r_'+uuid);
        if (!el) { checkDone(); return; }
        if (chips.length == 0) el.remove();
        else {
          var status = el.querySelector('.rowstatus');
          status.innerHTML = '';
          chips.forEach(function(c){ status.appendChild(c); status.appendChild(document.createTextNode(' ')); });
          el.querySelectorAll('.removeupdate').forEach(function(x){
            x.addEventListener('click', function(){
              this.closest('.chip').remove();
            });
          });
        }
        checkDone();
      });
    });
  }
}

// F10: both flows run through document.body.peerupdater. The button goes
// dark while any selected row runs (a second click, or a second start for a
// peer already running, is ignored); rows never vanish — each keeps its
// chips and shows one summary line that stays until the dialog closes.
ME.querySelector('#updateallpeersnow').addEventListener('click', function(){
  var btn = this;
  if (btn.disabled) return;
  var up = document.body.peerupdater;
  var pending = 0;
  function rowNote(row, text){
    var n = row.querySelector('.rowsummary');
    if (!n) {
      n = document.createElement('div');
      n.className = 'rowsummary';
      row.querySelector('.rowstatus').appendChild(n);
    }
    n.textContent = text;   // F3: summaries carry peer-reported error text
  }
  ME.querySelectorAll('.libupdate').forEach(function(el){
    if (!el.checked || el.disabled) return;
    var row = el.closest('.uprow');
    var peer = row.dataset.peer;
    var items = [];
    var skipped = 0;   // 3b: deselected different-author chips, named in the summary
    row.querySelectorAll('.clickupdate').forEach(function(click){
      var chip = click.closest('.chip');
      if (!chip || chip.dataset.done == '1') return;
      // F12: a different-author chip rides only when the user clicked it in
      if (chip.classList.contains('authwarn') && chip.dataset.included != '1') { skipped++; return; }
      items.push({ lib: click.dataset.lib, version: click.dataset.version, chipEl: chip });
    });
    var cratechip = row.querySelector('.clickcrates');
    if (cratechip && cratechip.dataset.done != '1') {
      items.push({ crates: { flowlang: cratechip.dataset.flowlang, ndata: cratechip.dataset.ndata }, chipEl: cratechip });
    }
    if (items.length == 0) {
      // 3b: a row whose only chips are deselected ⚠ ones runs nothing — say so
      if (skipped > 0) rowNote(row, 'Nothing to update — ' + skipped + ' skipped (different author)');
      return;
    }
    pending++;
    var started = up.run(peer, items, {
      onStart: function(it){
        if (it.recompile) rowNote(row, 'Recompiling Rust...');
        else if (it.crates) rowNote(row, 'Updating platform crates to flowlang ' + it.crates.flowlang + ' / ndata ' + it.crates.ndata + '...');
      },
      onDone: function(it){},
      onError: function(it, text){},
      onFinish: function(summary){
        rowNote(row, summary.text);
        pending--;
        if (pending <= 0) btn.disabled = false;
      }
    }, skipped);
    if (!started) pending--;
  });
  if (pending > 0) btn.disabled = true;
});

ME.querySelector('.addpeerbutton').addEventListener('click', function(){
  json('../peer/discovery', null, function(result){
    me.discovery = result.data;
    // F3: discovery names come from unauthenticated LAN packets — build the
    // rows with DOM calls and textContent, never innerHTML.
    var tbl = document.createElement('table');
    tbl.className = 'lantable';
    var now = new Date().getTime();
    for (sip in result.data) {
      var rds = result.data[sip];
      if (now - rds.time < 30000 && !getByProperty(me.peers, "id", rds.uuid)) {
        var tr = document.createElement('tr');
        tr.className = 'clickme';
        tr.dataset.sip = sip;
        var td = document.createElement('td');
        td.textContent = sip;
        tr.appendChild(td);
        td = document.createElement('td');
        td.textContent = rds.name;
        tr.appendChild(td);
        td = document.createElement('td');
        var sm = document.createElement('span');
        sm.className = 'smalltext';
        sm.textContent = rds.uuid;
        td.appendChild(sm);
        tr.appendChild(td);
        tbl.appendChild(tr);
      }
    }
    var disc = ME.querySelector('.discovered');
    if (tbl.rows.length == 0) disc.innerHTML = '<div class="padme"><i>No new devices found on LAN</i></div>';
    else { disc.innerHTML = ''; disc.appendChild(tbl); }
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
