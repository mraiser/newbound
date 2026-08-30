var me = this;
var ME = $('#'+me.UUID)[0];

me.refresh = function(){
  installControl('#headsupdisplay', 'peer', 'headsup', function(api){}, ME.DATA);
};

me.ready = function(){
  me.check = $(ME).find('.rp-uuid')[0];
  me.update();
  document.body.api.ui.initNavbar(ME);
  document.body.api.ui.initPopups(ME);
  initCrates();
  
  var uuid = ME.DATA.id;
  json('../peer/remote/'+uuid+'/app/libs', null, function(result){
    if (result.data && document.body.locallibraries) {
      var el = $(ME).find('.upgradelist');
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

              $(ME).find('.availableupgrades').css('display', 'block');
              el.append(newhtml);
            }
          }
        }
      }
      el.find('.removeupdate').click(function(){
        $(this).closest('.chip').remove();
      });
    }
  });
  
  json('../peer/remote/'+ME.DATA.id+'/security/current_user', null, function(result){
    if (result.status == "ok") { 
      $(ME).find('.rp-key').text(result.data.groups);
      if (result.data.groups.indexOf('admin') != -1) $(ME).find('.adminonly').css('display', 'block');
    }
    else $(ME).find('.rp-key').text('n/a');
  });

  json('../security/users', null, function(result){
    // A peer that is not (or is no longer) a local user has no record here,
    // and an unauthorized call carries no data at all. Neither is a reason to
    // throw: the exception used to abort this callback and leave the rest of
    // the panel's fields unfilled.
    var u = (result.data || {})[ME.DATA.id];
    var g = u && u.groups && u.groups[0] ? u.groups : 'anonymous';
    $(ME).find('.rp-lock').text(g);
  });  
  
  json('../peer/remote/'+ME.DATA.id+'/app/read', "lib=runtime&id=controls_shared", function(result){
    if (result.status != 'ok'){
      $(ME).find('.hudapps').html(result.msg);
      me.data = { "list": [] };
    }
    else {
      me.data = result.data;
      buildControls();
    }
  });
  json('../peer/remote/'+ME.DATA.id+'/app/read', "lib=runtime&id=controls_available", function(result){
    var el = $(ME).find('.add-control-available');
    if (result.status != 'ok'){
      el.html(result.msg);
    }
    else {
      me.available = result.data;
      var newhtml = '';
      for (i in result.data) {
        var rdi = result.data[i];
        if (rdi.title) {
          newhtml += '<tr><td class="add-ctl-item" data-id="'+i+'">'+rdi.title+'</tr></td>';;
        }
      }
      if (newhtml == '') newhtml = '<i>there are no available controls to install on this device</i>';
      else newhtml = '<table class="tablelist">' + newhtml + '</table>';
      el.html(newhtml).find('.add-ctl-item').click(function(){
        var d = me.available[$(this).data('id')];
        me.data.list.push(d);
        json('../peer/remote/'+ME.DATA.id+'/app/write', "lib=runtime&id=controls_shared&readers=[]&writers=[]&data="+encodeURIComponent(JSON.stringify(me.data)), function(result){
          me.refresh();
          $(ME).find('.add-control-popup-close').click();
        });
      });
    }
  });
};

function buildControls(){
  $('.navbar-tab2').click();

  var data = me.data;
  var wrap = $(ME).find('.hudapps');
  wrap.empty();

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

    var el = $('<div class="inline '+claz+'"></div>')[0];
    wrap.append(el);
    d.peer = ME.DATA.id;
    installControl(el, db, id, function(api){}, d);
  }
}

me.install = function(lib, v, cb) {
  var myuuid = $('.localpeerid').text();
  var uuid = ME.DATA.id;
  var el = $(ME).find('#U_'+lib);
  el.animate({'width':'100%','height':'60px'},300, function(){
    el.append("<div class='progressbar myprogress'></div>");
    document.body.api.ui.initProgress(ME);
    el.find('.myprogress')[0].setProgress('indeterminate');
  });
  var d = 'uuid='+myuuid+'&lib='+lib;
  json('../peer/remote/'+uuid+'/dev/install_lib', d, function(result){
    if (result.status == "ok") {
      recompile = recompile || result.data;
      el.find('.myprogress')[0].setProgress(100);
      el.animate({'width':'0px','height':'0px'},300, function(){
        el.remove();
      });
      if (cb) cb();
    }
    else {
      el.find('.myprogress').remove();
      el.append("<div class='progerr'><font color='red'>Error: "+result.msg+"</font></div>");
    }
  });
}

$(ME).find('.closehud').click(function(){
  var el = $("#headsupdisplay");
  el.animate({width:0}, 300, function(){ el.css('display', 'none').html(''); });
  $(ME).parent()[0].api.focus(null);
});

me.update = function(){
  if (me.check == $(ME).find('.rp-uuid')[0]) {
    ME.DATA = $('#peer_'+ME.DATA.id)[0].DATA;
    $(ME).find('.rp-name').text(ME.DATA.name);
    $(ME).find('.rp-uuid').text(ME.DATA.id);
    $(ME).find('.hud_ipaddr').text(ME.DATA.address);
    $(ME).find('.hud_port').text(ME.DATA.p2p_port);
    $(ME).find('.hud_http_port').text(ME.DATA.http_port);
    $(ME).find('#keepalive').prop('checked', ME.DATA.keepalive);
    
    var newhtml = '';
    for (var i in ME.DATA.addresses) {
      newhtml += '<a class="chip" target="_blank" href="http://'+ME.DATA.addresses[i]+':'+ME.DATA.http_port+'?session_id='+ME.DATA.session_id+'">'+ME.DATA.addresses[i]+'</a>&nbsp;'
    }
    $(ME).find('.hud_address_list').html(newhtml);

    var c = ME.DATA.tcp ? '#84bd00' : ME.DATA.udp ? '#00f' : ME.DATA.connected ? '#ff0' : 'ccc';
    $(ME).find('.connectionindicator').css('background-color', c);
    var l = ME.DATA.latency ? ME.DATA.latency+'ms' : '--';
    $(ME).find('.connectionlatency').text(l);
    
    setTimeout(me.update, 3000);
  }
};

