var me = this; 
var ME = $('#'+me.UUID)[0];

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  ui.initNavbar(ME);
  ui.initPopups(ME);
};

me.ready = function(){
  if (typeof componentHandler != 'undefined')
    componentHandler.upgradeAllRegistered();
};

$(document).click(function(event) {
   window.lastElementClicked = event.target;
});
