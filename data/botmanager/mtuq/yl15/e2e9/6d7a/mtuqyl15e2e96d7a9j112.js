var me = this;
var ME = $('#'+me.UUID)[0];

function populateBotList(dbval) {
	json('../botmanager/listbots', null, function(result) {
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
//			var e = rdi.registered ? '' : '<br>'+(rdi.expires >= 0 ? 'Expires: '+(rdi.expires+1)+' days' : "Expired");
//			if (e == "<br>Expired") a = "<a href='expired.html?bot="+rdi.botname+"' rel='external'>";
			var u = "<div id='update_"+rdi.id+"' style='position:absolute;right:-10px;text-align:right;'></div>";
			
          newhtml += "<div style='display:inline-block;'><div style='width: 300px; height: 300px; padding: 5px;'>"
				+ "<div style='width: 290px; height: 290px;'><div class='ui-body ui-body-c ui-corner-all' style='height:270px;position:relative;background-color:whitesmoke;'>"
				+ "<span style='position:absolute;right:10px;margin:10px;'>"+a+rdi.name+"</a>"+u+"</span>"+a+"<img src='.."+rdi.img+"' width='140'></a><div style='padding:10px;font-size:small;'>"+rdi.desc+"</div></div></div></div></div>";
		}
		$('#botlistinner').css('opacity', '0');
		$('#botlistinner').html(newhtml);
        $('#botlistinner').animate({"opacity":"1"},500);
		$('#defaultbot').html(defaultbot);
		$('#defaultbot').val(dbval);
		$('#defaultbot').selectmenu('refresh', true);
      
      $(window).resize();
	});
}

me.populateBotList = populateBotList;
