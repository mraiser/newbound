var me = this;
var ME = document.getElementById(me.UUID);

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

              var newhtml = '<span class="chip ispos" id="U_'+mylib.id+'"><span class="clickupdate" data-lib="'+mylib.id+'" data-version="'+mylib.version+'">'
                + mylib.id
                + ' v'
                + theirlib.version
                + ' ➤ '
                + mylib.version
                + '</span><img src="../app/asset/app/close-white.png" class="roundbutton-small removeupdate mdl-chip__action chipbutton"></span> ';

              ME.querySelector('.availableupgrades').style.display = 'block';
              el.insertAdjacentHTML('beforeend', newhtml);
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
      if (result.data.groups.indexOf('admin') != -1) ME.querySelector('.adminonly').style.display = 'block';
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
      ME.querySelector('.hudapps').innerHTML = result.msg;
      me.data = { "list": [] };
    }
    else {
      me.data = result.data;
      buildControls();
    }
  });
  json('../peer/remote/'+ME.DATA.id+'/app/read', "lib=runtime&id=controls_available", function(result){
    var el = ME.querySelector('.add-control-available');
    if (result.status != 'ok'){
      el.innerHTML = result.msg;
    }
    else {
      me.available = result.data;
      var newhtml = '';
      for (i in result.data) {
        var rdi = result.data[i];
        if (rdi.title) {
          newhtml += '<tr><td class="add-ctl-item" data-id="'+i+'">'+rdi.title+'</tr></td>';
        }
      }
      if (newhtml == '') newhtml = '<i>there are no available controls to install on this device</i>';
      else newhtml = '<table class="tablelist">' + newhtml + '</table>';
      el.innerHTML = newhtml;
      el.querySelectorAll('.add-ctl-item').forEach(function(item){
        item.addEventListener('click', function(){
          var d = me.available[this.dataset.id];
          me.data.list.push(d);
          json('../peer/remote/'+ME.DATA.id+'/app/write', "lib=runtime&id=controls_shared&readers=[]&writers=[]&data="+encodeURIComponent(JSON.stringify(me.data)), function(result){
            me.refresh();
            ME.querySelector('.add-control-popup-close').click();
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
      el.insertAdjacentHTML('beforeend', "<div class='progerr'><font color='red'>Error: "+result.msg+"</font></div>");
    }
  });
}

ME.querySelector('.closehud').addEventListener('click', function(){
  var el = document.getElementById("headsupdisplay");
  animateTo(el, {width:'0px'}, 300, function(){ el.style.display = 'none'; el.innerHTML = ''; });
  var par = ME.parentElement;
  if (par && par.api && par.api.focus) par.api.focus(null);
});

me.update = function(){
  if (me.check == ME.querySelector('.rp-uuid')) {
    ME.DATA = document.getElementById('peer_'+ME.DATA.id).DATA;
    ME.querySelector('.rp-name').textContent = ME.DATA.name;
    ME.querySelector('.rp-uuid').textContent = ME.DATA.id;
    ME.querySelector('.hud_ipaddr').textContent = ME.DATA.address;
    ME.querySelector('.hud_port').textContent = ME.DATA.p2p_port;
    ME.querySelector('.hud_http_port').textContent = ME.DATA.http_port;
    ME.querySelector('#keepalive').checked = !!ME.DATA.keepalive;

    var newhtml = '';
    for (var i in ME.DATA.addresses) {
      newhtml += '<a class="chip" target="_blank" href="http://'+ME.DATA.addresses[i]+':'+ME.DATA.http_port+'?session_id='+ME.DATA.session_id+'">'+ME.DATA.addresses[i]+'</a>&nbsp;'
    }
    ME.querySelector('.hud_address_list').innerHTML = newhtml;

    var c = ME.DATA.tcp ? '#84bd00' : ME.DATA.udp ? '#00f' : ME.DATA.connected ? '#ff0' : 'ccc';
    ME.querySelector('.connectionindicator').style.backgroundColor = c;
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
