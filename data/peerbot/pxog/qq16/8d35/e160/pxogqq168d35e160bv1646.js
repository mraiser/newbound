var me = this;
var ME = $('#'+me.UUID)[0];

me.data = {"list":[]};

me.ready = me.refresh = function(){
  $(ME).find('.rp-name').text(ME.DATA.name);
  $(ME).find('.rp-uuid').text(ME.DATA.id);
  
  $(ME).find('.adminonly').css('display', 'none');
  $(ME).find('.hudapps').css('display', 'block');
  $(ME).find('.controlsettings').css('display', 'none').css('opacity', '1');
  
  var protocols = ME.DATA.protocols.split(',');
  for (var i in protocols){
    var p = protocols[i].trim().toLowerCase();
    $(ME).find('.allow'+p).prop('checked', true);
  }
  $(ME).find('.protocol').change(function(e){
    var s = '';
    if ($(ME).find('.allowtcp').prop('checked')) s = "tcp";
    if ($(ME).find('.allowudp').prop('checked')) { if (s !="") s += ","; s += "udp"; }
    if ($(ME).find('.allowrelay').prop('checked')) { if (s !="") s += ","; s += "relay"; }
    json('../peerbot/protocols', 'uuid='+encodeURIComponent(ME.DATA.id)+'&protocols='+encodeURIComponent(s), function(result){
      if (result.status != 'ok')
	    alert(JSON.stringify(result));
    });
  });
  
  $(ME).find('.rememberme').prop('checked', document.body.mypeers.indexOf(ME.DATA.id) != -1);

  var addr = '';
  for (var i in ME.DATA.addresses) {
    var a = ME.DATA.addresses[i];
    var j = a.lastIndexOf(':');
    a = a.substring(0,j);
    addr += '<span class="mdl-chip"><span class="mdl-chip__text">'+a+'</span></span> ';
  }
  var ip = 'Port: '+ME.DATA.port+'<br>IP Address: '+ME.DATA.addr+'&nbsp;<i class="material-icons aligncenter clickmore">more_horiz</i><div class="moreip">'+addr+'</div>';
  $(ME).find('.rp-ipaddr').html(ip).find('.clickmore').click(function(){
    if ($(this).text() == 'more_horiz'){
      $(this).text('close');
      $(ME).find('.moreip').css('display', 'block');
    }
    else{
      $(this).text('more_horiz');
      $(ME).find('.moreip').css('display', 'none');
    }
  });
  
  $(ME).find('.hudapps').html('<i>Scanning...</i>');
  $(ME).find('.deletepeerbutton').css('display', ME.DATA.connected ? 'none' : 'block');
  
  componentHandler.upgradeAllRegistered();
  
  installControl($(ME).find('.localbrokers5')[0], 'peerbot', 'brokers', function(api){}, {});
  
  installControl($(ME).find('.rp-status')[0], 'peerbot', 'connectionstatus', function(api){}, ME.DATA);
  if (ME.DATA.connected){
    installControl($(ME).find('.rp-update')[0], 'metabot', 'updatebutton', function(api){}, {});
    json('../peerbot/remote/'+ME.DATA.id+'/botmanager/read', 'db=runtime&id=installedcontrols', function(result){
      if (result.status != 'ok'){
        $(ME).find('.hudapps').html(result.msg);
      }
      else {
        var data = me.data = result.data;
        var wrap = $(ME).find('.hudapps');
        wrap.empty();

        var settings = '<ul class="mdl-list">';
        var count = 0;
        for (var i in data.list){
          var ctl = data.list[i];
          var inline = ctl.position && ctl.position != 'inline' ? false : true;
          
          if (ctl.peer == 'local') ctl.peer = ME.DATA.id;

          if (inline) {
            addHUDCTL(ctl);
            count++

            settings += '<li class="mdl-list__item"><span class="mdl-list__item-primary-content">'
              + '<i class="material-icons mdl-list__item-avatar">settings</i>'
              + '<button class="editcontrolbutton mdl-button mdl-js-button mdl-js-ripple-effect" data-index="'
              + i
              +'" data-ctltype="'
              + ctl.type
              + '">'
              + ctl.title
              + '</button></span>'
              + '<a class="deletecontrolbutton mdl-list__item-secondary-action" data-index="'
              + i
              +'" href="#"><i class="material-icons">delete</i></a>'
              + '</span></li>';
          }
        }
        if (count == 0) wrap.html("");
        else {
            $('a.mdl-tabs__tab').removeClass('is-active');
            $('#dashboardtab').addClass('is-active');
            $('.mdl-tabs__panel').removeClass('is-active');
            $('#tab2-panel').addClass('is-active');        
        }
        settings += '</ul><button class="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect editctldonebutton">Done</button>';
        $('.controlsettings').html(settings).find('.editcontrolbutton').click(function(){
          var sa = $(this).data('ctltype').split(':');
          var el = $(ME).find('.popmeup').css('display', 'block')[0];
          var i = $(this).data('index');
          var data = {
            "ctldb": sa[0],
            "ctlid": sa[1],
            "data": me.data.list[i],
            "list": me.data.list,
            "index": i,
            "save": function(val){
              el.api.closeAndReset();
              for (var i in data.list) if (data.list[i].peer == ME.DATA.id) data.list[i].peer = 'local';
              json(CURRENTDEVICEPREFIX+'botmanager/write', 'db=runtime&id=installedcontrols&data='+encodeURIComponent(JSON.stringify(me.data)), function(result){});
              for (var i in data.list) if (data.list[i].peer == 'local') data.list[i].peer = ME.DATA.id;
            }
          };

          installControl(el, 'metabot', 'popupdialog', function(){
            setTimeout(function(){
              installControl($(el).find('.popupcontents')[0], 'peerbot', 'controlsettings', function(){}, data);
            }, 1000);
          }, data);
        });

        $('.controlsettings').find('.deletecontrolbutton').click(function(){
          $(ME).find('.controlsettings').animate({'opacity':'0'}, 500);
          var i = $(this).data('index');
          me.data.list.splice(i,1);
          json(CURRENTDEVICEPREFIX+'botmanager/write', 'db=runtime&id=installedcontrols&data='+encodeURIComponent(JSON.stringify(me.data)), function(result){
            me.refresh();
          });
        });
        
        $('.controlsettings').find('.editctldonebutton').click(me.refresh);
        
        $('.close-settings').css('display', 'none');
      }
      json(CURRENTDEVICEPREFIX+'botmanager/read', 'db=runtime&id=availablecontrols', function(result){
        var newhtml = '';
        for (var i in result.data.list){
          var rdli = result.data.list[i];
          newhtml += '<tr onclick="addactlrow('
            + i
            + ');"><td class="mdl-data-table__cell--non-numeric">'
            + rdli.title
            + '</td><td class="mdl-data-table__cell--non-numeric">'
            + rdli.type
            + '</td><td>'
            + JSON.stringify(rdli.groups)
            +'</td></tr>';
        }
        $(ME).find('.aclisttablebody').html(newhtml)[0].data = result.data.list;
        componentHandler.upgradeAllRegistered();
      });
    });
    json('../peerbot/remote/'+ME.DATA.id+'/securitybot/currentuser', null, function(result){
      $(ME).find('.rp-key').text(result.groups);
      if (result.groups.indexOf('admin') != -1) $(ME).find('.adminonly').css('display', 'block');
    });
  }
  else{
    $(ME).find('.rp-key').text('--');
  }
  
  json('../securitybot/listusers', null, function(result){
    var u = getByProperty(result.data, 'username', ME.DATA.id);
    var g = u.groups[0] ? u.groups : 'anonymous';
    $(ME).find('.rp-lock').text(g);
  });
};

