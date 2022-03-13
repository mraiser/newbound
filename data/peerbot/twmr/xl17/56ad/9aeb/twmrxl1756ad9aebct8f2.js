var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  json('../peerbot/getpeerinfo', null, function(result){
    me.my_uuid = result.id;
    if (!document.peers){
      json('../peerbot/connections', null, function(result){
        if (result.status == 'ok') {
          me.peers = document.peers = result.data;
          buildTable();
        }
      });
    }
    else {
      me.peers = document.peers;
      buildTable();
    }
  });
};

function buildTable(){
  me.checking = [];
  var newhtml = '';
  for (var uuid in me.peers){
    var p = me.peers[uuid];
    if (p.connected){
      me.checking.push(uuid);
      newhtml += '<tr class="uprow r_'+uuid+'" data-peer="'+uuid+'">'
        + '<td><label class="plaincheckbox"><input type="checkbox"><span></span></label></td>'
        + '<td class="mdl-data-table__cell--non-numeric">'+p.name+'<br><div style="font-size:x-small;">'+uuid+'</div></td>'
        + '<td class="mdl-data-table__cell--non-numeric rowstatus"><i>pending...</i></td>'
        + '</tr>';
    }
  }
  if (newhtml != ''){
    newhtml = '<table cellpadding="10px" class="updateablepeerstable mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp"><thead><tr><th><label class="plaincheckbox"><input type="checkbox"><span></span></label></th><th class="mdl-data-table__cell--non-numeric" style="text-align:left;">Peer</th><th class="mdl-data-table__cell--non-numeric" style="text-align:left;">Available Updates</th></tr></thead><tbody>'
      + newhtml
      + '</tbody></table>';
  }
  else newhtml = '<i>You are not connected to any peers.</i>';
  
  var el = $(ME).find('.update_peer_list');
  el.html(newhtml);
  componentHandler.upgradeAllRegistered();
  
  $(ME).find('td').find(':checkbox').parent().css('display', 'none').click(function(e){
    var n = $(ME).find('td').find(':checked').length;
    var d = n>0 ? 'inline-block' : 'none';
    $(ME).find('.updateselectedbutton').css('display', d);
  });
  
  $(ME).find('th').find(':checkbox').click(function(e){
    var val = $(this).prop('checked');
    $(ME).find('td').find(':checkbox').prop('checked', val);
    var n = $(ME).find('td').find(':checked').length;
    var d = !val ? 'none' : 'inline-block';
    $(ME).find('.updateselectedbutton').css('display', d);
  }).parent().css('display', 'none');
  
  $(ME).find('td').find(':checkbox').parent().after('<img src="../botmanager/asset/botmanager/close.png" class="cancelcheckbutton roundbutton-small mdl-button mdl-js-button mdl-button--icon mdl-button--colored">');
  $(ME).find('.cancelcheckbutton').click(function(e){
    $(this).closest('tr').remove();
    checkNext();
  });
  
  //checkNext();
  for (var i=0; i<10; i++) checkNext();
}

function check(uuid){
  var data = {
    "peer": uuid,
    "cb": postCheck
  };
  var el = $(ME).find('.r_'+uuid).find('.rowstatus')[0];
  installControl(el, 'metabot', 'updatebutton', function(api){}, data);
}

function checkNext(){
  if (me.checking.length > 0){
    var uuid = me.checking.shift();
    check(uuid);
  }
  else if ($(ME).find('.updatemsg').length == 0){
    var n = $(ME).find('td').find(':checkbox').length;
    if (n == 0) {
      var el = $(ME).find('.update_peer_list');
      el.html('<h3>Your peers are up-to-date.</h3>');
    }
    else {
      $(ME).find('th').find(':checkbox').parent().css('display', 'inline-block')
    }
  }
}

function addReloadButton(el, msg, uuid){
  el.find('.rowstatus').html('<img src="../botmanager/asset/botmanager/refresh_icon.png" class="recheckbutton roundbutton-small mdl-button mdl-js-button mdl-button--icon mdl-button--colored"><span style="color:red;font-size:x-small;">Error: '+msg+'</span>');
  el.find('.recheckbutton').click(function(e){
    check(uuid);
  });
}

