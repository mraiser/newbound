var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  componentHandler.upgradeAllRegistered();

  var el = $(ME).find('.matrixviewer');
  el.data('orbitcontrols', true);
  el.data('showdatgui', false);

  installControl(el[0], 'threejs', 'viewer', function(api){
    me.viewer = api;
    api.waitReady(function(){
      
      var fname = '../peerbot/helvetiker_regular.typeface.json';
      document.body.fonts = {};
      var f = document.body.fonts[fname] = {};
      f.cbs = [];
      var loader = new THREE.FontLoader();
      loader.load( fname, function ( ff ) {
        f.font = ff;
        me.viewer.add($(ME).find('.networkviewer')[0], 'peerbot', 'network', function(model){
          model.api.networkviewer = me;
          me.network = model.api;
        }, {});      
      });
    });
  }, {});
};

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


me.select = function(m){
  me.selected = m;
  if (m){
    CURRENTDEVICEID = m.model.data.id;
    CURRENTDEVICEPREFIX = '../peerbot/remote/'+m.model.data.id+'/';
    $(ME).find('.headsupdisplay').animate({"right":"0px"},500);
    installControl($(ME).find('.headsupdisplayinner')[0], 'peerbot', 'headsup', function(api){
      api.network = me.network;
    }, m.model.data);
  }
  else{
    CURRENTDEVICEID = null;
    CURRENTDEVICEPREFIX = '../';
    $(ME).find('.headsupdisplay').animate({"right":"-100%"},500, function(){
      $(ME).find('.headsupdisplayinner').empty();
    });
  }
};

$(ME).find('.closehud').click(function(){
  me.network.focus(null);
});

me.update = function(p){
  if (me.selected && me.selected.model.data == p){
    $(ME).find('.rp-status')[0].api.refresh();
  }
};

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
    var params = 'sessionid='+sessionid+'&uuid='+encodeURIComponent(id);
    if (addr && addr.trim() != '') params += "&addr="+encodeURIComponent(addr);
    if (port && port.trim() != '') params += "&port="+encodeURIComponent(port);
    if (code && code.trim() != '') params += "&code="+encodeURIComponent(code);
    if (groups && groups.trim() != '') params += "&groups="+encodeURIComponent(groups);
  
    $('#newconactmsg').html('<font color="green">Connecting to: '+id+'</font>');
    json('../peerbot/connect', params, function(result) {
      if (result.status == 'ok') {
        $('#adconbackbutton').click();
      }
      else {
        $('#newconactmsg').html('<font color="red">ERROR: '+result.msg+'</font>');
        setTimeout("$('#newconactmsg').html('');", 5000);
      }
    });
  }  
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

function acceptInvite(){
  var ic = $('#enterinvitecode').val().split('_');
  if (ic.length != 2) alert("That is not a valid invite code!");
  var groups = encodeURIComponent($('.invitegroupselect').find('select').val());
  json('../peerbot/connect', 'uuid='+ic[0]+'&code='+ic[1]+'&groups='+groups, function(result){
    if (result.status != 'ok') alert(result.msg);
    else document.location.href = ''+document.location.href;
  });
}

function listAccessCodes(){
  json('../peerbot/accesscodes', null, function(result){
    var newhtml = '';
    for (var i in result.data){
      var rdi = result.data[i];
      var use = rdi.delete == 'true' ? 'single use' : 'reusable';
      newhtml += '<div class="mdl-chip mdl-chip--deletable"><div class="mdl-chip__text">'+use+': '+rdi.groups+'<br>'+i+'</div><button type="button" class="codechip mdl-chip__action" onclick="deleteaccesscode(\''+i+'\');"><i class="material-icons">cancel</i></button></div> ';
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
          var con = document.peers[rai.uuid];
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




$(document).click(function(event) {
   window.lastElementClicked = event.target;
});
