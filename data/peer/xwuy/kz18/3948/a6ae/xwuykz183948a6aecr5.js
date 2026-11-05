var me = this;
var ME = document.getElementById(me.UUID);
// F7: the panel root carries the css scope — .hudpanel hides every .adminonly
// until the remote current_user check earns .isadmin. The host element is
// REUSED across mounts (installControl swaps innerHTML only), so a previous
// peer's verdict must not linger: drop isadmin until this mount earns it.
ME.classList.add('hudpanel');
ME.classList.remove('isadmin');

function animateTo(el, props, ms, cb) {
  var done = function() { for (var k in props) el.style[k] = props[k]; if (cb) cb(); };
  try {
    var anim = el.animate([props], { duration: ms, easing: 'ease' });
    anim.onfinish = done;
  } catch (x) { done(); }
}

me.refresh = function(){
  installControl('#headsupdisplay', 'peer', 'headsup', function(api){}, ME.DATA);
};

me.ready = function(){
  me.check = ME.querySelector('.rp-uuid');
  me.update();
  document.body.api.ui.initNavbar(ME);
  document.body.api.ui.initPopups(ME);
  // Phase 1 review: app.ui puts the ⋮ card at the click point, clamped
  // 10px inside the window, which lands it off the panel's grid. This
  // listener runs after initPopups' (same element, added later), so the
  // card is open and measurable: its right edge goes on the tab bar's
  // right edge, its top just under the ⋮.
  ME.querySelector('.morebutton').addEventListener('click', function(){
    var card = ME.querySelector('.control-settings-popup');
    if (card.style.display == 'none') return;
    var bar = ME.querySelector('.hudtop > .navbar-dark').getBoundingClientRect();
    card.style.left = (bar.right - card.offsetWidth) + 'px';
    card.style.top = (this.getBoundingClientRect().bottom + 4) + 'px';
  });
  initCrates();

  // 1b: remember which tab the user picks, per peer, ON THE HOST element —
  // every refresh swaps the mount's innerHTML but the host div stays, so
  // buildControls can put the user back on the tab they chose. Only the
  // panel's own navbar is bound (the first .navbar-dark in the subtree;
  // dashboard controls mount later, under .hudapps).
  ME.querySelector('.navbar-dark').querySelectorAll('.navbar-tab').forEach(function(t){
    t.addEventListener('click', function(){
      ME.lastTab = this.dataset.id;
      ME.lastTabPeer = ME.DATA.id;
    });
  });

  var uuid = ME.DATA.id;
  json('../peer/remote/'+uuid+'/app/libs', null, function(result){
    if (result.data && document.body.locallibraries) {
      var el = ME.querySelector('.upgradelist');
      // U2: a chip's final form depends on whether THIS machine holds a
      // package for the lib — collect the version-gap pairs, resolve each
      // against peer.peer's shared reader (document.body.peerPackage), then
      // render. When the reader isn't published (the panel mounted outside
      // the peer page) every lib stays "unknown, allow": the panel is
      // usable on its own, exactly as before.
      var pairs = [];
      for (var i in result.data) {
        var theirlib = result.data[i];
        var mylib = getByProperty(document.body.locallibraries, 'id', theirlib.id);
        if (mylib) {
          // F12: the old author gate (if (true) //...) stays off on purpose —
          // a mismatch marks the chip below instead of hiding it.
          if (mylib.version > theirlib.version) pairs.push({ mylib: mylib, theirlib: theirlib });
        }
      }
      function buildChip(pr){
        // F3: library ids and versions come from the remote peer —
        // build the chip with DOM calls and textContent, never innerHTML.
        var chip = document.createElement('span');
        chip.className = 'chip ispos';
        chip.id = 'U_' + pr.mylib.id;
        var click = document.createElement('span');
        click.className = 'clickupdate';
        click.dataset.lib = pr.mylib.id;
        click.dataset.version = pr.mylib.version;
        click.textContent = pr.mylib.id + ' v' + pr.theirlib.version + ' ➤ ' + pr.mylib.version;
        chip.appendChild(click);
        var x = document.createElement('img');
        x.src = '../app/asset/app/icons/ui/dark/close.svg';
        x.className = 'roundbutton-small removeupdate mdl-chip__action chipbutton';
        chip.appendChild(x);
        // F12: published by peer.peer, like peerstatus — mark (and
        // deselect) a different-author chip instead of hiding it.
        if (document.body.peerAuthorWarn) document.body.peerAuthorWarn(chip, pr.mylib, pr.theirlib);
        return chip;
      }
      var chips = new Array(pairs.length);
      var waitPkg = pairs.length;
      function render(){
        ME.querySelector('.availableupgrades').style.display = 'block';
        chips.forEach(function(chip){
          el.appendChild(chip);
          el.appendChild(document.createTextNode(' '));
        });
        el.querySelectorAll('.removeupdate').forEach(function(x){
          x.addEventListener('click', function(){
            this.closest('.chip').remove();
          });
        });
      }
      if (waitPkg > 0) pairs.forEach(function(pr, idx){
        function built(pkg, checked){
          var chip = buildChip(pr);
          if (checked && document.body.peerPkgGate)
            document.body.peerPkgGate(chip, pkg, pr.mylib.id, pr.mylib.version, pr.theirlib.version, ME.DATA.name || 'this peer');
          chips[idx] = chip;
          if (--waitPkg == 0) render();
        }
        if (document.body.peerPackage) document.body.peerPackage(pr.mylib.id, function(pkg){ built(pkg, true); });
        else built(null, false);
      });
    }
  });

  json('../peer/remote/'+ME.DATA.id+'/security/current_user', null, function(result){
    if (result.status == "ok") {
      ME.querySelector('.rp-key').textContent = result.data.groups;
      // F7: one class on the panel root shows EVERY .adminonly element
      // (menu items and the Platform block), not just the first one found.
      if (result.data.groups.indexOf('admin') != -1) ME.classList.add('isadmin');
    }
    // 7.4: 'unknown' is plainer than 'n/a' and matches the — convention
    else ME.querySelector('.rp-key').textContent = 'unknown';
  });

  json('../security/users', null, function(result){
    // A peer that is not (or is no longer) a local user has no record here,
    // and an unauthorized call carries no data at all. Neither is a reason to
    // throw: the exception used to abort this callback and leave the rest of
    // the panel's fields unfilled.
    var u = (result.data || {})[ME.DATA.id];
    var g = u && u.groups && u.groups[0] ? u.groups : 'anonymous';
    ME.querySelector('.rp-lock').textContent = g;
  });

  json('../peer/remote/'+ME.DATA.id+'/app/read', "lib=runtime&id=controls_shared", function(result){
    if (result.status == 'ok'){
      me.data = result.data;
      buildControls();
    }
    else if (result.msg == 'NOT FOUND'){
      // 6b (Marc): 'NOT FOUND' is the default state — this peer has never
      // shared a control — not an error. Render it through buildControls
      // like any other empty list, so both empty cases show the same note
      // and open on the same tab. F11: Add Control stays enabled.
      me.data = { "list": [] };
      buildControls();
    }
    else {
      // F16: failures show the shared wording (errText), as text (F3).
      ME.querySelector('.hudapps').textContent = errText(result);
      me.data = { "list": [] };
      // F11: a failed read makes adding unsafe (a write would replace a
      // list we never saw), so the menu item goes dark with the reason.
      disableAddControl(errText(result));
      // D5: same reason — no edit can be checked against a list we can't read
      var eb = ME.querySelector('.hudeditbutton');
      eb.disabled = true;
      eb.title = 'Editing is unavailable: ' + errText(result);
    }
  });
  json('../peer/remote/'+ME.DATA.id+'/app/read', "lib=runtime&id=controls_available", function(result){
    var el = ME.querySelector('.add-control-available');
    if (result.status != 'ok'){
      // F16: the shared wording (errText), as text (F3)
      el.textContent = errText(result);
    }
    else {
      me.available = result.data;
      // F3: control titles come from the remote peer — build the rows with
      // DOM calls and textContent, never innerHTML.
      var tbl = document.createElement('table');
      tbl.className = 'tablelist';
      for (i in result.data) {
        var rdi = result.data[i];
        if (rdi.title) {
          var tr = document.createElement('tr');
          var td = document.createElement('td');
          td.className = 'add-ctl-item';
          td.dataset.id = i;
          td.textContent = rdi.title;
          tr.appendChild(td);
          tbl.appendChild(tr);
        }
      }
      if (tbl.rows.length == 0) el.innerHTML = '<i>there are no available controls to install on this device</i>';
      else { el.innerHTML = ''; el.appendChild(tbl); }
      el.querySelectorAll('.add-ctl-item').forEach(function(item){
        item.addEventListener('click', function(){
          var d = me.available[this.dataset.id];
          // F11: never write over a list we haven't just seen — a stale or
          // empty me.data would replace the peer's real dashboard. Re-read
          // controls_shared NOW and push onto the fresh list. 'NOT FOUND'
          // means the peer has never shared a control (start empty); any
          // other failure writes nothing and says why in the popup.
          var errEl = ME.querySelector('.add-control-error');
          errEl.textContent = '';
          json('../peer/remote/'+ME.DATA.id+'/app/read', "lib=runtime&id=controls_shared", function(rr){
            var fresh;
            if (rr.status == 'ok') fresh = rr.data && rr.data.list ? rr.data : { "list": [] };
            else if (rr.msg == 'NOT FOUND') fresh = { "list": [] };
            else { errEl.textContent = errText(rr); return; }
            fresh.list.push(d);
            json('../peer/remote/'+ME.DATA.id+'/app/write', "lib=runtime&id=controls_shared&readers=[]&writers=[]&data="+encodeURIComponent(JSON.stringify(fresh)), function(result){
              if (result.status != 'ok') { errEl.textContent = errText(result); return; }
              me.data = fresh;
              me.refresh();
              ME.querySelector('.add-control-popup-close').click();
            });
          });
        });
      });
    }
  });
};

