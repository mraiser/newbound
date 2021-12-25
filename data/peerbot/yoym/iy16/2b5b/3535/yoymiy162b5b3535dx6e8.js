var me = this;
var ME = $('#'+me.UUID)[0];

$('body').css('background-color', '#888');

$(ME).find('.pb-nav').click(function(){
  $(ME).find('.pb-tab').css('display', 'none');
  $(ME).find('.pb-'+this.id.substring(7)).css('display', 'block');
});

$('#newconnectionbutton').click(function(){
  $(ME).find('.wrap').css('display', 'none');
  $(ME).find('.addcon').css('display', 'block');
});

$('#adconbackbutton').click(function(){
  $(ME).find('.wrap').css('display', 'block');
  $(ME).find('.addcon').css('display', 'none');
});

$('#addaccesscodebutton').click(function(){
  $(ME).find('.wrap').css('display', 'none');
  $(ME).find('.addcode').css('display', 'block');
  suggestAccessCode();
});

$('#adcodebackbutton').click(function(){
  $(ME).find('.wrap').css('display', 'block');
  $(ME).find('.addcode').css('display', 'none');
});

$('#createinvitebutton').click(function(){
  $(ME).find('.wrap').css('display', 'none');
  $(ME).find('.addinvite').css('display', 'block');
  $('.invitepanel').css('display', 'none');
  $('#inviteform').css('display', 'block');
});

$('.closeinvitedialog').click(function(){
  $(ME).find('.wrap').css('display', 'block');
  $(ME).find('.addinvite').css('display', 'none');
});

$('#grouplist').change(function(){
  newContactGroup($(this).val());
});

$('#allowanon').click(function(){
  json("../peerbot/allowanon","allow="+$(this).prop('checked'), function(result) {
    console.log(result);
  });
});

$('#rescandiscoverybutton').click(discovery);

function update(){
  if ($('body').find($(ME).find('.wrap')[0])[0]) json('../peerbot/connections', null, function(result){
    me.peers = result.data;
    var firsttime = !me.uuids;
    if (firsttime) me.uuids = '';
    for (var id in me.peers){
      if (me.uuids.indexOf(id) == -1) {
        if (me.uuids != '') me.uuids += ' ';
        me.uuids += id;
      }
      
      var p = me.peers[id];
      p.mode = 'more';
      p.millis = result.currenttimemillis - p.lastcontact;
      var el = $(ME).find('.'+id)[0];
      if (el){
        if (el.api) el.api.update(p);
      }
      else {
        var el = $('<div class="peerholder '+id+'">')[0];
        $(ME).find('.pb-peerlist').append(el);
        installControl(el, "coreapps", "peer", null, p);
      }
    }
      
    setTimeout(update, 5000);
  });
}

update();

me.ready = function(){
  json("../peerbot/getpeerinfo", null, function(result) {
    $('#localpeerid').text(result.id);
    $('#localpeerport').text(result.port);
    $('#allowanon').prop('checked', result.allowanon).checkboxradio('refresh');

    json("../securitybot/listgroups", null, function(result){
      var newhtml = '';
      var newhtml2 = '';
      for (var i in result.data) {
        var x = '<option value="'+result.data[i]+'">'+result.data[i]+'</option>';
        if (result.data[i] != 'anonymous') newhtml2 += x;
        newhtml += x;
      }
      $('#grouplist').html(newhtml).selectmenu('refresh');
      $('#grouplist2').html(newhtml2).selectmenu('refresh');
      $('#grouplist3').html(newhtml2).selectmenu('refresh');
    
      discovery();
      listAccessCodes();
    });
  });
};

function addGroup(){
	var val = $('#grouplist').val();
	var groups = $("#newcontactgroup").val().trim();
	if ((','+groups+',').indexOf(','+val+',') == -1){
		if (groups != '') groups += ',';
	    $("#newcontactgroup").val(groups+val);
	}
}

function newContactGroup(val){
	if (val == 'anonymous') {
		$("#newcontactgroup").val(val);
        $('#addgroupbutton').html('');
	}
	else {
		if ($("#newcontactgroup").val() == 'anonymous') $("#newcontactgroup").val(val);
		$('#addgroupbutton').html("<input type='button' value='add' class='madbutton' data-inline='true'>").trigger('create');
        $(ME).find('.madbutton').click(addGroup);
	}
}
  
function newConnection() {
  var id = $('#newcontactid').val();
  var addr = $('#newcontactip').val();
  var port = $('#newcontactport').val();
  var code = $('#newcontactcode').val();
  var groups = $('#newcontactgroup').val();

  if (!id || id.trim() == '') $('#newconactmsg').html('<font color="red">Universal ID is required</font>');
  else {
    if (!addr || addr.trim() == '') addr='';
    if (!port || port.trim() == '') port='';
    if (!code || code.trim() == '') code='';
    if (!groups || groups.trim() == '') groups='';
  
    $('#newconactmsg').html('<font color="green">Connecting to: '+id+'</font>');
    $.getJSON('../peerbot/newconnection?sessionid='+sessionid+'&uuid='+encodeURIComponent(id)+"&addr="+encodeURIComponent(addr)+"&port="+encodeURIComponent(port)+"&code="+encodeURIComponent(code)+"&groups="+encodeURIComponent(groups)+"&callback=?", function(result) {
      if (result.status == 'ok') {
        $('#newconactmsg').html('');
        $('#adconbackbutton').click();
      }
      else {
        $('#newconactmsg').html('<font color="red">ERROR: '+result.msg+'</font>');
        setTimeout("$('#newconactmsg').html('');", 5000);
      }
    });
  }  
}  
$('#addcontactbutton').click(newConnection);

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
            += '<li id="li_'+rai.name+'"><div style="position:absolute;z-index:10;right:50px;text-align:right;">'+floater+'</div><a id="a_'+rai.name+'" class="li_botlist" href="'+url+'">'
            + '<h3 class="ui-li-heading">'+rai.name+' ('+rai.uuid+')</h3><p class="ui-li-desc">'+rai.address[0]+':'+rai.port+'</p></a></li>';
        }
      }
			
      if (n>0) newhtml 
          = '<ul id="ul_botlist" data-role="listview" data-inset="true" data-theme="c" data-divider-theme="b"><li data-role="list-divider">Available Peers</li>'
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
  $(ME).find('.'+uuid)[0].api.connect(discovery);
};

