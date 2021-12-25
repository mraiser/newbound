var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(api){
  componentHandler.upgradeAllRegistered();

  var el = $(ME).find('.flowcodeviewer');
  el.data('orbitcontrols', false);
  el.data('showdatgui', false);
  
  installControl(el[0], 'threejs', 'viewer', function(api){
    me.viewer = api;
    api.waitReady(function(){
      
      var scene = me.viewer.scene;
      var camera = scene.camera;
      
      camera.position.x = 0;
      camera.position.y = 0;
      camera.position.z = 10;    
      camera.lookAt(scene.position);

      me.setData(ME.DATA);
    });
  }, {});
};

me.dirty = function(){
  if (me.parent && me.parent.dirty) me.parent.dirty();
};

me.getData = function(){
  return me.case.getCode();
};

me.setData = function(ctl){
  var el = $('<div/>');
  $(ME).append(el);
  me.viewer.add(el[0], "flow", "case", function(model){
    me.case = model.api;
    me.case.parent = me;
    me.case.target_z = 0;
    me.cases = [];
    $(ME).find('canvas').prop('tabindex', 0).keydown(function(e){
      if (e.keyCode == 46) me.case.deleteSelected();
      console.log(e);
    });
  }, ctl);
};
      
$(ME).click(function(e){
  console.log("------------------------------------");
  console.log(e);
  console.log("------------------------------------");
  
  if (e.shiftKey){
    console.log("SHIFT");
  }
});







