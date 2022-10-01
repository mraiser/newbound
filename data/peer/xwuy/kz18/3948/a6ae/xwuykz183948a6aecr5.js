var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = me.refresh = function(){
  $(ME).find('.rp-name').text(ME.DATA.name);
  $(ME).find('.rp-uuid').text(ME.DATA.id);
};

$(ME).find('.closehud').click(function(){
  var el = $("#headsupdisplay");
  el.animate({width:0}, 300, function(){ el.css('display', 'none').html(''); });
});