var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  $(ME).find('.updatemsg').text('Checking for updates...');
  componentHandler.upgradeAllRegistered();
  
  if (ME.DATA.peer){
    me.peer = ME.DATA.peer;
    me.remote_prefix = '../peerbot/remote/'+me.peer+'/';
  }
  else {
    if (typeof CURRENTDEVICEPREFIX == 'undefined' || CURRENTDEVICEPREFIX == null) me.remote_prefix = '../';
    else {
      me.peer = CURRENTDEVICEID;
      me.remote_prefix = CURRENTDEVICEPREFIX;
    }
  }
    
  $.getJSON(me.remote_prefix+'metabot/libraries', function(result){
  //json(me.remote_prefix+'metabot/libraries', null, function(result){
    if (!result.data){
      $(ME).find('.updatemsg').text('Error: '+result.msg);
      if (ME.DATA.cb) ME.DATA.cb(false, me.peer, me.updates, true, result.msg);
    }
    else {
      if (result.data.data) result.data = result.data.data;
      me.libs = [];
      me.updates = {};
      me.alts = {};
      me.older = {};
      me.same = {};
      for (var i in result.data.list){
        var lib = result.data.list[i];
        if (lib.author) {
          me.libs.push(lib);
          me.updates[lib.id] = { "v":0, "c":lib.version };
          me.alts[lib.id] = {};
          me.older[lib.id] = {};
          me.same[lib.id] = {};
        }
      }

      if (me.remote_prefix == '../'){
        json(me.remote_prefix+'peerbot/connections', null, function(result){
          var peers = [];
          me.peers = result.data;
          for (var i in result.data){
            var p = result.data[i];
            if (p.connected){
              if (p.tcp) peers.unshift(p);
              else peers.push(p);
            }
          }
          query(peers);
        });
      }
      else{
        json('../peerbot/getpeerinfo', null, function(result){
          var uuid = result.id;
          me.peers = {};
          me.peers[uuid] = result;
          json('../metabot/libraries', null, function(result){
            parse(result, uuid);
          });
        });
      }
    }
  }).fail(function(x,y,z) {
    $(ME).find('.updatemsg').text('Error: '+x);
    if (ME.DATA.cb) ME.DATA.cb(true, me.peer, me.updates, true, x);
  });
};

$(document).click(function(event) {
   window.lastElementClicked = event.target;
});

$(ME).find('.updatebutton').click(function(){
  $(this).css('display', 'none');
  $(ME).find('.showupdates').css('display', 'block');
  me.updating = true;
});


function installNext(){
  'use strict';
  $(ME).find('.installupdates').css('display', 'none');
  var y = $(ME).find(':checked').closest('tr').find('.selectedpeer')[0];
  if (y) install(y);
  else {
    $(ME).find('.showupdates').css('display', 'none');
    
    var handler = function(event) {
      'use strict';
      var data = {
        message: 'The remote device is restarting.'
      };
      document.body.api.ui.snackbar(data);
      json(me.remote_prefix+'botmanager/restart', null, function(result){});
    };
    
    var data = {
      message: 'You may need to restart the remote device to see changes',
      timeout: 5000,
      actionHandler: handler,
      actionText: 'restart',
      width:'600px'
    };
    document.body.api.ui.snackbar(data);
  }
}
  
function install(y){
  var lib = $(y).data('lib');
  var peer = $(y).data('peer');
  var td = $(y).closest('tr').find('td')[0];
  var uuid = guid();
  var el1 = $('<span></span>');
  var el2 = $('<div id="a_'+uuid+'" class="libprog progressbar mdl-progress mdl-js-progress mdl-progress__indeterminate"></div>');
  $(y).parent().parent().append(el2[0]);
  td.innerHTML = '<img src="../botmanager/asset/botmanager/download_icon-white.png" class="icon-small-white">';
  $(td).append(el1);
  document.body.api.ui.initProgress($(y).parent().parent());
  el2[0].setProgress('indeterminate');
  
  function error(td, msg){
    $(td).html('');
    el2.html('<font color="red">'+msg+'</font>').removeClass('mdl-progress__indeterminate');
    var but = $('<button class="mdl-button mdl-js-button mdl-js-ripple-effect">try again</button>');
    $(td).append(but);
    componentHandler.upgradeAllRegistered();
    but.click(function(){
      el2.remove();
      install(y);
    });
  }

//  el2[0].addEventListener('mdl-componentupgraded', function() {
    
    var url = document.URL;
    url = url.substring(url.indexOf(':'));
    url = url.substring(0, url.indexOf('/',3));
    url = 'ws'+url+(typeof me.peer == 'string' ? '/peerbot/remote/'+me.peer+'/metabot/index.html' : '/metabot/index.html');

    var connection = new WebSocket(url, ['newbound']);

    connection.onopen = function(){
      console.log('Web Socket to metabot open');

      json(me.remote_prefix+'metabot/installlib', 'guid=a_'+uuid+'&peer='+peer+'&lib='+lib, function(result){
        if (result.status == 'ok'){
          el2[0].setProgress(100);
          $(td).closest('tr').remove();
          connection.close();
          installNext();
        }
        else error(td, result.msg);
      });
    };

    connection.onerror = function(error){
      console.log('Web Socket to metabot error');
    };

    connection.onclose = function(error){
      console.log('Web Socket to metabot close');
    };

    connection.onmessage = function(e){
      console.log(']]]]]]]]]]]]]]]]]]]]]]]]]]');
      console.log(e);
      if (SOCK) SOCK.onmessage(e);
    };
//  });    

  WSCB = function(val){
    if (val.msg) $(y).text(val.msg);
    if (val.percent){
      el2.removeClass('mdl-progress__indeterminate');
      el2[0].setProgress(val.percent);
      el1.text(val.percent+'%');
    }
  };

  componentHandler.upgradeAllRegistered();
}

