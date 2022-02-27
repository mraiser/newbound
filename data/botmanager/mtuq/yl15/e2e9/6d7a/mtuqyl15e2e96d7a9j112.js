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
//			var a = "<a href='../"+rdi.botname+"/"+rdi.index+"' rel='external'>";
//			var u = "<div id='update_"+rdi.id+"' style='position:absolute;right:-10px;text-align:right;'></div>";
			
          newhtml += "<div class='card appcard'>"
            + "<img src='.."+rdi.img+"'>"
			+ "<div class='overlay'>"
            + rdi.name
            + "</div>"
            + "<div class='bottomhugger'>"
            + "<div class='description'>"+rdi.desc+"</div>"
            + "</div>"
            + "</div>";
		}
		$('#botlistinner').css('opacity', '0');
		$('#botlistinner').html(newhtml);
        $('#botlistinner').animate({"opacity":"1"},500);
		$('#defaultbot').html(defaultbot);
		$('#defaultbot').val(dbval);
		//$('#defaultbot').selectmenu('refresh', true);
      
      $(window).resize();
	});
}

me.populateBotList = populateBotList;
