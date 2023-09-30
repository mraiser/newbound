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
  
  var d = { ready: ready3D, orbit: true };
  installControl('#my3d', 'app', 'scenegraph', function(api){}, d);
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

function ready3D(api){
  me.scene = api;
  var el = $('<div class="hideme"/>');
  $(ME).append(el);
  api.addControl(el[0],'app', 'shape', function(shape){ 
    shape.model.rotation.x = 0.3;
    shape.render = function(){
      shape.model.rotation.y += 0.01;
    };
    var cindex = 1;
    var colors = [ [131,188,0], [255,69,0], [65,105,225], [220,220,220] ];
    shape.click = function(e){
      var c = colors[cindex++];
      if (cindex >= colors.length) cindex = 0;
      shape.setColor(c[0]/255, c[1]/255, c[2]/255);
    };
  }, {});
}
