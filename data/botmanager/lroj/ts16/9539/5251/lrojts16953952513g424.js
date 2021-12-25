var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  if ($(ME).data('title')) $(ME).find('.titlebar').html($(ME).data('title')).trigger('create');
  else if ($(ME).data('control').title) $(ME).find('.titlebar').html($(ME).data('control').title).trigger('create');
  
  var m;
  var menus = ['titlebutton-left-1','titlebutton-left-2','titlebutton-right-1','titlebutton-right-2'];
  for (var i in menus) 
    if ($(ME).data(m = menus[i])) 
      activateControl($(ME).find('.'+m).data('control', $(ME).data(m))[0]);
};
