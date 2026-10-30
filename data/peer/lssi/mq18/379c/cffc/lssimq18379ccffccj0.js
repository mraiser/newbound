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
    if (!me.host.byId || !me.host.byId(p.id)) me.host.addControl('peer', 'peer_model', p, p.id);
  }
  for (var k = me.host.children.length - 1; k >= 0; k--) {
    var inst = me.host.children[k];
    if (!want[inst.key]) me.host.removeControl(inst.key);
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
      checkForUpdates(p);
    }
  }
  el.querySelector('.toggleallupdates').addEventListener('click', function(){
    var b = this.checked;
    el.querySelectorAll('.libupdate').forEach(function(box){ box.checked = b; });
  });
}

// F3 helper: the chips' close button, shared by every chip builder below.
function chipCloseImg(){
  var x = document.createElement('img');
  x.src = '../app/asset/app/close-white.png';
  x.className = 'roundbutton-small removeupdate mdl-chip__action chipbutton';
  return x;
}

function checkForUpdates(peer) {
  var uuid = peer.id;
  json('../peer/remote/'+uuid+'/app/libs', null, function(result){
    if (result.data && document.body.locallibraries) {
      // F3: library ids and versions come from the remote peer — chips are
      // built with DOM calls and textContent, never innerHTML.
      var chips = [];
      for (var i in result.data) {
        var theirlib = result.data[i];
        var mylib = getByProperty(document.body.locallibraries, 'id', theirlib.id);
        if (mylib) {
          var author = mylib.author;
          var authorkey = mylib.authorkey;
          if (true) { //(author && authorkey && theirlib.author == author && theirlib.authorkey == authorkey) {
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
              chips.push(chip);
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
          var chip = document.createElement('span');
          chip.className = 'chip clickcrates';
          chip.dataset.flowlang = lc.flowlang;
          chip.dataset.ndata = lc.ndata;
          chip.textContent = 'crates: flowlang ' + cr.flowlang + ' ➤ ' + lc.flowlang + ' / ndata ' + cr.ndata + ' ➤ ' + lc.ndata;
          chip.appendChild(chipCloseImg());
          chips.push(chip);
        }
        var el = ME.querySelector('.r_'+uuid);
        if (!el) return;
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
                // F3: result.msg is untrusted — append it as text
                chip.appendChild(document.createElement('br'));
                chip.appendChild(document.createTextNode('Error: ' + result.msg));
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
              var st = row.querySelector('.rowstatus');
              st.innerHTML = '<i></i>';
              st.firstChild.textContent = 'Updating platform crates to flowlang '+fl+' / ndata '+nd+'...';
              json('../peer/remote/'+peer+'/dev/update_crates', 'flowlang='+encodeURIComponent(fl)+'&ndata='+encodeURIComponent(nd), function(result){
                if (result.status == 'ok') row.querySelector('.rowstatus').innerHTML = "<i>crate update launched — open the peer's panel for progress and the restart verdict</i>";
                else {
                  // F3: result.msg is untrusted — set it as text
                  var est = row.querySelector('.rowstatus');
                  est.innerHTML = '<font color="red"></font>';
                  est.firstChild.textContent = 'Error: ' + result.msg;
                }
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
