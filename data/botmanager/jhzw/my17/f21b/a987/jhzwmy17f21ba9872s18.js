var me = this; 
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var el = $(ME).parent()[0];
  if (el.api && el.api.uiReady)
    el.api.uiReady(me);
};

$(document).click(function(event) {
   window.lastElementClicked = event.target;
});

me.initNavbar = function(el){
  $(el).find('.navbar-tab').click(function(){
    var which = $(this).data('id');
    $(el).find('.navbar-tab').removeClass('selected');
    $(el).find('.tab-content').removeClass('selected');
    $(this).addClass('selected');
    $(el).find('.'+which).addClass('selected');
  });
};

me.initPopups = function(el){
  $(el).find('.popupmenu').click(function(){
    $(el).find('.popupcard').css('display', 'none');
    $(el).find('.'+$(this).data('id')).css('display', 'inline-block');
  });

  $(el).find('.popupcard-close').click(function(){
    $(el).find('.popupcard').css('display', 'none');
  });
};
