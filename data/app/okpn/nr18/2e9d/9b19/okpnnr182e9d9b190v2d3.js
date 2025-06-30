var me = this;
var ME = $('#'+me.UUID)[0];

// This is the entry point called by the app:ui control when it is ready.
me.uiReady = function(ui){
  me.ui = ui;
  $(ME).find('.wrap').css('display', 'block');
  
  // Initialize all UI components found within this control
  ui.initNavbar(ME);
  ui.initPopups(ME);
  ui.initProgress(ME);
  ui.initTooltips(ME);
  ui.initSliders(ME);
  
  // The 3D scene graph installation is commented out by default
  var d = { ready: ready3D, orbit: true };
  //installControl('#my3d', 'app', 'scenegraph', function(api){}, d);
};

// --- Event Handlers for UI elements ---

// Dark mode switch
$(ME).find('#dark-mode-switch').on('change', function() {
    if ($(this).is(':checked')) {
        $('body').addClass('dark');
    } else {
        $('body').removeClass('dark');
    }
});


// Radio buttons controlling the progress bar
$(ME).find('#usercardgroupradio1').click(function(){ $(ME).find('.myprogress')[0].setProgress(0); });
$(ME).find('#usercardgroupradio2').click(function(){ $(ME).find('.myprogress')[0].setProgress(25); });
$(ME).find('#usercardgroupradio3').click(function(){ $(ME).find('.myprogress')[0].setProgress(100); });
$(ME).find('#usercardgroupradio4').click(function(){ $(ME).find('.myprogress')[0].setProgress('indeterminate'); });

// Snackbar button
$(ME).find('.snackbarbutton').click(function(){
  var d = {
    message: "A thing has been done.",
    timeout:2750,
    actionText: "Undo",
    actionHandler:function(){
      d = {message: "The thing has been undone."};
      me.ui.snackbar(d);
    }
  };
  me.ui.snackbar(d);
});

// Prompt button
$(ME).find('.promptbutton').click(function(){
    me.ui.prompt({
        title: "Enter Name",
        text: "Please provide your name below.",
        value: "HAL 9000",
        ok: "Submit",
        cb: function(value){
            me.ui.snackbarMsg("Hello, " + value);
        }
    });
});

// Confirm button
$(ME).find('.confirmbutton').click(function(){
    me.ui.confirm({
        title: "Confirm Action",
        text: "Are you sure you want to proceed with this dangerous action?",
        ok: "Proceed",
        cb: function(confirmed){
            if (confirmed) {
                me.ui.snackbarMsg("Action confirmed.");
            } else {
                me.ui.snackbarMsg("Action was cancelled.");
            }
        }
    });
});


// --- 3D Scene Callbacks (currently unused) ---

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
    shape.dblclick = function(e){
      console.log(e);
    };
  }, {});
}
