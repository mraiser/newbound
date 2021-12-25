var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  sendGetSettings(null, null, null, function(result) {
	  if (result.status == 'ok') {
//		result = JSON.parse('{ "msg": "'+result.msg+'" }');
	    $('#devicename').val(result.machineid);
	    $('#portnum').val(result.portnum);
        $('#botlist')[0].api.populateBotList(result.defaultbot);
	  }
	  else {
		  $('#hidesettings').css('display', 'none');
		  $('#settingserror').css('display', 'block');
		  $('#settingserror').html('<b>ERROR: '+result.msg+'</b>');
		  window.location = 'login.html';
	  }
  });
};

function sendGetSettings(machineid,portnum, defaultbot,cb) {
	var params = '';
	if (machineid) params += 'machineid='+machineid+'&';
	if (portnum) params += 'portnum='+portnum+'&';
	if (defaultbot) params += 'defaultbot='+defaultbot;
	json('../botmanager/getsettings', params, cb);
}

function saveSettings() {
  var mid = escape($('#devicename').val());
  var portnum = escape($('#portnum').val());
  var defaultbot = escape($('#defaultbot').val());
  
  sendGetSettings(mid, portnum, defaultbot, function(result) {
    $('#settingsmsg').html("<i>Your settings have been saved. You will need to restart this device for your changes to take effect.</i>");
  });
}

$('#savesettingsbutton').click(saveSettings);