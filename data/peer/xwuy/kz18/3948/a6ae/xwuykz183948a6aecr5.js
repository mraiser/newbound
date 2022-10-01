var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = me.refresh = function(){
  me.check = $(ME).find('.rp-uuid')[0];
  me.update();
};

$(ME).find('.closehud').click(function(){
  var el = $("#headsupdisplay");
  el.animate({width:0}, 300, function(){ el.css('display', 'none').html(''); });
});

me.update = function(){
  if (me.check == $(ME).find('.rp-uuid')[0]) {
    ME.DATA = $('#peer_'+ME.DATA.id)[0].DATA;
    $(ME).find('.rp-name').text(ME.DATA.name);
    $(ME).find('.rp-uuid').text(ME.DATA.id);

    var c = ME.DATA.tcp ? '#84bd00' : ME.DATA.udp ? '#00f' : ME.DATA.connected ? '#ff0' : 'ccc';
    $(ME).find('.connectionindicator').css('background-color', c);
    var l = ME.DATA.latency ? ME.DATA.latency+'ms' : '--';
    $(ME).find('.connectionlatency').text(l);
    
    setTimeout(me.update, 3000);
  }
};