$(ME).find('.addressexpandbutton').click(function(){
  $(this).css('display', 'none');
  $(ME).find('.closeaddressbutton').css('display', 'inline-block');
  $(ME).find('.addressexpand').css('display', 'block');
});

$(ME).find('.closeaddressbutton').click(function(){
  $(this).css('display', 'none');
  $(ME).find('.addressexpandbutton').css('display', 'inline-block');
  $(ME).find('.addressexpand').css('display', 'none');
});

$(ME).find('.cancelupdateall').click(function(){
  $(ME).find('.availableupgrades').css('display', 'none');
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
      $(ME).find('.upgradelist').html("<i>Recompiling Rust...</i>");
      json('../peer/remote/'+uuid+'/dev/compile_rust', null, function(result){
        updateNext();
      });
    }
    else{
      $(ME).find('.availableupgrades').animate({"opacity":0},300, function(){
        $(this).css('display', 'none').css('opacity', '100%');
      });
    }
  }
}

var ulist = [];
var recompile = false;
$(ME).find('.updateall').click(function(){
  $(ME).find('.updatebuttons').css('display', 'none');
  ulist = [];
  $(ME).find('.upgradelist').find('.chip').each(function(){
    var el = $(this).find('.clickupdate');
    var lib = el.data("lib");
    var v = el.data("version");
    ulist.push([lib,v]);
  });
  updateNext();
});

$(ME).find('.control-settings-popup').on("mouseleave", function(){
  $(this).css('display', 'none');
});

$(ME).find('.refreshhud').on("click", me.refresh);

$(ME).find('.closeonclick').on("click", function(){
  $(ME).find('.control-settings-popup').css('display', 'none');
});

// --- Platform crate versions on the remote peer (crate-update feature) ---
function initCrates(){
  var uuid = ME.DATA.id;
  json('../peer/remote/'+uuid+'/dev/crate_versions', null, function(r){
    if (r.status != 'ok') { $(ME).find('.hudcrates').remove(); return; }
    me.remotecrates = r;
    var s = 'flowlang ' + r.flowlang + ' / ndata ' + r.ndata + (r.mismatch ? ' (MANIFESTS DISAGREE)' : '');
    $(ME).find('.hud_crates').text(s);
    json('../dev/crate_versions', null, function(mine){
      if (mine.status != 'ok') return;
      $(ME).find('.hud_flowlang').val(mine.flowlang);
      $(ME).find('.hud_ndata').val(mine.ndata);
      if (mine.flowlang != r.flowlang || mine.ndata != r.ndata) {
        $(ME).find('.hud_crates').append(' <span class="chip ispos">local: flowlang '+mine.flowlang+' / ndata '+mine.ndata+'</span>');
      }
    });
  });
  json('../peer/remote/'+uuid+'/dev/update_crates_status', null, function(r){
    if (r.state == 'running') pollRemoteCrates();
  });
}

function pollRemoteCrates(){
  var uuid = ME.DATA.id;
  var d = $(ME).find('.hudcratestatus');
  d.css('display','block');
  if (me.cratePoll) clearInterval(me.cratePoll);
  me.cratePoll = setInterval(function(){
    json('../peer/remote/'+uuid+'/dev/update_crates_status', null, function(r){
      var s = r.state + ' — step ' + (r.step||0) + '/4 ' + (r.label||'');
      if (r.state == 'done') s += ' — verdict: ' + r.verdict;
      d.text(s);
      if (r.state != 'running') {
        clearInterval(me.cratePoll);
        if (r.state == 'done' && r.verdict == 'restart') $(ME).find('.hudcraterestart').css('display','inline-block');
      }
    });
  }, 3000);
}

$(ME).find('.hudcrateupdate').click(function(){
  var uuid = ME.DATA.id;
  var fl = $(ME).find('.hud_flowlang').val().trim();
  var nd = $(ME).find('.hud_ndata').val().trim();
  if (!fl || !nd) { alert('Enter both crate versions.'); return; }
  if (!confirm('Pin flowlang '+fl+' / ndata '+nd+' on '+ME.DATA.name+' and rebuild its whole platform? This takes several minutes.')) return;
  json('../peer/remote/'+uuid+'/dev/update_crates', 'flowlang='+encodeURIComponent(fl)+'&ndata='+encodeURIComponent(nd), function(r){
    var d = $(ME).find('.hudcratestatus');
    d.css('display','block').text(r.msg || 'launched');
    if (r.status == 'ok') pollRemoteCrates();
  });
});

$(ME).find('.hudcraterestart').click(function(){
  var uuid = ME.DATA.id;
  if (!confirm('Restart the Newbound instance on '+ME.DATA.name+'?')) return;
  json('../peer/remote/'+uuid+'/dev/restart_instance', null, function(r){
    $(ME).find('.hudcratestatus').css('display','block').text(r.msg || 'restart requested');
    $(ME).find('.hudcraterestart').css('display','none');
  });
});
