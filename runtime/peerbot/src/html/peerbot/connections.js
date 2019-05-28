function pc_peerHover(but, way){
	if (!but.busy){
		if (way) {
			$(but).removeClass(but.data.connected ? 'pc_connected' : 'pc_offline');
			$(but).addClass(but.data.connected ? 'pc_connected_hover' : 'pc_offline_hover');
		}
		else {
			$(but).removeClass(but.data.connected ? 'pc_connected_hover' : 'pc_offline_hover');
			$(but).addClass(but.data.connected ? 'pc_connected' : 'pc_offline');
		}
	}
}

function pc_peerClick(but){
	if (!but.busy){
		but.busy = true;
		$(but).removeClass(but.data.connected ? 'pc_connected' : 'pc_offline');
		$(but).removeClass(but.data.connected ? 'pc_connected_hover' : 'pc_offline_hover');
		$(but).addClass('pc_connecting');
		$('#pc_peermsg').html(but.data.name+' '+(but.data.connected ? 'dis' : '')+'connecting...');
		json('../peerbot/'+(but.data.connected ? 'dis' : '')+'connect','uuid='+but.data.id, function(result){
			pc_listPeers();
			if (result.status == 'err') $('#pc_peermsg').html('<font color="red"><i>Unable to connect to '+but.data.name+'. Message: '+result.msg+'</i></font>');
			else $('#pc_peermsg').html('');
		});
	}
}

function pc_listPeers() {
	json('../peerbot/connections', null, function(result) {
		$('#pc_peerlist').html('');
		document.getElementById('pc_peerlist').peers = result.data;
		for (var item in result.data) {
			var rdi = result.data[item];
			var classes = 'peercell ' + (rdi.connected ? 'pc_connected' : 'pc_offline');
			var but = "<span title='"+rdi.id+"' class='"+classes+"' id='b_"+rdi.id+"' onmouseover='pc_peerHover(this, true);' onmouseout='pc_peerHover(this, false);' onclick='pc_peerClick(this);'>"+rdi.name+"</span>";
			$('#pc_peerlist').append(but);
			document.getElementById('b_'+rdi.id).data = rdi;
		}
		pc_cb(result.data);
	});
}

var pc_cb = null;

function buildConnectionBar(div, cb) {
	
	function openWebsocket() {
		var url = document.URL;
		url = url.substring(url.indexOf(':')+1);
		while (url.substring(0,1) == '/') url = url.substring(1);
		var i = url.lastIndexOf('/');
		if (i != -1) url = url.substring(0,i);
		i = url.lastIndexOf('/');
		if (i != -1) url = url.substring(0,i);
		url += '/peerbot/index.html';
		
		var connection = new WebSocket('ws://'+url, ['newbound']);

		// When the connection is open, send some data to the server
		connection.onopen = function () {
		    connection.send('CONNECTED'); // Send the message 'PING' to the server
		};

		// Log errors
		connection.onerror = function (error) {
			console.log('WebSocket Error ' + error);
		};

		// Log messages from the server
		connection.onmessage = function (e) {
			var s = JSON.parse(e.data);
			if (s.event == 'update') setTimeout(pc_listPeers, 1000);
			else if (s.event == 'connect' || s.event == 'disconnect'){
				var el = document.getElementById('b_'+s.data.id);
				if (el == null) setTimeout(pc_listPeers, 1000);
				else {
					var data = el.data;
					$(el).removeClass(data.connected ? 'pc_connected' : 'pc_offline');
					$(el).removeClass(data.connected ? 'pc_connected_hover' : 'pc_offline_hover');
					data.connected = s.event == 'connect';
					$(el).addClass(data.connected ? 'pc_connected' : 'pc_offline');
	
					pc_cb(document.getElementById('pc_peerlist').peers);
				}
			}
			console.log("GOT: "+s);
		};

		document.getElementById('botcontrols').connection = connection;
	}

	
	pc_cb = cb;
	$('#'+div).html('<center><div id="pc_peerlist"></div><div id="pc_peermsg"></div></center>')
	pc_listPeers();
	openWebsocket();
}