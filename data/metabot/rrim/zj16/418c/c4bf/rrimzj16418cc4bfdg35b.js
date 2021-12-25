var me = this;
var ME = $('#'+me.UUID)[0];

function init(list){
    me.libs = [];
    me.updates = { "count":0 };
    me.alts = {};
    me.older = {};
    me.same = {};
    for (var i in list){
      var lib = list[i];
      me.libs.push(lib);
      me.updates[lib.id] = { "v":0, "c":lib.version, "count":0 };
      me.alts[lib.id] = {"count":0};
      me.older[lib.id] = {"count":0};
      me.same[lib.id] = {"count":0};
    }
    
    rebuild();

    json('../peerbot/connections', null, function(result){
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

me.ready = function(){
  componentHandler.upgradeAllRegistered();
  
  var dat = $(ME).data('list');
  if (dat) init(dat);
  else {
    json('../metabot/libraries', null, function(result){
      if (result.data.data) result.data = result.data.data;
      init(result.data.list);
    });
  }
};

function query(peers){
  if (peers.length>0) {
    var peer = peers.shift();
    var p = peer.id;
    json('../peerbot/remote/'+p+'/metabot/libraries', null, function(result){
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
        if (llib.author != rlib.author) { me.alts[llib.id][p] = rlib; me.alts[llib.id].count++; }
        else{
          var lv = Number(llib.version);
          var rv = Number(rlib.version);
          if (isNaN(lv)) lv = 0;
          if (isNaN(rv)) rv = 0;
          if (lv == rv) { me.same[llib.id][p] = rlib; me.same[llib.id].count++; }
          else if (lv<rv) {
            var o = me.updates[llib.id];
            o[p] = rlib;
            if (o.v < rv) {
              o.v = rv;
              o.p = p;
              if (!o.which) o.which = rlib;
            }
            o.count++;
            me.updates.count++;
          }
          else { me.older[llib.id][p] = rlib; me.older[llib.id].count++; }
        }
      }
    }
    rebuild();
  }
}

function buildMenu(list){
  var newhtml = ''; 
  for (var i in list){
//    var p = me.peers[list[i].author];
//    if (!p) p = { "id": list[i].author, "name": "unknown" };
    var p = me.peers[i];
    var v = list[i].version ? list[i].version : 0;
    if (p) newhtml += '<li class="mdl-menu__item" data-peer="'+p.id+'">v'+v+' ' +p.name+' ('+p.id+')</li>';
  }
  return newhtml;
}

function rebuild(){
  var newhtml = "<table class='mdl-data-table mdl-js-data-table mdl-data-table--selectable mdl-shadow--2dp'><thead><tr><th class='mdl-data-table__cell--non-numeric'>Library</th><th>Version</th><th>Available</th><th class='mdl-data-table__cell--non-numeric'>Peer</th></tr></thead><tbody>";

  for (var i in me.libs){
    var which =  me.libs[i];
    var count = me.updates[which.id].count + me.older[which.id].count + me.alts[which.id].count;
    var menu = '';
    if (count>0){
      menu = '<button id="peerselect_'+which.id+'" class="mdl-button mdl-js-button mdl-button--icon"><i class="material-icons">arrow_drop_down</i></button><ul class="mdl-menu mdl-menu--bottom-left mdl-js-menu mdl-js-ripple-effect" for="peerselect_'+which.id+'">';
      if (me.updates[which.id].count > 0) menu += buildMenu(me.updates[which.id]);
      if (me.older[which.id].count > 0) {
        menu += '<li disabled class="mdl-menu__item">Older Versions</li>'
        menu += buildMenu(me.older[which.id]);
      }
      if (me.alts[which.id].count > 0) {
        menu += '<li disabled class="mdl-menu__item">Other Authors</li>'
        menu += buildMenu(me.alts[which.id]);
      }
      menu += '</ul>';
    }
    
    if (me.updates[which.id].which) {
      
      var w = me.updates[which.id].which;
      var v = w.version ? w.version : 0;
      var peer = me.updates[which.id].p;
      var p = me.peers[peer];
      if (!p) p = { "id": peer, "name": "unknown" };
      menu += '<span class="selectedpeer" data-peer="'+peer+'" data-lib="'+which.id+'">';
      menu += 'v'+v+' '+p.name+' ('+peer+')';
    }
    else menu += '<span class="selectedpeer" data-lib="'+which.id+'">';
    menu += '</span>';
    
    var v = me.updates[which.id].v > 0 ? me.updates[which.id].v : '';
    var vme = me.updates[which.id].c ? me.updates[which.id].c : 0;
    
    newhtml += '<tr><td class="mdl-data-table__cell--non-numeric">'
      + '<div class="libid">'+which.id+"</div>"
      + '</td><td>'
      + vme
      + '</td><td>'
      + v
      + '</td><td class="mdl-data-table__cell--non-numeric">'
      + menu
      + '</td></tr>';

  }
  
  newhtml += "</tbody></table>";
  $(ME).find('.libstable').html(newhtml).find('.mdl-menu__item').click(function(){
    var uuid = $(this).data('peer');
    if (uuid){
      var peer = me.peers[uuid];
      var newhtml = $(this).text();
      $(this).closest('td').find('.selectedpeer').text(newhtml).data('peer', uuid);
      var cb = $(this).closest('tr').find('.mdl-checkbox')
      if (!cb.hasClass('is-checked')) cb.click();
    }
  });
  componentHandler.upgradeAllRegistered();
  
  $(ME).find('.mdl-checkbox').click(checkInstall);
  checkInstall();
  
  var cb = $(ME).data('cb');
  if (cb) {
    $(ME).find('.libid').parent().click(function(){
      cb($(this).text());
    });
  }
  
  var cb2 = $(ME).data('ready');
  if (cb2) cb2();
}

function checkInstall(){
  $($(ME).find('.mdl-checkbox').css('display', 'none')[0]).css('display', 'block');
  
  $(ME).find('.mdl-checkbox').each(function(x,y){
    var b = $(y).closest('tr').find('.selectedpeer').text() == '';
    $(y).css('display', b ? 'none' : 'block');
  });
  $($(ME).find('.mdl-checkbox')[0]).css('display', 'block');
  
  
  setTimeout(function(){
    var c = false;
    $(ME).find('.mdl-checkbox').each(function(x,y){
      if (x>0){
        var b = $(y).closest('tr').find('.selectedpeer').text() == '';
        var d = $(y).hasClass('is-checked');
        if (b && d) $(y).click();
        else if (d) c = true;
      }
    });
    $(ME).find('.installbutton').css('display', c ? 'block' : 'none');
  }, 500);
}

$(ME).find('.installbutton').click(function(){
  $(this).css('display', 'none');
  $(ME).find('.shrinkme').removeClass('shrinkme');
  $(ME).find('.mdl-checkbox').each(function(x,y){
    if (x>0){
      if (!$(y).hasClass('is-checked')) $(y).closest('tr').addClass('shrinkme');
    }
  });
  $(ME).find('.shrinkme').animate({"opacity":"0"}, 500, function(){
    $(ME).find('.shrinkme').css('display', 'none');
  });
  installNext();
});








function installNext(){
  $(ME).find('.installupdates').css('display', 'none');
  var y = $(ME).find('.is-checked').closest('tr').find('.selectedpeer')[0];
  if (y) install(y);
  else {
    $(ME).find('.shrinkme').css('display', 'table-row').css('opacity', '1');
    json('../metabot/libraries', null, function(result){
      if (result.data.data) result.data = result.data.data;
      init(result.data.list);
    });
  }
}
  
function install(y){
  var lib = $(y).data('lib');
  var peer = $(y).data('peer');
  var td = $(y).closest('tr').find('td')[0];
  var uuid = guid();
  var el1 = $('<span></span>');
  var el2 = $('<div id="a_'+uuid+'" class="libprog mdl-progress mdl-js-progress mdl-progress__indeterminate" style="width:'+$(y).parent().width()+'px;"></div>');
  $(y).parent().append(el2[0]);
  td.innerHTML = '<i class="material-icons" style="vertical-align:middle;">get_app</i>';
  $(td).append(el1);
  
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

  el2[0].addEventListener('mdl-componentupgraded', function() {
    
    var url = document.URL;
    url = url.substring(url.indexOf(':'));
    url = url.substring(0, url.indexOf('/',3));
    url = 'ws'+url+'/metabot/index.html';

    var connection = new WebSocket(url, ['newbound']);

    connection.onopen = function(){
      console.log('Web Socket to metabot open');

      json('../metabot/installlib', 'guid=a_'+uuid+'&peer='+peer+'&lib='+lib, function(result){
        if (result.status == 'ok'){
          el2.removeClass('mdl-progress__indeterminate');
          $(td).closest('tr').removeClass('is-checked').css('display', 'none').addClass('shrinkme').find('.is-checked').removeClass('is-checked');
          $(y).text('');
          el1.remove();
          el2.remove();
          
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
      if (SOCK) SOCK.onmessage(e);
    };
  });    

  WSCB = function(val){
    if (val.msg) $(y).text(val.msg);
    if (val.percent){
      el2.removeClass('mdl-progress__indeterminate');
      el2[0].MaterialProgress.setProgress(val.percent);
      el1.text(val.percent+'%');
    }
  };

  componentHandler.upgradeAllRegistered();
}







$(document).click(function(event) {
   window.lastElementClicked = event.target;
});