function buildControls(){
  // 1b: the old lookup was document-wide (document.querySelector), so it
  // could click a navbar-tab2 belonging to some other control on the page.
  // Scope it to the panel. And only jump to Dashboard when the user hasn't
  // picked a tab for THIS peer: the host element survives re-mounts (see
  // the F7 note at the top), so the pick recorded on it by the navbar
  // listener in me.ready outlives a refresh — Refresh no longer yanks an
  // Info reader back to Dashboard.
  var want = (ME.lastTabPeer == ME.DATA.id && ME.lastTab) ? ME.lastTab : 'tab2';
  var tab = ME.querySelector('.navbar-dark .navbar-tab[data-id="' + want + '"]');
  if (tab) tab.click();

  var data = me.data;
  var wrap = ME.querySelector('.hudapps');
  wrap.innerHTML = '';

  // 6b (Marc): an empty dashboard is the default state, not an error — say
  // so instead of leaving the tab blank. The peer's name is peer-reported:
  // textContent, never innerHTML (F3). The hint only helps someone who can
  // use the menu, so it carries .adminonly and F7's .isadmin rule decides
  // whether it shows.
  var list = data && data.list ? data.list : [];
  if (list.length == 0){
    var note = document.createElement('div');
    note.className = 'hudapps-empty';
    note.textContent = (ME.DATA.name || 'This peer') + " hasn't shared any controls yet.";
    var hint = document.createElement('div');
    hint.className = 'adminonly';
    hint.textContent = 'Add one with ⋮ → Add Control.';
    note.appendChild(hint);
    wrap.appendChild(note);
    return;
  }

  for (var i in data.list){
    var ctl = data.list[i];
    var id = ctl.type;
    var j = id.indexOf(':');
    var db = j == -1 ? 'newboundpowerstrip' : id.substring(0,j);
    id = j == -1 ? id : id.substring(j+1);
    j = db.indexOf(':');
    var d = j != -1 && db.substring(j+1,1) == '{' ? JSON.parse(db.substring(j+1)) : ctl;
    db = j == -1 ? db : db.substring(0,j);
    var claz = !ctl.big ? 'iconmode' : 'big';

    // D5: the tile's slot (el) sits in a wrapper that is the flex item and
    // the positioned box for the edit overlay — installControl replaces
    // el's children, so the overlay can't live inside el. The wrapper
    // records the tile's index and type, which edit writes check against
    // the fresh list.
    var tw = document.createElement('div');
    tw.className = 'hudtilewrap ' + claz;
    tw.dataset.index = i;
    tw.dataset.type = ctl.type;
    var el = document.createElement('div');
    // D4: .hudtile carries the dashboard layout (css); big/iconmode stay
    // for any control that reads its slot's mode.
    el.className = 'inline hudtile ' + claz;
    tw.appendChild(el);
    wrap.appendChild(tw);
    d.peer = ME.DATA.id;
    installControl(el, db, id, function(api){}, d);
  }
  decorateTiles();
}