function addHUDCTL(ctl){
  var wrap = $(ME).find('.hudapps');
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
  installControl(el, db, id, function(api){}, d);
}

$(ME).find('.refreshhud').click(me.refresh);

$(ME).find('.addhudctl').click(function(){
  var el = $(ME).find('.availablecontrols');
  installControl(el[0], 'metabot', 'popupdialog', function(){
    el.css('display', 'block');
  }, {});
});

addactlrow = function(row){
  var data = $(ME).find('.aclisttablebody')[0].data[row];
  data = Object.assign({}, data);
  data.position = 'inline';
  data.id = guid();
  me.data.list.push(data);
  json(CURRENTDEVICEPREFIX+'botmanager/write', 'db=runtime&id=installedcontrols&data='+encodeURIComponent(JSON.stringify(me.data)), function(result){
    addHUDCTL(data);
  });
  $(ME).find('.availablecontrols')[0].api.closeAndReset();
};

$(ME).find('.hudctlsettings').click(function(){
  $(ME).find('.hudapps').css('display', 'none');
  $(ME).find('.controlsettings').css('display', 'block');
});

$(ME).find('.hudrestart').click(function(){
  json('../peerbot/remote/'+ME.DATA.id+'/botmanager/restart', null, function(result){
    var snackbarContainer = document.querySelector('#restart-snackbar2');
    var data = {
      message: result.msg
    };
    snackbarContainer.MaterialSnackbar.showSnackbar(data);
  });
});

$(ME).find('.rememberme').change(function(val){
  var b = $(val.currentTarget).prop('checked');
  var l = document.body.mypeers;
  var i = l.indexOf(ME.DATA.id);
  if (b){
    if (i == -1){
      l.push(ME.DATA.id);
    }
  }
  else{
    if (i != -1) l.splice(i, 1);
  }
  var d = {};
  d.list = l;
  json('../botmanager/write', 'db=runtime&id=peerbot_mypeers&data='+encodeURIComponent(JSON.stringify(d)), function(result){
    if (result.status != 'ok') alert(JSON.stringify(result));
  });
});

$(ME).find('.deletepeerbutton').click(function(){
  me.network.delete(ME.DATA);
});


