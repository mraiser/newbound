var me = this; 
var ME = $('#'+me.UUID)[0];

me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  ui.initNavbar(ME);
  ui.initPopups(ME);
  ui.initProgress(ME);
  ui.initTooltips(ME);
  ui.initSliders(ME);
};

$(ME).find('#usercardgroupradio1').click(function(){ $(ME).find('.myprogress')[0].setProgress(0); });
$(ME).find('#usercardgroupradio2').click(function(){ $(ME).find('.myprogress')[0].setProgress(25); });
$(ME).find('#usercardgroupradio3').click(function(){ $(ME).find('.myprogress')[0].setProgress(100); });
$(ME).find('#usercardgroupradio4').click(function(){ $(ME).find('.myprogress')[0].setProgress('indeterminate'); });

$(ME).find('.snackbarbutton').click(function(){
  var d = {
    message: "A thing has been done.",
    timeout:2750,
    width:"260px",
    actionText: "Undo",
    actionHandler:function(){
      d = {message: "The thing has been undone."};
      me.ui.snackbar(d);
    }
  };
  me.ui.snackbar(d);
});