// D5: edit mode. Each tile gets an overlay (it swallows clicks, so a tile's
// own buttons — Reboot — can't be pressed while editing) with a bar of
// real buttons: ← → ✕. ✕ asks first, inline in the same bar. Titles and
// the peer name are peer-reported: textContent and setAttribute only (F3).
// Phase 3 review: ← → ✕ as text glyphs rendered as empty boxes in some
// fonts, so the move bar uses the kit's icons (an icon name instead of
// text), drawn like the panel header's ✕ — a 32px round button, 20px glyph.
function tileButton(text, label, cls, fn, icon){
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'hudtile-btn' + (cls ? ' ' + cls : '');
  if (icon) {
    b.classList.add('roundbutton-small-white', 'hudtile-icon');
    var img = document.createElement('img');
    img.src = '../app/asset/app/icons/ui/dark/' + icon + '.svg';
    img.alt = '';
    b.appendChild(img);
  }
  else b.textContent = text;
  b.title = label;
  b.setAttribute('aria-label', label);
  b.addEventListener('click', function(e){ e.stopPropagation(); fn(); });
  return b;
}

function tileTitle(idx, type){
  var it = me.data && me.data.list ? me.data.list[idx] : null;
  return it && it.title ? String(it.title) : String(type);
}

function showMoveBar(bar, idx, type, n){
  var title = tileTitle(idx, type);
  bar.textContent = '';
  var left = tileButton('', 'Move ' + title + ' earlier', '', function(){
    editWrite(idx, type, function(l){ l.splice(idx - 1, 0, l.splice(idx, 1)[0]); });
  }, 'arrow-left');
  left.disabled = idx == 0;
  var right = tileButton('', 'Move ' + title + ' later', 'hudtile-mirror', function(){
    editWrite(idx, type, function(l){ l.splice(idx + 1, 0, l.splice(idx, 1)[0]); });
  }, 'arrow-left');
  right.disabled = idx == n - 1;
  var gap = document.createElement('span');
  gap.className = 'hudtile-gap';
  var x = tileButton('', 'Remove ' + title, 'hudtile-x', function(){ showConfirm(bar, idx, type, n); }, 'close');
  bar.appendChild(left);
  bar.appendChild(right);
  bar.appendChild(gap);
  bar.appendChild(x);
}