$(ME).find('.installupdates').click(installNext);


function query(peers){
  if (!me.ucount || me.ucount < peers.length) me.ucount = peers.length;
  if (peers.length>0) {
    $(ME).find('.updatemsg').text('Checking for updates ('+(1 + me.ucount - peers.length)+'/'+me.ucount+')...');
    var peer = peers.shift();
    var p = peer.id;
    json(me.remote_prefix+'peerbot/remote/'+p+'/metabot/libraries', null, function(result){
      parse(result, p);
      query(peers);
    });
  }
}

function parse(result, p){
  if (result.data && result.data.data) result.data = result.data.data;
  var libs = [];
  if (result.data)
  {
    for (var i in result.data.list){
      var rlib = result.data.list[i];
      var llib = getByProperty(me.libs, 'id', rlib.id);
      if (llib){
        if (llib.author != rlib.author) me.alts[llib.id][p] = rlib;
        else{
          var lv = Number(llib.version);
          var rv = Number(rlib.version);
          if (isNaN(lv)) lv = 0;
          if (isNaN(rv)) rv = 0;
          if (lv == rv) me.same[llib.id][p] = rlib;
          else if (lv<rv) {
            var o = me.updates[llib.id];
            o[p] = rlib;
            if (o.v < rv) {
              o.v = rv;
              o.p = p;
            }
          }
          else me.older[llib.id][p] = rlib;
        }
      }
    }
    rebuild();
  }
}

function rebuild(){
  $(ME).find('.updatemsg').text('');
  var newhtml = "<table cellpadding='10' class='mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp uptable'><thead><tr><th><label class='plaincheckbox'><input type='checkbox' class='toggleinstalls'><span></span></label></th><th class='mdl-data-table__cell--non-numeric'>Library</th><th style='text-align:right'>Installed</th><th style='text-align:right'>Available</th><th class='mdl-data-table__cell--non-numeric'>Peer</th></tr></thead><tbody>";

  me.updateable = false;
  for (var i in me.updates){
    var libs =  me.updates[i];
    if (libs.v>0) {
      
      if (!me.updating) {
        $(ME).find('.updatebutton').css('display', 'block');
        me.updateable = true;
      }
      
      var which = null;
      var peers = [];
      var dd = '';
      var n = 0;
      for (var j in libs){
        if (libs[j].version == libs.v) {
          var p = me.peers[j];
          peers.push(p);
          if (which == null) which = libs[j];
          dd += '<li class="mdl-menu__item" data-peer="'+p.id+'">'+p.name+' ('+p.id+')</li>'
          n++;
        }
      }
      
      if (n<2) dd = '';
      else dd = '<button id="peerselect_'+which.id+'" class="mdl-button mdl-js-button mdl-button--icon"><i class="material-icons">arrow_drop_down</i></button><ul class="mdl-menu mdl-menu--bottom-left mdl-js-menu mdl-js-ripple-effect" for="peerselect_'+which.id+'">'+dd+'</ul>';
      
      if (which != null){
        var peer = peers[0];
        newhtml += '<tr>'
          + '<td><label class="plaincheckbox"><input type="checkbox" class="installcheckbox"><span></span></label></td>'
          + '<td class="mdl-data-table__cell--non-numeric">'
          + which.id
          + '</td><td style="text-align:right">'
          + libs.c
          + '</td><td style="text-align:right">'
          + libs.v
          + '</td><td class="mdl-data-table__cell--non-numeric" width="50%">'
          + dd
          + '<div><div class="truncme"><span class="selectedpeer" data-peer="'+peer.id+'" data-lib="'+which.id+'">'
          + peer.name+' ('+peer.id+')'
          + "</span></trunc><div></td></tr>";
      }
    }
  }
  
  newhtml += "</tbody></table>";
  $(ME).find('.libupdatetable').html(newhtml).find('.mdl-menu__item').click(function(){
    var uuid = $(this).data('peer');
    var peer = me.peers[uuid];
    $(this).closest('td').find('.selectedpeer').text(peer.name+' ('+uuid+')').data('peer', uuid);
  });
  $(ME).find('.toggleinstalls').click(function(){
    var val = $(this).prop('checked');
    $(ME).find('.installcheckbox').prop('checked', val);
  });
  
  if (!me.updateable) $(ME).find('.updatemsg').text('There are no updates currently available.');
  componentHandler.upgradeAllRegistered();
  
  if (ME.DATA.cb) ME.DATA.cb(me.updateable, me.peer, me.updates);
}
