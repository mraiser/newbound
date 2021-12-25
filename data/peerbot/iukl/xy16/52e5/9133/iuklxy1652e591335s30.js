var me = this; 
var ME = $('#'+me.UUID)[0];

CURRENTDEVICEID = typeof CURRENTDEVICEID == 'undefined' ? null : CURRENTDEVICEID;
var prefix = CURRENTDEVICEID ? '../peerbot/remote/'+CURRENTDEVICEID+'/' : '../';

me.ready = function(){
  if (document.peers) build();
  else setTimeout(me.ready,100);
};

function build(){
  json(prefix+'peerbot/brokers', null, function(result){
    me.brokers = result.brokers;
    var n = 0;
    var newhtml = '';
    for (var i in result.brokers) {
      n++;
      var name = document.peers[i] ? document.peers[i].name : i == $('.localpeerid').text() ? $('.localpeername').text() : 'UNKNOWN';
      newhtml += '<div class="clickme"><div onclick="clickabroker(\''+i+'\', $(this).parent()[0]);">'+name+'='+result.brokers[i]+'</div></div>';
    }
    $(ME).find('.localbrokers4').html(newhtml);
    $(ME).find('.localbrokers3').height((n*18)+144);
    var el = $(ME).find('.localbrokers');
    el.text('Connection Brokers: '+n);
    el.click(function(){
      var el2 = $(ME).find('.localbrokers3');
      installControl(el2[0], 'metabot', 'popupdialog', function(api){
      }, {});
    });
  });
};

me.close = function(){
  $(ME).find('.localbrokers3')[0].api.close(function(){
    $(ME).find('.localbrokers3').css('display', 'none');
    $(ME).find('.localbrokers3')[0].api.reset();
  });
}

clickabroker = function(id, div){
  var addr = me.brokers[id];
  var i = addr.lastIndexOf(':');
  var port = addr.substring(i+1);
  addr = addr.substring(0,i);
  me.oldhtml = div.innerHTML;
  me.current = div;
  me.currentpeer = id;
  var gid = me.gid = guid();
  var newhtml = "";
  newhtml += "<div class='inlineselect' id='"+gid+"'></div>";
  newhtml += '<div class="inlinemed"><form action="#"><div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label"><input class="mdl-textfield__input" type="text" id="'+gid+'-a" value="'+addr+'"><label class="mdl-textfield__label" for="'+gid+'-a">IP Address</label></div></form></div>';
  newhtml += '<div class="inlineshort"><form action="#"><div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label"><input class="mdl-textfield__input" type="number" id="'+gid+'-b" value="'+port+'"><label class="mdl-textfield__label" for="'+gid+'-b">Port</label></div></form></div>';
  newhtml += '<button class="mdl-button mdl-js-button mdl-button--icon mdl-button--colored" onclick="savebroker(\''+id+'\');"><i class="material-icons">check</i></button>';
  newhtml += '<button class="mdl-button mdl-js-button mdl-button--icon mdl-button--accent" onclick="cancelbroker(\''+id+'\');"><i class="material-icons">close</i></button>';
  newhtml += '<button class="mdl-button mdl-js-button mdl-button--icon mdl-button--accent" onclick="deletebroker(\''+id+'\');"><i class="material-icons">delete</i></button>';
  $(div).html(newhtml).removeClass('clickme');
  
  function selectabroker(val){
    var peer = document.peers[val];
    $('#'+gid+'-a').val(peer.addr).parent()[0].MaterialTextfield.checkDirty();
    $('#'+gid+'-b').val(peer.port).parent()[0].MaterialTextfield.checkDirty();
  }

  data = { 
    "value": id, 
    "cb": selectabroker
  };
  installControl('#'+gid, 'peerbot', 'selectpeer', function(){}, data);
}

function saveBrokers(){
  json(prefix+'peerbot/brokers', 'brokers='+encodeURIComponent(JSON.stringify(me.brokers)), function(result){
  });
}

addabroker = function(){
  var pid;
  for (var id in document.peers) if (!me.brokers[id]) { pid = id; break; }
  var p = document.peers[pid];
  var brok = p.addr+':'+p.port;
  me.brokers[pid] = brok;
  var newhtml = $('<div class="clickme"><div onclick="clickabroker(\''+pid+'\', $(this).parent()[0]);">'+p.name+'='+brok+'</div></div>');
  $(ME).find('.localbrokers4').append(newhtml);
  resizeCard();
  clickabroker(pid, newhtml[0]);
  saveBrokers();
};

savebroker = function(){
  var peer = $('#'+me.gid).find('select').val();
  var addr = $('#'+me.gid+'-a').val();
  var port = $('#'+me.gid+'-b').val();
  delete me.brokers[me.currentpeer];
  var brok = me.brokers[peer] = addr+':'+port;
  var p = document.peers[peer];
  var newhtml = $('<div class="clickme"><div onclick="clickabroker(\''+peer+'\', $(this).parent()[0]);">'+p.name+'='+brok+'</div></div>');
  $(me.current).html(newhtml);
  me.current = null;
  saveBrokers();
};

cancelbroker = function(){
  $(me.current).html(me.oldhtml).addClass('clickme');
  me.current = null;
};

deletebroker = function(id){
  delete me.brokers[id];
  $(me.current).remove();
  me.current = null;
  resizeCard();  
  saveBrokers();
};

function resizeCard(){
  var n = 0;
  for (var i in me.brokers) n++;
  var h = (n*18)+144;
  $(ME).find('.localbrokers3').height(h).find('.dialog-card-wide').height(h);
}