function showConfirm(bar, idx, type, n){
  var title = tileTitle(idx, type);
  bar.textContent = '';
  var q = document.createElement('span');
  q.className = 'hudtile-q';
  q.textContent = 'Remove ' + title + ' from ' + (ME.DATA.name || 'this peer') + "'s dashboard?";
  bar.appendChild(q);
  bar.appendChild(tileButton('Remove', 'Remove ' + title, 'hudtile-remove', function(){
    editWrite(idx, type, function(l){ l.splice(idx, 1); });
  }));
  var cancel = tileButton('Cancel', 'Keep ' + title, '', function(){ showMoveBar(bar, idx, type, n); });
  bar.appendChild(cancel);
  cancel.focus();
}

function decorateTiles(){
  ME.querySelectorAll('.hudapps .hudtile-edit').forEach(function(o){ o.remove(); });
  if (!me.editing) return;
  var tiles = ME.querySelectorAll('.hudapps > .hudtilewrap');
  tiles.forEach(function(tw){
    var ov = document.createElement('div');
    ov.className = 'hudtile-edit';
    var bar = document.createElement('div');
    bar.className = 'hudtile-bar';
    ov.appendChild(bar);
    tw.appendChild(ov);
    showMoveBar(bar, Number(tw.dataset.index), tw.dataset.type, tiles.length);
  });
}

