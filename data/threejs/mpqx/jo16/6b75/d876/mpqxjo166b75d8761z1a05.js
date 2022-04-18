var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  $('#editmodelname').val(ME.DATA.model.name);
  $('#editmodelthumbnail').val(ME.DATA.model.thumbnail);
  $('#editmodelbackground').val(ME.DATA.model.background);
  $('#editmodeloverlay').val(ME.DATA.model.overlay);
  $('#opslider').val(ME.DATA.model.overlayopacity);
  //componentHandler.upgradeAllRegistered();
  
  me.viewer = ME.DATA.viewer;
  
  var data = {
    lib: ME.DATA.model.lib,
    allowadd:true,
    list: ME.DATA.model.assets,
    cb: function(val){
      if (ME.DATA.cb) ME.DATA.cb(ME.DATA.model);
    }
  };
  var el = $(ME).find('.assetlistgoeshere');
  installControl(el[0], 'metabot', 'assetlist', function(api){}, data);
  
  ME.DATA.model.overlayopacity = $('#opslider').val();
  updateImages();

  me.poses = ME.DATA.model.poses = ME.DATA.model.poses ? ME.DATA.model.poses : [];
  me.animations = ME.DATA.model.animations = ME.DATA.model.animations ? ME.DATA.model.animations : [];
  rebuildPoses();
};

function updateImages(){
  el = $('#'+ME.DATA.viewer.UUID)
  el.find('.imagebackground').css('background-image', 'url('+ME.DATA.model.background+')');
  el.find('.imageoverlay').css('background-image', 'url('+ME.DATA.model.overlay+')').css('opacity', ME.DATA.model.overlayopacity/100);
}

function popupAssetPicker(which){
  me.field = which;
  data = {
    lib: ME.DATA.model.lib,
    allowadd:true
  };
  installControl($(ME).find('.assetpicker')[0], 'metabot', 'assetselect', function(api){
    me.picker = api;    
    installControl($(ME).find('.popmeup')[0], 'metabot', 'popupdialog', function(api){}, {});
  }, data);
}

$(ME).find('.choosethumbbutton').click(function(event) {
  popupAssetPicker('thumbnail');
});

$(ME).find('.choosebackgroundbutton').click(function(event) {
  popupAssetPicker('background');
});

$(ME).find('.chooseoverlaybutton').click(function(event) {
  popupAssetPicker('overlay');
});

me.selectThumb = function(val){
  var lib = me.picker.lib;
  var val = me.picker.value();
  var url = '../botmanager/asset/'+lib+'/'+val;
  $('#editmodel'+me.field).val(url).parent()[0].MaterialTextfield.checkDirty();
  $(ME).find('.closeme').click();
  ME.DATA.model[me.field] = url;
  updateImages();
  if (ME.DATA.cb) ME.DATA.cb(ME.DATA.model, true);
}

$('#opslider').change(function(){
  ME.DATA.model.overlayopacity = $(this).val();
  updateImages();
  if (ME.DATA.cb) ME.DATA.cb(ME.DATA.model, true);
});

$('#editmodelname').change(function(){
  var val = $(this).val();
  ME.DATA.model.name = val;
  if (ME.DATA.cb) ME.DATA.cb(ME.DATA.model, true);
});

$('#editmodelthumbnail').change(function(){
  var val = $(this).val();
  ME.DATA.model.thumbnail = val;
  updateImages();
  if (ME.DATA.cb) ME.DATA.cb(ME.DATA.model, true);
});

$('#editmodelbackground').change(function(){
  var val = $(this).val();
  ME.DATA.model.background = val;
  updateImages();
  if (ME.DATA.cb) ME.DATA.cb(ME.DATA.model, true);
});

$('#editmodeloverlay').change(function(){
  var val = $(this).val();
  ME.DATA.model.overlay = val;
  updateImages();
  if (ME.DATA.cb) ME.DATA.cb(ME.DATA.model, true);
});

function rebuildPoses(){
  var newhtml = '';
  for (var i in me.poses){
    var p = me.poses[i];
    newhtml += '<span class="mdl-chip mdl-chip--deletable clickme" data-index="'+i+'"><span class="mdl-chip__text">'+p.name+'</span><button type="button" class="mdl-chip__action"><i class="material-icons">cancel</i></button></span>';
    if (!p.id) p.id = guid();
  }
  if (newhtml != '') newhtml += '<br><br>';
  var el = $(ME).find('.poselistgoeshere');
  el.html(newhtml);
  el.find('.mdl-chip__text').click(function(){
    var i = $(this).parent().data('index');
    var p = me.poses[i];
    setPose(p);
  });;
  el.find('.mdl-chip__action').click(function(){
    var i = $(this).parent().data('index');
    var data = {
      title:"Delete Pose",
      text:"Are you sure you want to delete this pose?",
      cb:function(){
        me.poses.splice(i,1);
        savePoses();
        rebuildPoses();
      }
    }
    installControl('#popmeup2', 'metabot', 'confirmdialog', function(result){}, data);
  });;
  componentHandler.upgradeAllRegistered();
  
  var el = $(ME).find('.animationlistgoeshere');
  var data = {
    "poses": me.poses,
    "animations": me.animations,
    "cb": function(data){
      saveAnimations();
    }
  };
  installControl(el[0], 'threejs', 'animationlist', function(result){}, data);
}

function savePoses(){
  ME.DATA.cb(ME.DATA.model, true);
}

function saveAnimations(){
  ME.DATA.cb(ME.DATA.model, true);
}

function setPose(pose){
  var rig = me.viewer.modelapi.rig;
  for (var i in pose.pose){
    rig[i] = pose.pose[i];
  }
  var gui = me.viewer.datGUI;
  for (var i = 0; i < gui.__folders.Model.__controllers.length; i++) {
    var c = gui.__folders.Model.__controllers[i];
    var name = c.property;
    c.setValue(rig[name]);
  }
                                                     
  if (rig.campos){
    var cam = me.viewer.scene.camera;
    var con = me.viewer.controls;
    cam.position.set(rig.campos.x, rig.campos.y, rig.campos.z);
    con.target.set(rig.camrot.x, rig.camrot.y, rig.camrot.z);
    cam.scale.set(rig.camscale.x, rig.camscale.y, rig.camscale.z);
    con.update();
  }
}


$(ME).find('.newposebutton').click(function(){
  
  function cb(val){
    var rig = me.viewer.modelapi.rig;
    rig = Object.assign({}, rig);
    var cam = me.viewer.scene.camera;
    var con = me.viewer.controls;
    rig.campos = {};
    rig.campos.x = cam.position.x;
    rig.campos.y = cam.position.y;
    rig.campos.z = cam.position.z;
    rig.camrot = {};
    rig.camrot.x = con.target.x;
    rig.camrot.y = con.target.y;
    rig.camrot.z = con.target.z;
    rig.camscale = {};
    rig.camscale.x = cam.scale.x;
    rig.camscale.y = cam.scale.y;
    rig.camscale.z = cam.scale.z;
    
    var pose = {
      "name": val,
      "id": guid(),
      "pose": rig
    };
    
    me.poses.push(pose);
    rebuildPoses();
    savePoses();
  }
  
  var data = {
    "title": "New Pose",
    "text": "Enter a name for the new pose",
    "subtext": "",
    "cb": cb
  };
  
  installControl('#popmeup2', 'metabot', 'promptdialog', null, data);
});







