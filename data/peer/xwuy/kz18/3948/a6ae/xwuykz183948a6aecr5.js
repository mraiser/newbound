var me = this;
var ME = document.getElementById(me.UUID);
// F7: the panel root carries the css scope — .hudpanel hides every .adminonly
// until the remote current_user check earns .isadmin.
ME.classList.add('hudpanel');

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
  initCrates();

  var uuid = ME.DATA.id;
  json('../peer/remote/'+uuid+'/app/libs', null, function(result){
    if (result.data && document.body.locallibraries) {
      var el = ME.querySelector('.upgradelist');
      for (var i in result.data) {
        var theirlib = result.data[i];
        var mylib = getByProperty(document.body.locallibraries, 'id', theirlib.id);
        if (mylib) {
          var author = mylib.author;
          var authorkey = mylib.authorkey;
          if (true) { //(author && authorkey && theirlib.author == author && theirlib.authorkey == authorkey) {
            if (mylib.version > theirlib.version) {
              // F3: library ids and versions come from the remote peer —
              // build the chip with DOM calls and textContent, never innerHTML.
              var chip = document.createElement('span');
              chip.className = 'chip ispos';
              chip.id = 'U_' + mylib.id;
              var click = document.createElement('span');
              click.className = 'clickupdate';
              click.dataset.lib = mylib.id;
              click.dataset.version = mylib.version;
              click.textContent = mylib.id + ' v' + theirlib.version + ' ➤ ' + mylib.version;
              chip.appendChild(click);
              var x = document.createElement('img');
              x.src = '../app/asset/app/icons/ui/dark/close.svg';
              x.className = 'roundbutton-small removeupdate mdl-chip__action chipbutton';
              chip.appendChild(x);

              ME.querySelector('.availableupgrades').style.display = 'block';
              el.appendChild(chip);
              el.appendChild(document.createTextNode(' '));
            }
          }
        }
      }
      el.querySelectorAll('.removeupdate').forEach(function(x){
        x.addEventListener('click', function(){
          this.closest('.chip').remove();
        });
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
    else ME.querySelector('.rp-key').textContent = 'n/a';
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
    if (result.status != 'ok'){
      // F3: result.msg is untrusted — set it as text
      ME.querySelector('.hudapps').textContent = result.msg;
      me.data = { "list": [] };
      // F11: 'NOT FOUND' only means this peer has never shared a control.
      // Any OTHER failure makes adding unsafe (a write would replace a list
      // we never saw), so the menu item goes dark with the reason on it.
      if (result.msg != 'NOT FOUND') disableAddControl(errText(result));
    }
    else {
      me.data = result.data;
      buildControls();
    }
  });
  json('../peer/remote/'+ME.DATA.id+'/app/read', "lib=runtime&id=controls_available", function(result){
    var el = ME.querySelector('.add-control-available');
    if (result.status != 'ok'){
      // F3: result.msg is untrusted — set it as text
      el.textContent = result.msg;
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
  var tab2 = document.querySelector('.navbar-tab2');
  if (tab2) tab2.click();

  var data = me.data;
  var wrap = ME.querySelector('.hudapps');
  wrap.innerHTML = '';

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

    var el = document.createElement('div');
    el.className = 'inline ' + claz;
    wrap.appendChild(el);
    d.peer = ME.DATA.id;
    installControl(el, db, id, function(api){}, d);
  }
}

me.install = function(lib, v, cb) {
  var myuuid = document.querySelector('.localpeerid').textContent;
  var uuid = ME.DATA.id;
  var el = ME.querySelector('#U_'+lib);
  animateTo(el, {width:'100%', height:'60px'}, 300, function(){
    el.insertAdjacentHTML('beforeend', "<div class='progressbar myprogress'></div>");
    document.body.api.ui.initProgress(ME);
    el.querySelector('.myprogress').setProgress('indeterminate');
  });
  var d = 'uuid='+myuuid+'&lib='+lib;
  json('../peer/remote/'+uuid+'/dev/install_lib', d, function(result){
    if (result.status == "ok") {
      recompile = recompile || result.data;
      el.querySelector('.myprogress').setProgress(100);
      animateTo(el, {width:'0px', height:'0px'}, 300, function(){
        el.remove();
      });
      if (cb) cb();
    }
    else {
      var prog = el.querySelector('.myprogress');
      if (prog) prog.remove();
      // F3: result.msg is untrusted — build the error line as text
      var err = document.createElement('div');
      err.className = 'progerr';
      var f = document.createElement('font');
      f.setAttribute('color', 'red');
      f.textContent = 'Error: ' + result.msg;
      err.appendChild(f);
      el.appendChild(err);
    }
  });
}

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
    ME.querySelector('.rp-name').textContent = ME.DATA.name;
    ME.querySelector('.rp-uuid').textContent = ME.DATA.id;
    ME.querySelector('.hud_ipaddr').textContent = ME.DATA.address;
    ME.querySelector('.hud_port').textContent = ME.DATA.p2p_port;
    ME.querySelector('.hud_http_port').textContent = ME.DATA.http_port;
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
    for (var i in ME.DATA.addresses) {
      var a = document.createElement('a');
      a.className = 'chip';
      a.target = '_blank';
      a.href = 'http://' + ME.DATA.addresses[i] + ':' + ME.DATA.http_port + '?session_id=' + ME.DATA.session_id;
      a.textContent = ME.DATA.addresses[i];
      alist.appendChild(a);
      alist.appendChild(document.createTextNode(' '));
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
    var l = ME.DATA.latency ? ME.DATA.latency+'ms' : '--';
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

function updateNext(){
  if (ulist.length > 0) {
    var el = ulist.shift();
    var lib = el[0];
    var v = el[1];
    me.install(lib, v, updateNext);
  }
  else {
    if (recompile){
      recompile = false;
      var uuid = ME.DATA.id;
      ME.querySelector('.upgradelist').innerHTML = "<i>Recompiling Rust...</i>";
      json('../peer/remote/'+uuid+'/dev/compile_rust', null, function(result){
        updateNext();
      });
    }
    else{
      var el = ME.querySelector('.availableupgrades');
      animateTo(el, {opacity:'0'}, 300, function(){
        el.style.display = 'none';
        el.style.opacity = '';
      });
    }
  }
}

var ulist = [];
var recompile = false;
ME.querySelector('.updateall').addEventListener('click', function(){
  ME.querySelector('.updatebuttons').style.display = 'none';
  ulist = [];
  ME.querySelectorAll('.upgradelist .chip').forEach(function(chip){
    var el = chip.querySelector('.clickupdate');
    ulist.push([el.dataset.lib, el.dataset.version]);
  });
  updateNext();
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
    if (r.status != 'ok') { var hc = ME.querySelector('.hudcrates'); if (hc) hc.remove(); return; }
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