disconnect = function(uuid){
  $(ME).find('.'+uuid)[0].api.disconnect(discovery);
};

addConnection = function(uuid, addr, port){
  $('#newcontactid').val(uuid);
  $('#newcontactip').val(addr);
  $('#newcontactport').val(port);
  
  $('#newconnectionbutton').click();
};

function addGroupToCode(){
    var g = $('#grouplist2').val();
    var l = ','+$('#accesscodegroups').val()+',';
    if (l.indexOf(','+g+',') == -1) {
        l += g;
        while (l.indexOf(',')==0) l = l.substring(1);
        $('#accesscodegroups').val(l);
    }
}
$('#addgrouptoaccesscode').click(addGroupToCode);

function addGroupToInvite(){
    var g = $('#grouplist3').val();
    var l = ','+$('#invitegroups').val()+',';
    if (l.indexOf(','+g+',') == -1) {
        l += g;
        while (l.indexOf(',')==0) l = l.substring(1);
        $('#invitegroups').val(l);
    }
}
$('#addgrouptoinvite').click(addGroupToInvite);

function showInvite(which){
    $('.invitepanel').css('display','none');
    $('#'+which).css('display','block');
}

function createInvite(){
	json('suggestaccesscode', null, function(result){
		var code = encodeURIComponent(result.msg);
		var del = true;
		var groups = encodeURIComponent($('#invitegroups').val());
		json('../peerbot/addaccesscode', 'code='+code+'&delete='+del+'&groups='+groups, function(result){
		    if (result.status == 'ok') {
		        var url = 'http://localhost:5773/peerbot/index.html?connect='+$('#localpeerid').text()+'&code='+code;
                $('#newinvitelink').val(url);
                setTimeout(function(){
                    $('#newinvitelink').focus();
                    $('#newinvitelink').select();
                }, 500);
		        showInvite('inviteresult');
                listAccessCodes();
		    }
		    else alert(result.msg);
		});
	});
}
$('#createtheinvite').click(createInvite);

function addAccessCode(){
	var code = encodeURIComponent($('#newaccesscode').val());
	var del = $('#deleteonuse').prop('checked');
	var groups = encodeURIComponent($('#accesscodegroups').val());
	json('../peerbot/addaccesscode', 'code='+code+'&delete='+del+'&groups='+groups, function(result){
		if (result.status == 'ok') {
			$('#adcodebackbutton').click();
			listAccessCodes();
		}
		else alert(result.msg);
	});
}
$('#addtheaccesscode').click(addAccessCode);

function deleteAccessCode(id){
	json('../peerbot/deleteaccesscode', 'code='+encodeURIComponent(id), function(result){
		listAccessCodes();
	});
}

function suggestAccessCode(){
	json('../peerbot/suggestaccesscode', null, function(result){
		$('#newaccesscode').val(result.msg);
	});
}

function listAccessCodes(){
	json('../peerbot/accesscodes', null, function(result){
		var newhtml = '';
		var b = true;
			
		for (var i in result.data){
			b = false;
			var rdi = result.data[i];
//			newhtml += '<li><div style="float:right;"><a data-role="button" data-inline="true" data-mini="true" onclick="deleteAccessCode(\''+i+'\');">delete</a></div><h3>'+i+'</h3><p>'+(rdi.delete == 'true' ? 'Single use only: ' : 'Reusable: ')+rdi.groups+'</p></li>';
          newhtml += '<div class="pb-accesscode">'
            + '<table border="0" cellpadding="3" cellspacing="0"><tr><td rowspan="2">'
            + '<a class="deleteaccesscodebutton" data-role="button" data-icon="delete" data-iconpos="notext" data-inline="true" data-mini="true" data-theme="b" data-id="'+i+'">Delete</a>'
            + '</td><td>'
            + i
            + '</td></tr><tr><td>'
            + (rdi.delete == 'true' ? 'Single use only: ' : 'Reusable: ')+rdi.groups
            + '</td></tr></table></div>';
		}
        if (b) newhtml = '<div class="pb-deviceinfo">None found...</div>';
//        else newhtml = '<ul id="ul_invitelist" data-role="listview" data-inset="true" data-theme="c" data-divider-theme="a"><li data-role="list-divider">Access Codes</li>' + newhtml + '</ul>';
		$('#accesscodelist').html(newhtml).trigger('create');
      
      $(ME).find('.deleteaccesscodebutton').click(function(){
        var id = $(this).data('id');
        deleteAccessCode(id);
      });
	});
}
