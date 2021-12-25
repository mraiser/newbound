var me = this;
var ME = $('#'+me.UUID)[0];

var servertime = 0;
var serverdelta = 0;
var peers = [];
var hold = [];

WSCB = function(data){
  var p = data.data;
  if (p.addr) updatePeer(p);  
};

String.prototype.hashCode = function() {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

function updatePeer(p){
  if (me.peers){
    p.millis = new Date().getTime() - serverdelta - p.lastcontact;
    var el = $('#'+p.id)[0];
    if (el) $(el).data('peer', p);
    else {
      addPeer(me.viewer, p, p.id.hashCode(), 100000);
    }

    var curhud = $(ME).find('.pb-peer-uuid').text();
    if (p.id == curhud) {
      setStrength(p);
    }
  }
  else hold.push(p);
}

document.body.ALLPEERIDS = '';

me.ready = function(){
  componentHandler.upgradeAllRegistered();
  $('#matrixviewer').data('threepath', '../botmanager/asset/threejs/three.js-master/');
  $('#matrixviewer').data('datguipath', '../botmanager/asset/threejs/dat.gui-master/');
  $('#matrixviewer').data('orbitcontrols', true);
  
  json('../peerbot/getpeerinfo', null, function(result){
    $(ME).find('.localpeername').text(result.name);
    $(ME).find('.localpeerid').text(result.id);
    $(ME).find('.localpeerport').text("Port: "+result.port);
    
    $('.localpeername').click(function(){
      var data = {
        "title": "Rename this device",
        "text": "Device Name",
        "value": result.name,
        "cb": function(val){
          var params = 'machineid='+encodeURIComponent(val);
          json('../botmanager/getsettings', params, function(result){
            if (result.status != 'ok') alert(result.msg);
            else {
              $(ME).find('.localpeername').text(val);
            }
          });
        }
      };
      var el = $(ME).find('.popmeup');
      el.css('display', 'block');
      installControl(el[0], 'metabot', 'promptdialog', function(api){}, data);
    });
    
    installControl($(ME).find('.localbrokers2')[0], 'peerbot', 'brokers', function(api){}, result);
  });

  installControl('#matrixviewer', 'peerbot', 'viewer', function(api){
    me.viewer = api;
    api.waitReady(function(){

      var loader = new THREE.FontLoader();

      loader.load( 'helvetiker_regular.typeface.json', function ( ff ) {
        font = ff;

        json('../peerbot/connections', null, function(result){
          me.peers = document.peers = result.data;
          servertime = result.currenttimemillis;
          serverdelta = new Date().getTime() - result.currenttimemillis;
          
          while (hold.length>0) updatePeer(hold.pop());
          for (var i in result.data) updatePeer(result.data[i]);

          updatePeriodically();
        });
      });
      
      
      var camera = me.camera = api.scene.camera;
      me.scene = api.scene;

      function onDocumentMouseDown( event ) {
//        if ($(ME).find('.hud1').css('display') == 'block') return;
        
        event.preventDefault();
        var vector = new THREE.Vector3(
            ( event.clientX / window.innerWidth ) * 2 - 1,
          - ( event.clientY / window.innerHeight ) * 2 + 1,
            0.5
        );
        vector.unproject(camera);

        var ray = new THREE.Raycaster( camera.position, vector.sub( camera.position ).normalize() );
        
        var peers = []
        for (var i in api.models) peers.push(api.models[i].models[0]);
        var intersects = ray.intersectObjects( peers );

        if ( intersects.length > 0 ) {
          var i = peers.indexOf(intersects[0].object);
          var model = api.models[i];
          if (!api.focus){
            me.whereiwas = {
              pos: {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
              }, rot: {
                x: camera.rotation.x,
                y: camera.rotation.y,
                z: camera.rotation.z
              }, scale: {
                x: camera.scale.x,
                y: camera.scale.y,
                z: camera.scale.z
              }                
            };
          }
          api.focus = api.focus == model ? null : model;
          if (api.focus == null) closeHUD();
          else{
            showTheHUD(model.UUID);
          }
        }

      }
      $('#matrixviewer').click(onDocumentMouseDown);
    });
  });
};

function showTheHUD(uuid){
  $('.hudapps').css('display', 'block');
  $('.controlsettings').css('display', 'none');
  $('.close-settings').css('display', 'none');
  $('.updateremote').empty();

  var data = $('#'+uuid).data('peer');
  $(ME).find('.hud').css('display', 'block');
  $(ME).find('.pb-peer-name').text(data.name);
  $(ME).find('.pb-peer-uuid').text(data.id);
//            $(ME).find('.pb-peer-port').text(data.port);
//            $(ME).find('.pb-peer-keepalive').prop('checked', data.keepalive);

  setStrength(data);
  $(ME).find('.deletepeerbutton').css('display', data.connected ? 'none' : 'block');

  var addr = '<br><br>IP Addresses:<br>';
  for (var n in data.addresses) addr += '<br>'+(data.connected && data.addresses[n] == data.addr+":"+data.port ? ('<font color="#84bd00">'+data.addresses[n]+'</font>') : data.addresses[n]);
  if (data.relays.length>0){
    addr += '<br><br>Relays:<br>';
    for (var n in data.relays) {
      var id = data.relays[n];
      if ($('#'+id).data('peer')){
        var name = $('#'+id).data('peer').name;
        addr += '<br>'+name+' ('+id+')';
      }
    }
  }
  $(ME).find('.pb-peer-alladdr').html(addr);

  if (data.connected){
    $(ME).find('.hudapps').html("<i>scanning...</i>");
    $(ME).find('.addremotecontrolbutton').css('display', 'inline-block');

    CURRENTDEVICEID = data.id;
    CURRENTDEVICEPREFIX = '../peerbot/remote/'+data.id+'/';

    installControl($(ME).find('.updateremote')[0], 'metabot', 'updatebutton', function(api){}, {});

    $(ME).find('.connectedandadminonly').css('display', 'block');

    me.data = { list:[] };
    json(CURRENTDEVICEPREFIX+'botmanager/read', 'db=runtime&id=installedcontrols', function(result){
//              json(prefix+'botmanager/read', 'db=knowesys&id=DASHBOARD', function(result){
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
        settings += '</ul>';
        $('.controlsettings').html(settings).find('.editcontrolbutton').click(function(){
          var sa = $(this).data('ctltype').split(':');
          var el = $(ME).find('.popmeup').css('display', 'block')[0];
          var i = $(this).data('index');
          var data = {
            "ctldb": sa[0],
            "ctlid": sa[1],
            "data": me.data.list[i],
            "cb": function(val){
              el.api.close();
              json(CURRENTDEVICEPREFIX+'botmanager/write', 'db=runtime&id=installedcontrols&data='+encodeURIComponent(JSON.stringify(me.data)), function(result){});
            }
          };

          installControl(el, 'metabot', 'popupdialog', function(){
            setTimeout(function(){
              installControl($(el).find('.popupcontents')[0], 'peerbot', 'controlsettings', function(){}, data);
            }, 1000);
          }, data);
        });

        $('.controlsettings').find('.deletecontrolbutton').click(function(){
          var i = $(this).data('index');
          me.data.list.splice(i,1);
          json(CURRENTDEVICEPREFIX+'botmanager/write', 'db=runtime&id=installedcontrols&data='+encodeURIComponent(JSON.stringify(me.data)), function(result){
            showTheHUD(uuid);
          });
        });

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
  }
  else {
    $(ME).find('.hudapps').html("<i>Not connected.</i>");
    $(ME).find('.connectedandadminonly').css('display', 'none');
//              $(ME).find('.addremotecontrolbutton').css('display', 'none');
  }
}

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

addactlrow = function(row){
  var data = $(ME).find('.aclisttablebody')[0].data[row];
  data = Object.assign({}, data);
  data.position = 'inline';
  data.id = guid();
  me.data.list.push(data);
  json(CURRENTDEVICEPREFIX+'botmanager/write', 'db=runtime&id=installedcontrols&data='+encodeURIComponent(JSON.stringify(me.data)), function(result){
    addHUDCTL(data);
  });
  closeADDCTL();
};

$(ME).find('.pb-peer-strength').click(function(){
  var curhud = $(ME).find('.pb-peer-uuid').text();
  var data = $('#'+curhud).data('peer');
  json('../peerbot/connect', 'uuid='+curhud, function(result){
    console.log(result);
  });
});

function setStrength(data){
  var b = data.connected;
  var i = data.strength;
  var s = makeDot(b, i>0) + makeDot(b, i>1) + makeDot(b, i>2);
  s += '<br><span class="hudms">'+(data.millis>15000 ? '&infin;' : data.millis+'ms')+'</span>';
  $(ME).find('.pb-peer-strength').html(s);
}

function makeDot(b1, b2){
  return '<div class="connectionindicator" style="background-color:'+(b1 && b2 ? '#84bd00' : b2 ? '#ff0' : '#ccc')+';"></div>';
}

function addPeer(api, p, num, count){
  var all = document.body.ALLPEERIDS;
  all = all == '' ? '' : all+' ';
  all += p.id;
  document.body.ALLPEERIDS = all;
//  console.log(all);
  
//  p.millis = servertime - p.lastcontact;
  p.millis = new Date().getTime() - serverdelta - p.lastcontact;
  var r = 5; //((count*2)/Math.PI)/20;
  var n = (num/count)*Math.PI*2;
  var s = 0.25; //10/count;
  
  var x = Math.sin(n)*r;
  var y = ((num % 2) - 0.5)*0.02*Math.random();
  var z = Math.cos(n)*r;
  
  var el = $('<div class="peerorb" />')[0];
  el.id = p.id;
  $(el).data('pos', { x: x, y:y, z:z });
  $(el).data('scale', { x: s, y:s, z:s });
  $(el).data('peer', p);
  $(ME).append(el);
  api.add(el, 'peerbot', 'orb', null);
};

function updatePeriodically(){
  setTimeout(function(){
    json('../peerbot/connections', null, function(result){
      servertime = result.currenttimemillis;
      var curhud = $(ME).find('.pb-peer-uuid').text();
      for (var i in result.data) updatePeer(result.data[i]);
      updatePeriodically();
    });
  }, 3000);
}

showHudApp = function(appid){
  var app = { data: getByProperty($(ME).find('.hudapps').data('apps').list, 'id', appid) };
  installControl($(ME).find('.hudappdetail')[0], 'metabot', 'appcard', function(){}, app);
};

$('.hudappdetail').click(function(event){
  event.preventDefault();
});

function closeHUD(){
  var camera = me.camera;
  camera.position.x = me.whereiwas.pos.x;
  camera.position.y = me.whereiwas.pos.y;
  camera.position.z = me.whereiwas.pos.z;    
//  camera.lookAt(me.scene.position);
  camera.rotation.x = me.whereiwas.rot.x;
  camera.rotation.y = me.whereiwas.rot.y;
  camera.rotation.z = me.whereiwas.rot.z;    
  camera.scale.x = me.whereiwas.scale.x;
  camera.scale.y = me.whereiwas.scale.y;
  camera.scale.z = me.whereiwas.scale.z;    
  $(ME).find('.hud').css('display', 'none');
  me.viewer.focus = null;
  me.viewer.lastlook.copy(me.scene.position);
}

$(ME).find('.deletepeerbutton').click(function(){
  var id = $(ME).find('.pb-peer-uuid').text();
  json("deletepeer","uuid="+id, function(result) {});

  var model = $('#'+id)[0].api;
  
  model.scene.remove(model.text3d);
  
  var rig = model.rig;
  var size = rig.scale_x;
  model.animations.push(function(model){
    
    if (size > 0.0001){
      size *= 0.8;
      rig.scale_x = size;
      rig.scale_y = size;
      rig.scale_z = size;
    }
    else {
      model.scene.remove(model.models[0]);
      closeHUD();
      var i = model.animations.indexOf(this);
      model.animations.splice(i,1);
    }
  });
});

$(ME).find('.closehudbutton').click(closeHUD);

function listAccessCodes(){
  json('../peerbot/accesscodes', null, function(result){
    var newhtml = '';
    for (var i in result.data){
      var rdi = result.data[i];
      var use = rdi.delete == 'true' ? 'single use' : 'reusable';
      newhtml += '<div class="mdl-chip mdl-chip--deletable"><div class="mdl-chip__text">'+use+': '+rdi.groups+'<br>'+i+'</div><button type="button" class="codechip mdl-chip__action" onclick="deleteaccesscode(\''+i+'\');"><i class="material-icons">cancel</i></button></div>';
    }
    $(ME).find('.codelist').html(newhtml);
  });
}
listAccessCodes();

deleteaccesscode = function(id){
	json('../peerbot/deleteaccesscode', 'code='+encodeURIComponent(id), function(result){
		listAccessCodes();
	});
};

$(ME).find('.accesscodebutton').click(function(){
  var el = $(ME).find('.accesscodespopup');
  installControl(el[0], 'metabot', 'popupdialog', function(){
    el.css('display', 'block');
    setTimeout(function(){
//      $('#addcontactbutton').click(newConnection);
      $(ME).find('.accesscodespopupclose').click(function(){
        el[0].api.close(function(){
          el.empty();
          el.append(el[0].api.oldhtml);
          el.css('display','none');
        });
      });
      
      json('../peerbot/suggestaccesscode', null, function(result){
        $('#newaccesscode').val(result.msg);
      });
      
      $('.addaccesscodebutton').click(addAccessCode);
      
    }, 1000);
  }, {});
});

function addAccessCode(){
	var code = encodeURIComponent($('#newaccesscode').val());
	var del = $('#deleteonuse').prop('checked');
	var groups = encodeURIComponent($('.acgroupselect').find('select').val());

    json('../peerbot/addaccesscode', 'code='+code+'&delete='+del+'&groups='+groups, function(result){
		if (result.status == 'ok') {
			$('#adcodebackbutton').click();
			listAccessCodes();
          
            json('../peerbot/suggestaccesscode', null, function(result){
              $('#newaccesscode').val(result.msg);
            });
          
		}
		else alert(result.msg);
	});
}

function discovery() {
  $('#botlist').html('<div class="pb-deviceinfo">Scanning...</div>');

  json("../botmanager/discover", null, function(result) {
    console.log(result);
    var newhtml = '';
    if (result.status != 'ok') newhtml = '<font color="red">Error: '+result.msg+'</font>';
    else {
      var n=0;
      for (var item in result.data) {
        var rai = result.data[item];
        if (rai.peerinfo) {
          n++;
          var url = "http://"+rai.address[0]+':'+rai.port+'/';
          var con = me.peers[rai.uuid];
          var floater;
          if (con) {
            if (con.connected) floater = "<font color='green'>connected</font><br><input type='button' value='disconnect' onclick='disconnect(\""+rai.uuid+"\");' data-mini='true'>";
            else floater = "not connected<br><input type='button' value='connect' onclick='connect(\""+rai.uuid+"\");' data-mini='true' data-theme='a'>";
          }
          else floater = "<input type='button' value='add connection' onclick='addConnection(\""+rai.uuid+"\",\""+rai.address[0]+"\",\""+rai.peerinfo.port+"\");' data-theme='a'>";
          newhtml 
            += '<li id="li_'+rai.uuid+'"><div style="position:absolute;z-index:10;right:50px;text-align:right;">'+floater+'</div><a id="a_'+rai.uuid+'" class="li_botlist" href="'+url+'">'
            + '<span class="ui-li-heading">'+rai.name+' ('+rai.uuid+')</span><p class="ui-li-desc"><span class="daddr">'+rai.address[0]+'</span>:<span class="dport">'+rai.port+'</span></p></a></li>';
        }
      }
			
      if (n>0) newhtml 
          = 'Available Peers<ul id="ul_botlist">'
          + newhtml
          + '</ul>';
      else newhtml = '<div class="pb-deviceinfo">No Peers Detected in Local Network.</div>';
    }
    $('#botlist').html(newhtml);
    $('#botlist').trigger('create');
    document.getElementById('botlist').botlist = result.data;
  });
}

connect = function(uuid){
  var addr = $('#li_'+rai.uuid).find('.daddr').text();
  var port = $('#li_'+rai.uuid).find('.dport').text();
  json('../peerbot/connect', 'uuid='+uuid+'&addr='+encodeURIComponent(addr)+'&port='+port, function(result){
    discovery();
  });
};

disconnect = function(uuid){
  json('../peerbot/disconnect', 'uuid='+uuid, function(result){
    discovery();
  });
};

addConnection = function(uuid, addr, port){
  $('#newcontactid').val(uuid);
  $('#newcontactip').val(addr);
  $('#newcontactport').val(port);
  
  newConnection();
  discovery();
};

$(ME).find('.lanbutton').click(function(){
  $('#botlist').html('');
  var el = $(ME).find('.lanpopup');
  installControl(el[0], 'metabot', 'popupdialog', function(){
    el.css('display', 'block');
    setTimeout(function(){
      discovery();
      $(ME).find('.lanpopupclose').click(function(){
        el[0].api.close(function(){
          el.empty();
          el.append(el[0].api.oldhtml);
          el.css('display','none');
        });
      });
    }, 1000);
  }, {});
});


$(ME).find('.addpeerbutton').click(function(){
  $('.gep1').css('display', 'block');
  $('.gep2').css('display', 'none')
      
  var el = $(ME).find('.addpeerpopup');
  installControl(el[0], 'metabot', 'popupdialog', function(){
    el.css('display', 'block');
    setTimeout(function(){
      $('#addcontactbutton').click(newConnection);
      $('#createtheinvite').click(createInvite);
      $('#accepttheinvite').click(acceptInvite);
      
      $(ME).find('.addpeerpopupclose').click(function(){
        el[0].api.close(function(){
          el.empty();
          el.append(el[0].api.oldhtml);
          el.css('display','none');
        });
      });
    }, 1000);
  }, {});
});

function newConnection() {
  var id = $('#newcontactid').val();
  var addr = $('#newcontactip').val();
  var port = $('#newcontactport').val();
  var code = $('#newcontactcode').val();
  var groups = $('.peergroupselect').find('select').val();

  if (!id || id.trim() == '') $('#newconactmsg').html('<font color="red">Universal ID is required</font>');
  else {
    if (!addr || addr.trim() == '') addr='';
    if (!port || port.trim() == '') port='';
    if (!code || code.trim() == '') code='';
    if (!groups || groups.trim() == '') groups='';
  
    $('#newconactmsg').html('<font color="green">Connecting to: '+id+'</font>');
    json('../peerbot/newconnection', 'sessionid='+sessionid+'&uuid='+encodeURIComponent(id)+"&addr="+encodeURIComponent(addr)+"&port="+encodeURIComponent(port)+"&code="+encodeURIComponent(code)+"&groups="+encodeURIComponent(groups), function(result) {
      if (result.status == 'ok') {
        document.location.href = ''+document.location.href;
      }
      else {
        $('#newconactmsg').html('<font color="red">ERROR: '+result.msg+'</font>');
        setTimeout("$('#newconactmsg').html('');", 5000);
      }
    });
  }  
}  

$(ME).find('.addremotecontrolbutton').click(function(){
  var el = $(ME).find('.availablecontrols');
  installControl(el[0], 'metabot', 'popupdialog', function(){
    el.css('display', 'block');
  }, {});
});

closeADDCTL = function(){
  var el = $(ME).find('.availablecontrols');
  el[0].api.close(function(){
    el.empty();
    el.append(el[0].api.oldhtml);
    el.css('display','none');
  });
};

$(ME).find('.restartservicesbutton').click(function(){
  var uuid = $(ME).find('.pb-peer-uuid').text();
  json('../peerbot/remote/'+uuid+'/botmanager/restart', null, function(result){
    var snackbarContainer = document.querySelector('#restart-snackbar');
    var data = {
      message: result.msg
    };
    snackbarContainer.MaterialSnackbar.showSnackbar(data);
  });
});

$(ME).find('.refreshcontrolsbutton').click(function(){
  var uuid = $(ME).find('.pb-peer-uuid').text();
  showTheHUD(uuid);
});

$(ME).find('.managecontrolsbutton').click(function(){
  $('.hudapps').css('display', 'none');
  $('.close-settings').css('display', 'block');
  $(ME).find('.controlsettings').css('opacity', '0').css('display', 'block').animate({"opacity": 1}, 500);
});

$(ME).find('.close-settings').click(function(){
  $('.close-settings').css('display', 'none');
  $('.controlsettings').css('display', 'none');
  $(ME).find('.hudapps').css('opacity', '0').css('display', 'block').animate({"opacity": 1}, 500);
});

function acceptInvite(){
  var ic = $('#enterinvitecode').val().split('_');
  if (ic.length != 2) alert("That is not a valid invite code!");
  var groups = encodeURIComponent($('.invitegroupselect').find('select').val());
  json('../peerbot/connect', 'uuid='+ic[0]+'&code='+ic[1]+'&groups='+groups, function(result){
    if (result.status != 'ok') alert(result.msg);
    else document.location.href = ''+document.location.href;
  });
}

function createInvite(){
  json('suggestaccesscode', null, function(result){
    var ac = encodeURIComponent(result.msg);
    var code = encodeURIComponent(result.msg);
    var del = true;
    var groups = encodeURIComponent($('.invitegroupselect').find('select').val());
    json('../peerbot/addaccesscode', 'code='+code+'&delete='+del+'&groups='+groups, function(result){
      if (result.status == 'ok') {
        json('../peerbot/getpeerid', null, function(result){
          var meid = result.msg;
          $('.gep1').css('display', 'none');
          $('.gep2').css('display', 'block').html('<center><br><br><br>Send the following code to your friend:<br><br><font size="large">'+meid+'_'+ac+'</font></center>');
          listAccessCodes();
        });
      }
      else alert(result.msg);
    });
  });
}

$(document).click(function(event) {
   window.lastElementClicked = event.target;
});