// D5 (the F11 rule): never write a list we haven't just seen. Re-read
// controls_shared, check the tile is still the one the user pointed at
// (index AND type), apply the change to the FRESH list, write it back.
// A moved-under-us list writes nothing and rebuilds; a failed read or
// write says why beside Edit and leaves the dashboard as it was.
function editWrite(idx, type, mutate){
  var msg = ME.querySelector('.hudedit-msg');
  msg.textContent = '';
  ME.querySelectorAll('.hudapps .hudtile-edit button, .hudeditbutton').forEach(function(b){ b.disabled = true; });
  function settle(){
    ME.querySelector('.hudeditbutton').disabled = false;
    decorateTiles();
  }
  json('../peer/remote/'+ME.DATA.id+'/app/read', "lib=runtime&id=controls_shared", function(rr){
    var fresh;
    if (rr.status == 'ok') fresh = rr.data && rr.data.list ? rr.data : { "list": [] };
    else if (rr.msg == 'NOT FOUND') fresh = { "list": [] };
    else { msg.textContent = errText(rr); settle(); return; }
    var it = fresh.list[idx];
    if (!it || it.type != type) {
      me.data = fresh;
      ME.querySelector('.hudeditbutton').disabled = false;
      buildControls();
      msg.textContent = 'The dashboard changed. Refreshed it; try again.';
      return;
    }
    mutate(fresh.list);
    json('../peer/remote/'+ME.DATA.id+'/app/write', "lib=runtime&id=controls_shared&readers=[]&writers=[]&data="+encodeURIComponent(JSON.stringify(fresh)), function(result){
      if (result.status != 'ok') { msg.textContent = errText(result); settle(); return; }
      me.data = fresh;
      ME.querySelector('.hudeditbutton').disabled = false;
      buildControls();
    });
  });
}

ME.querySelector('.hudeditbutton').addEventListener('click', function(){
  me.editing = !me.editing;
  this.textContent = me.editing ? 'Done' : 'Edit';
  this.setAttribute('aria-pressed', me.editing ? 'true' : 'false');
  ME.querySelector('.hudedit-msg').textContent = '';
  decorateTiles();
});

// F10: me.install/updateNext are gone — the panel's updates run through the
// shared document.body.peerupdater (see the .updateall handler below).

ME.querySelector('.closehud').addEventListener('click', function(){
  var el = document.getElementById("headsupdisplay");
  animateTo(el, {width:'0px'}, 300, function(){ el.style.display = 'none'; el.innerHTML = ''; });
  var par = ME.parentElement;
  if (par && par.api && par.api.focus) par.api.focus(null);
});

// F5/F8/F11: the words for a refused or failed call. Session 1's helper lives
// in peer.peer (published as document.body.peerErrorText); fall back to the
// same wording when the panel is mounted outside the peer page.
function errText(result){
  var f = document.body.peerErrorText;
  if (f) return f(result);
  var msg = result && result.msg ? String(result.msg) : '';
  if (msg == 'UNAUTHORIZED' || msg.indexOf('UNAUTHORIZED') == 0) return 'Unauthorized';
  return 'Error: ' + (msg ? msg : 'no reply');
}

// F11: the Add Control menu item opens its popup through its data-popup
// attribute (initPopups reads it at click time), so removing the attribute
// IS the disable; the title carries the reason.
function disableAddControl(reason){
  var td = ME.querySelector('.control-settings-popup td[data-popup*="add-control-popup"]');
  if (!td) return;
  td.removeAttribute('data-popup');
  td.classList.add('menuitem-disabled');
  td.title = 'Add Control is unavailable: ' + reason;
}

// F8: Stay connected saves through security/setuser on THIS instance — it is
// our setting for that peer. The record's other fields come fresh from
// security/users (never from ME.DATA) so nothing else gets overwritten; while
// the save is in flight me.update leaves the box alone; a failure reverts the
// box and says why; success re-reads what the server actually holds.
ME.querySelector('#keepalive').addEventListener('change', function(){
  var box = this;
  var want = box.checked;
  var status = ME.querySelector('.keepalive-status');
  status.textContent = '';
  me.keepaliveSaving = true;
  function fail(result){
    box.checked = !want;
    status.textContent = errText(result);
    me.keepaliveSaving = false;
  }
  json('../security/users', null, function(result){
    var u = result.status == 'ok' && result.data ? result.data[ME.DATA.id] : null;
    if (!u) { fail(result.status == 'ok' ? {msg:'no local user record for this peer'} : result); return; }
    var params = 'id=' + encodeURIComponent(ME.DATA.id)
      + '&displayname=' + encodeURIComponent(u.displayname || '')
      + '&password=' + encodeURIComponent(u.password || '')
      + '&groups=' + encodeURIComponent(JSON.stringify(u.groups || []))
      + '&keepalive=' + want
      + '&address=' + (u.address ? encodeURIComponent(u.address) : 'null')
      + '&port=' + (u.port ? encodeURIComponent(u.port) : 'null');
    json('../security/setuser', params, function(r){
      if (r.status != 'ok') { fail(r); return; }
      json('../security/users', null, function(rr){
        var u2 = rr.status == 'ok' && rr.data ? rr.data[ME.DATA.id] : null;
        if (u2) box.checked = (u2.keepalive === true || u2.keepalive === 'true');
        me.keepaliveSaving = false;
      });
    });
  });
});