function postCheck(isupdateable, uuid, updates, e, msg){
  var el = $(ME).find('.r_'+uuid);
  if (e) {
    addReloadButton(el, msg, uuid);
  }
  else {
    var el = $(ME).find('.r_'+uuid);
    if (!isupdateable){
      el.remove();
    }
    else {
      var newhtml = "";
      var u = [];
      for (var appid in updates){
        var app = updates[appid];
        if (app.p){
          newhtml += '<span data-appid="'+appid+'" class="deletelib deletelib_'+appid+' mdl-chip mdl-chip--deletable chip"><span class="mdl-chip__text">'+appid+'</span><img src="../botmanager/asset/botmanager/close.png" class="mdl-chip__action roundbutton-small updatechip"></span>';
          u.push(app[app.p]);
        }
      }
      el.data('updates', u);
      el.find('.rowstatus').html(newhtml);
      el.find(':checkbox').parent().css('display', 'inline-block');
      el.find('.cancelcheckbutton').css('display', 'none');
      el.find('.deletelib').find('img').click(function(e){
        var chip = $(this).closest('.deletelib');
        var appid = chip.data('appid');
        var app = updates[appid];
        var rapp = app[app.p];
        var i = u.indexOf(rapp);
        u.splice(i,1);
        if (u.length == 0 && me.currentlyupdating != uuid) el.remove();
        else chip.remove();
      });
    }
  }
  checkNext();
}

function updateNextLib(uuid, libs){
  var row = $(ME).find('.r_'+uuid);
  var lib = libs.pop();
  var newhtml = $('<tr id="progrow_'+uuid+'"><td colspan="3"><div class="progmsg"><i>Sending '+lib.name+' to '+document.peers[uuid].name+'...</i></div><div id="p_'+uuid+'" class="progressbar mdl-progress mdl-js-progress mdl-progress__indeterminate" style="width:100%;max-width:100%;"></div></td></tr>');
  row.after(newhtml);
  document.body.api.ui.initProgress(row.parent());
  newhtml.find('.progressbar')[0].setProgress('indeterminate');
  
  $(row).find('.deletelib_'+lib.name).css('opacity', '0.5').find('button').css('display', 'none');;

  function error(uuid, msg){
    var el = $(ME).find('.r_'+uuid);
    el.find(':checkbox').prop('checked', false).parent().parent().children().css('display', 'none');
    el.find(':checkbox').parent().removeClass('is-checked');
    el.find('.cancelcheckbutton').css('display', 'inline-block');
    if (el.find('.progressbar')[0] && el.find('.progressbar')[0].setProgress) el.find('.progressbar')[0].setProgress(0);
    addReloadButton(el, msg, uuid)
    $('#progrow_'+uuid).remove();
    updateNextPeer();
  }
  
  var progrow = $('#progrow_'+uuid);
  
  var url = document.URL;
  url = url.substring(url.indexOf(':'));
  url = url.substring(0, url.indexOf('/',3));
  url = 'ws'+url+'/peerbot/remote/'+uuid+'/metabot/index.html';

  var connection = new WebSocket(url, ['newbound']);

  connection.onopen = function(){
    console.log('Web Socket to metabot open');

    json('../peerbot/remote/'+uuid+'/metabot/installlib', 'guid=r_'+uuid+'&peer='+me.my_uuid+'&lib='+lib.id, function(result){
      connection.close();
      if (result.status == 'ok'){
        $('#progrow_'+uuid).remove();
        if (libs.length > 0) {
          row.find('.deletelib_'+lib.name).remove();
          updateNextLib(uuid, libs)
        }
        else {
          row.remove();
          updateNextPeer();
        }
      }
      else error(uuid, result.msg);
    });
  };

  connection.onerror = function(error){
    console.log('Web Socket to metabot error');
  };

  connection.onclose = function(error){
    console.log('Web Socket to metabot close');
  };

  var el2 = progrow.find('#p_'+uuid);
  connection.onmessage = function(e){
    var val = JSON.parse(e.data);
    var percent = val.percent;
    var msg = val.msg;
    if (msg) progrow.find('.progmsg').html('<i>'+msg+'</i>');
    if (percent>0){
      el2.removeClass('mdl-progress__indeterminate');
      el2[0].setProgress(percent);
    }
  };
}

function updateNextPeer(){
  var checkbox = $(ME).find('td').find(':checked')[0];
  if (checkbox) {
    var row = checkbox.closest('.uprow');
    //$(row).find('.deletelib').find('button').css('display', 'none');

    var uuid = $(row).data('peer');
    me.currentlyupdating = uuid;
    $(checkbox).parent().css('display', 'none').after('<img src="../botmanager/asset/botmanager/upload_icon.png" class="roundbutton-small" style="vertical-align:middle;">');
    var libs = $(row).data('updates');
    updateNextLib(uuid, libs);
  }
  else{
    me.updating = false;
    me.currentlyupdating = null;
    var n = $(ME).find('td').find(':checkbox').length;
    if (n == 0) {
      var el = $(ME).find('.update_peer_list');
      el.html('<h3>Your peers are up-to-date.</h3>');
    }
  }
}

$(ME).find('.updateselectedbutton').click(function(e){
  $(this).css('display', 'none');
  if (!me.updating){
    me.updating = true;
    updateNextPeer();
  }
});
