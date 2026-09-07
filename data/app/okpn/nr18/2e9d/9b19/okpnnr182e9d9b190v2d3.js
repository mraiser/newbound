var me = this;
var ME = document.getElementById(me.UUID);

// This is the entry point called by the app:ui control when it is ready.
me.uiReady = function(ui){
  me.ui = ui;
  ME.querySelector('.wrap').style.display = 'block';

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
ME.querySelector('#dark-mode-switch').addEventListener('change', function() {
  if (this.checked) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
});


// Radio buttons controlling the progress bar
ME.querySelector('#usercardgroupradio1').addEventListener('click', function(){ ME.querySelector('.myprogress').setProgress(0); });
ME.querySelector('#usercardgroupradio2').addEventListener('click', function(){ ME.querySelector('.myprogress').setProgress(25); });
ME.querySelector('#usercardgroupradio3').addEventListener('click', function(){ ME.querySelector('.myprogress').setProgress(100); });
ME.querySelector('#usercardgroupradio4').addEventListener('click', function(){ ME.querySelector('.myprogress').setProgress('indeterminate'); });

// Snackbar button
ME.querySelector('.snackbarbutton').addEventListener('click', function(){
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
ME.querySelector('.promptbutton').addEventListener('click', function(){
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
ME.querySelector('.confirmbutton').addEventListener('click', function(){
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
  var el = document.createElement('div');
  el.className = 'hideme';
  ME.appendChild(el);
  api.addControl(el,'app', 'shape', function(shape){
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