me.update = function(){
  if (me.check == ME.querySelector('.rp-uuid')) {
    ME.DATA = document.getElementById('peer_'+ME.DATA.id).DATA;
    // F14: BOTH name slots — the headline and the one inside the
    // "libraries on <name> can be updated" sentence.
    ME.querySelectorAll('.rp-name').forEach(function(el){ el.textContent = ME.DATA.name; });
    ME.querySelector('.rp-uuid').textContent = ME.DATA.id;
    // F13: a peer that dialled in has an empty saved address — fall back to
    // the IP the server saw on the wire (remote_address; TCP/UDP only).
    // 7.4: an absent value reads as an em dash, never a bare label
    ME.querySelector('.hud_ipaddr').textContent = ME.DATA.address || ME.DATA.remote_address || '—';
    ME.querySelector('.hud_port').textContent = ME.DATA.p2p_port || '—';
    ME.querySelector('.hud_http_port').textContent = ME.DATA.http_port || '—';
    // F8: keepalive is stored as a string — "false" must not read as ticked;
    // and while a save is in flight, the save owns the box, not this refresh.
    if (!me.keepaliveSaving) {
      var ka = ME.DATA.keepalive;
      ME.querySelector('#keepalive').checked = (ka === true || ka === 'true');
    }

    // F3: addresses are peer-reported — build the chips with DOM calls and
    // textContent, never innerHTML (the href is set as a plain attribute).
    var alist = ME.querySelector('.hud_address_list');
    alist.innerHTML = '';
    // F13: the live connection's IP joins the list when it isn't already there
    var addrs = (ME.DATA.addresses || []).slice();
    if (ME.DATA.remote_address && addrs.indexOf(ME.DATA.remote_address) == -1) addrs.push(ME.DATA.remote_address);
    for (var i in addrs) {
      var a = document.createElement('a');
      a.className = 'chip';
      a.target = '_blank';
      a.href = 'http://' + addrs[i] + ':' + ME.DATA.http_port + '?session_id=' + ME.DATA.session_id;
      a.textContent = addrs[i];
      alist.appendChild(a);
      alist.appendChild(document.createTextNode(' '));
    }

    // 7.5: the bare ⋯ says what it opens, and a dim +N beside the IP says
    // the peer reported more than the one address shown.
    ME.querySelector('.addressexpandbutton').title = 'Show all addresses (' + addrs.length + ')';
    var cnt = ME.querySelector('.hud_addr_count');
    if (cnt) {
      if (addrs.length > 1) { cnt.textContent = '+' + (addrs.length - 1); cnt.classList.remove('hideme'); }
      else { cnt.textContent = ''; cnt.classList.add('hideme'); }
    }

    // F15: all three dots share the orb's colour verdict (document.body.peerstatus
    // from peer.peer): the first `dots` are lit, the rest keep a faint outline in
    // the same colour; down fills all three grey. Hover says kind + last check.
    var ps = document.body.peerstatus;
    var st = ps ? ps(ME.DATA, Date.now()) : null;
    var inds = ME.querySelectorAll('.connectionindicator');
    if (st) {
      for (var di = 0; di < inds.length; di++) {
        var lit = st.kind == 'down' || di < st.dots;
        inds[di].style.backgroundColor = lit ? st.color : 'transparent';
        inds[di].style.border = '1px solid ' + (lit ? st.color : st.color + '66');
      }
      var labels = { tcp: 'TCP', udp: 'UDP', relay: 'Relay', down: 'Disconnected' };
      var ago = ME.DATA.last_contact ? Math.max(0, Date.now() - ME.DATA.last_contact) : -1;
      var agoTxt = ago < 0 ? 'unknown' : ago < 60000 ? Math.round(ago/1000) + ' s ago'
        : ago < 3600000 ? Math.round(ago/60000) + ' min ago' : Math.round(ago/3600000) + ' h ago';
      inds[0].parentElement.title = labels[st.kind] + ' · last check ' + agoTxt;
    }
    else {
      // peerstatus not published (panel mounted outside the peer page): the
      // legacy single dot, with the invalid 'ccc' fixed to '#ccc'.
      var c = ME.DATA.tcp ? '#84bd00' : ME.DATA.udp ? '#00f' : ME.DATA.connected ? '#ff0' : '#ccc';
      inds[0].style.backgroundColor = c;
    }
    // F15 follow-up (Phase 1 review): a down peer's last measured latency is
    // stale — show an em dash under the grey dots until the link is back.
    var isdown = st ? st.kind == 'down' : !(ME.DATA.tcp || ME.DATA.udp || ME.DATA.connected);
    var l = isdown ? '—' : ME.DATA.latency ? ME.DATA.latency+'ms' : '--';
    ME.querySelector('.connectionlatency').textContent = l;

    setTimeout(me.update, 3000);
  }
};

