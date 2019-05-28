function restart() {
    $('#settingsmsg').html("<i>Restarting Services...</i>");
	json('restart', null, function(result) {
	    console.log(result);
	});
	
	var isready = false;
	function checkReady() {
		json('getsettings', null, function(result) {
			isready = true;
		    $('#settingsmsg').html("Services have been restarted.");
		});
		if (!isready) setTimeout(checkReady, 1000);
	}
	setTimeout(checkReady, 10000);
}

function sendGetSettings(machineid,portnum, defaultbot,cb) {
	var params = '';
	if (machineid) params += 'machineid='+machineid+'&';
	if (portnum) params += 'portnum='+portnum+'&';
	if (defaultbot) params += 'defaultbot='+defaultbot;
	json('getsettings', params, cb);
}

function swapControls(n) {
  $('.topnavitem').removeClass('ui-btn-active');
  $('#topnav'+n).addClass('ui-btn-active');
  $('.controls').css('display', 'none');
  $('#controls'+n).css('display', 'block');
}

function populateSettings() {
  sendGetSettings(null, null, null, function(result) {
	  if (result.status == 'ok') {
//		result = JSON.parse('{ "msg": "'+result.msg+'" }');
	    $('#devicename').val(result.machineid);
	    $('#portnum').val(result.portnum);
	    populateBotList(result.defaultbot);
	  }
	  else {
		  $('#hidesettings').css('display', 'none');
		  $('#settingserror').css('display', 'block');
		  $('#settingserror').html('<b>ERROR: '+result.msg+'</b>');
		  swapControls(-1);
		  window.location = 'login.html';
	  }
  });
}

function saveSettings() {
  var mid = escape($('#devicename').val());
  var portnum = escape($('#portnum').val());
  var defaultbot = escape($('#defaultbot').val());
  
  sendGetSettings(mid, portnum, defaultbot, function(result) {
    $('#settingsmsg').html("<i>Your settings have been saved. You will need to restart this device for your changes to take effect.</i>");
  });
}

function populateBotList(dbval) {
	json('listbots', null, function(result) {
		var newhtml ='';
		var select = document.getElementById('defaultbot');
		select.options.length = 0;
		var defaultbot = "<option value='botmanager'>botmanager</option>";
		console.log(result.data);
		console.log(dbval);
		
		var allapps = new Object();
		
		for (var item in result.data) {
			var rdi = result.data[item];
			allapps[rdi.id] = rdi;
			defaultbot += "<option value='"+rdi.botname+"'>"+rdi.botname+"</option>";
			var a = "<a href='../"+rdi.botname+"/"+rdi.index+"' rel='external'>";
			var e = rdi.registered ? '' : '<br>'+(rdi.expires >= 0 ? 'Expires: '+(rdi.expires+1)+' days' : "Expired");
			if (e == "<br>Expired") a = "<a href='expired.html?bot="+rdi.botname+"' rel='external'>";
			var u = "<div id='update_"+rdi.id+"' style='position:absolute;right:-10px;text-align:right;'></div>";
			
/*			newhtml += "<div style='float: left;'><div style='width: 300px; height: 300px; padding: 5px;position:relative;'>"
				+ "<iframe src='../"+rdi.botname+"/"+rdi.index+"' style='position:absolute;width: 290px; height: 290px;'></iframe>"
				+ "<div style='width: 290px; height: 290px;background-color:lightgray;position:absolute;z-index:9;opacity:0.75;'></div>"
				+ "<div style='width: 290px; height: 290px;border-style: solid; border-color: black; border-width: thin; position:relative;z-index:10;'>"
				+ "<span style='float:right;margin:10px;background-color:white;padding:10px;'>"+a+rdi.name+"</a>"+e+"</span>"+a+"<img src='.."+rdi.img+"' width='140' height='140'></a><div style='padding:10px;font-size:small;background-color:white;'>"+rdi.desc+"</div></div></div></div>";
 */
			newhtml += "<div style='float: left;'><div style='width: 300px; height: 300px; padding: 5px;'>"
				+ "<div style='width: 290px; height: 290px;'><div class='ui-body ui-body-c ui-corner-all' style='height:270px;position:relative;'>"
				+ "<span style='position:absolute;right:10px;margin:10px;'>"+a+rdi.name+"</a>"+e+u+"</span>"+a+"<img src='.."+rdi.img+"' width='140' height='140'></a><div style='padding:10px;font-size:small;'>"+rdi.desc+"</div></div></div></div></div>";
		}
		$('#botlist').html(newhtml);
		$('#defaultbot').html(defaultbot);
		$('#defaultbot').val(dbval);
		$('#defaultbot').selectmenu('refresh', true);
		
		json("../peerbot/connections", null, function(result){
			for (var item in result.data){
				var rdi = result.data[item];
				if (rdi.connected) {
					$.getJSON('../peerbot/remote/'+item+'/appstore/listapps', function(result){
						for (var i in result.data){
							var app = result.data[i];
							if (allapps[app.id]) {
								if (allapps[app.id].version < app.version) {
									$('#update_'+app.id).html('<br><a data-mini="true" data-inline="true" data-role="button" href="../appstore" rel="external">UPDATE<br>AVAILABLE</a>').trigger("create");
//									$('#thereareupdates').html('<br><center><a data-inline="true" data-role="button" href="../appstore" rel="external">UPDATES AVAILABLE</a></center><br>').trigger("create");
								}
							}
						}
					});
				}
			}
		});
	});
}

function getQueryParameter ( parameterName ) {
	  var queryString = window.top.location.search.substring(1);
	  var parameterName = parameterName + "=";
	  if ( queryString.length > 0 ) {
	    begin = queryString.indexOf ( parameterName );
	    if ( begin != -1 ) {
	      begin += parameterName.length;
	      end = queryString.indexOf ( "&" , begin );
	        if ( end == -1 ) {
	        end = queryString.lengthblock
	      }
	      return unescape ( queryString.substring ( begin, end ) );
	    }
	  }
	  return "null";
}


$(document).on( 'pagecreate', function() {
  if (getQueryParameter('header') == 'false') $('#headertitle').css('display', 'none');
  swapControls(0);
  populateSettings();
});
