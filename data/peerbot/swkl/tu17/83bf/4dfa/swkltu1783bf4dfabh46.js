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
        + '<td class="mdl-data-table__cell--non-numeric">'+p.name+'<br><div style="font-size:x-small;">'+uuid+'</div></td>'
        + '</tr>';
    }
  }
  if (newhtml != ''){
    newhtml = '<table class="updateablepeerstable mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp"><thead><tr><th class="mdl-data-table__cell--non-numeric">Peer</th></tr></thead><tbody>'
      + newhtml
      + '</tbody></table>';
  }
  else newhtml = '<i>You are not connected to any peers.</i>';
  
  var el = $(ME).find('.reboot_peer_list');
  el.html(newhtml);
  
  $(ME).find('.rebootselectedbutton').css('display', 'inline-block');
  
  componentHandler.upgradeAllRegistered();
}

function rebootNextPeer(){
  var checkbox = $(ME).find('td').find(':checked')[0];
  if (checkbox) {
    var row = checkbox.closest('.uprow');
    var uuid = $(row).data('peer');
    me.currentlyupdating = uuid;
    $(checkbox).prop('checked', false).parent().css('display', 'none').after('<div class="mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active rebootspinner"></div>');
    componentHandler.upgradeAllRegistered();
    
    json('../peerbot/remote/'+uuid+'/metabot/call', 'db=metabot&name=rebootbutton&cmd=reboot&args={}', function(result){
      if (result.status != 'ok') alert(result.msg);
      else row.remove();
    });
    rebootNextPeer();
  }
  else{
    me.updating = false;
    me.currentlyupdating = null;
    var n = $(ME).find('td').find(':checkbox').length;
    if (n == 0) {
      var el = $(ME).find('.reboot_peer_list');
      el.html('<h3>Your peers have been rebooted.</h3>');
    }
  }
}

$(ME).find('.rebootselectedbutton').click(function(e){
  if (!me.updating){
    me.updating = true;
    rebootNextPeer();
  }
});