ME.querySelector('.addressexpandbutton').addEventListener('click', function(){
  this.style.display = 'none';
  ME.querySelector('.closeaddressbutton').style.display = 'inline-block';
  ME.querySelector('.addressexpand').style.display = 'block';
});

ME.querySelector('.closeaddressbutton').addEventListener('click', function(){
  this.style.display = 'none';
  ME.querySelector('.addressexpandbutton').style.display = 'inline-block';
  ME.querySelector('.addressexpand').style.display = 'none';
});

ME.querySelector('.cancelupdateall').addEventListener('click', function(){
  ME.querySelector('.availableupgrades').style.display = 'none';
});

// F10: the panel's chain runs through the shared updater in peer.peer
// (document.body.peerupdater): a failure marks its own chip with Retry and
// the rest still install; the recompile result shows instead of a silent
// fade-out; the section stays visible with one summary line, and the
// Update All / Cancel buttons come back when the run ends.
function upgradeSummary(text){
  var el = ME.querySelector('.upgradesummary');
  if (!el) {
    el = document.createElement('div');
    el.className = 'upgradesummary';
    ME.querySelector('.availableupgrades').insertBefore(el, ME.querySelector('.updatebuttons'));
  }
  el.textContent = text;   // F3: summaries carry peer-reported error text
}
ME.querySelector('.updateall').addEventListener('click', function(){
  var up = document.body.peerupdater;
  if (!up || up.running(ME.DATA.id)) return;
  var items = [];
  var skipped = 0;   // 3b: deselected different-author chips, named in the summary
  var nopkg = 0;     // U2: chips this machine has no package for — never sent
  ME.querySelectorAll('.upgradelist .chip').forEach(function(chip){
    var el = chip.querySelector('.clickupdate');
    if (!el || chip.dataset.done == '1') return;
    // U2: no package behind the chip — nothing to send, count it instead
    if (chip.classList.contains('nopkg')) { nopkg++; return; }
    // F12: a different-author chip rides only when the user clicked it in
    if (chip.classList.contains('authwarn') && chip.dataset.included != '1') { skipped++; return; }
    items.push({ lib: el.dataset.lib, version: el.dataset.version, chipEl: chip });
  });
  if (items.length == 0) {
    upgradeSummary('Nothing to update'
      + (skipped > 0 ? ' — ' + skipped + ' skipped (different author)' : '')
      + (nopkg > 0 ? ' — ' + nopkg + ' not packaged on this machine' : ''));
    return;
  }
  var buttons = ME.querySelector('.updatebuttons');
  buttons.style.display = 'none';
  up.run(ME.DATA.id, items, {
    onStart: function(it){ if (it.recompile) upgradeSummary('Recompiling Rust...'); },
    onDone: function(it){},
    onError: function(it, text){},
    onFinish: function(summary){
      upgradeSummary(summary.text);
      buttons.style.display = '';
    }
  }, skipped, nopkg);
});

ME.querySelector('.control-settings-popup').addEventListener("mouseleave", function(){
  this.style.display = 'none';
});

ME.querySelector('.refreshhud').addEventListener("click", me.refresh);

ME.querySelector('.closeonclick').addEventListener("click", function(){
  ME.querySelector('.control-settings-popup').style.display = 'none';
});

