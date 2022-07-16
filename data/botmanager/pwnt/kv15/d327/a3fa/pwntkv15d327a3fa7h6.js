var me = this;
var ME = $('#'+me.UUID)[0];

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  ui.initNavbar(ME);
  //ui.initPopups(ME);
};
