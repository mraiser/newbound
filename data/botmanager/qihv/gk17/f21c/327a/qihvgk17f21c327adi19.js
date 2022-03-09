var me = this; 
var ME = $('#'+me.UUID)[0];

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  ui.initNavbar(ME);
  ui.initPopups(ME);
  ui.initProgress(ME);
};

$(ME).find('#usercardgroupradio1').click(function(){ $(ME).find('.myprogress')[0].setProgress(0); });
$(ME).find('#usercardgroupradio2').click(function(){ $(ME).find('.myprogress')[0].setProgress(25); });
$(ME).find('#usercardgroupradio3').click(function(){ $(ME).find('.myprogress')[0].setProgress(100); });
$(ME).find('#usercardgroupradio4').click(function(){ $(ME).find('.myprogress')[0].setProgress('indeterminate'); });