// --- Platform crate versions on the remote peer (crate-update feature) ---
function initCrates(){
  var uuid = ME.DATA.id;
  json('../peer/remote/'+uuid+'/dev/crate_versions', null, function(r){
    // 7c: .hudcrates marks each of the flattened Platform grid items now
    if (r.status != 'ok') { ME.querySelectorAll('.hudcrates').forEach(function(hc){ hc.remove(); }); return; }
    me.remotecrates = r;
    var s = 'flowlang ' + r.flowlang + ' / ndata ' + r.ndata + (r.mismatch ? ' (MANIFESTS DISAGREE)' : '');
    ME.querySelector('.hud_crates').textContent = s;
    json('../dev/crate_versions', null, function(mine){
      if (mine.status != 'ok') return;
      ME.querySelector('.hud_flowlang').value = mine.flowlang;
      ME.querySelector('.hud_ndata').value = mine.ndata;
      if (mine.flowlang != r.flowlang || mine.ndata != r.ndata) {
        ME.querySelector('.hud_crates').insertAdjacentHTML('beforeend', ' <span class="chip ispos">local: flowlang '+mine.flowlang+' / ndata '+mine.ndata+'</span>');
      }
    });
  });
  json('../peer/remote/'+uuid+'/dev/update_crates_status', null, function(r){
    if (r.state == 'running') pollRemoteCrates();
  });
}

function pollRemoteCrates(){
  var uuid = ME.DATA.id;
  var d = ME.querySelector('.hudcratestatus');
  d.style.display = 'block';
  if (me.cratePoll) clearInterval(me.cratePoll);
  me.cratePoll = setInterval(function(){
    // same liveness idiom as me.update: a torn-down panel stops polling
    if (me.check != ME.querySelector('.rp-uuid')) { clearInterval(me.cratePoll); return; }
    json('../peer/remote/'+uuid+'/dev/update_crates_status', null, function(r){
      var s = r.state + ' — step ' + (r.step||0) + '/' + (r.steps||4) + ' ' + (r.label||'');
      if (r.state == 'done') s += ' — verdict: ' + r.verdict;
      d.textContent = s;
      if (r.state != 'running') {
        clearInterval(me.cratePoll);
        if (r.state == 'done' && r.verdict == 'restart') ME.querySelector('.hudcraterestart').style.display = 'inline-block';
      }
    });
  }, 3000);
}

ME.querySelector('.hudcrateupdate').addEventListener('click', function(){
  var uuid = ME.DATA.id;
  var fl = ME.querySelector('.hud_flowlang').value.trim();
  var nd = ME.querySelector('.hud_ndata').value.trim();
  if (!fl || !nd) { alert('Enter both crate versions.'); return; }
  if (!confirm('Pin flowlang '+fl+' / ndata '+nd+' on '+ME.DATA.name+' and rebuild its whole platform? This takes several minutes.')) return;
  json('../peer/remote/'+uuid+'/dev/update_crates', 'flowlang='+encodeURIComponent(fl)+'&ndata='+encodeURIComponent(nd), function(r){
    var d = ME.querySelector('.hudcratestatus');
    d.style.display = 'block';
    d.textContent = r.msg || 'launched';
    if (r.status == 'ok') pollRemoteCrates();
  });
});

ME.querySelector('.hudcratehardreset').addEventListener('click', function(){
  var uuid = ME.DATA.id;
  if (!confirm('HARD RESET '+ME.DATA.name+': re-clone canon newbound from GitHub over that instance (platform sources and core store), rebuild everything, and restart it when done. Its local libraries are untouched. This takes several minutes. Continue?')) return;
  json('../peer/remote/'+uuid+'/dev/hard_reset', 'url=', function(r){
    var d = ME.querySelector('.hudcratestatus');
    d.style.display = 'block';
    d.textContent = r.msg || 'launched';
    if (r.status == 'ok') pollRemoteCrates();
  });
});

ME.querySelector('.hudcraterestart').addEventListener('click', function(){
  var uuid = ME.DATA.id;
  if (!confirm('Restart the Newbound instance on '+ME.DATA.name+'?')) return;
  json('../peer/remote/'+uuid+'/dev/restart_instance', null, function(r){
    var d = ME.querySelector('.hudcratestatus');
    d.style.display = 'block';
    d.textContent = r.msg || 'restart requested';
    ME.querySelector('.hudcraterestart').style.display = 'none';
  });
});
